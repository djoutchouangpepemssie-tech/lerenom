/**
 * Les relances et les rappels de rendez-vous.
 *
 * Deux travaux périodiques, deux rythmes différents, pour deux raisons différentes.
 *
 * **La relance** s'adresse à un client qui n'a pas répondu à une proposition. Elle part une
 * fois, vingt-quatre heures après l'envoi, et jamais deux : harceler quelqu'un qui ne répond
 * pas ne le fait pas répondre, cela le fait bloquer l'expéditeur. Passé le délai, la
 * proposition expire d'elle-même et rend la plage — personne n'a à s'en occuper.
 *
 * **Le rappel** s'adresse à un client qui a confirmé. Il part la veille, puis deux heures
 * avant. Son objet n'est pas de convaincre mais d'éviter le déplacement pour rien : un
 * artisan qui sonne dans le vide a perdu sa matinée, et c'est la plainte la plus courante
 * du métier.
 *
 * Le lien de la relance est **neuf**. Le jeton d'origine n'a jamais été conservé en clair —
 * c'est tout l'intérêt de le hacher — donc on en crée un second, également valide. Les deux
 * ouvrent la même page et le premier expirera de lui-même.
 */

import { prisma } from '@lerenom/db';
import { aRelancer, heureDe, rappelAEnvoyer } from '@lerenom/core';
import { creeLien } from '@lerenom/liens';

export interface BilanRelances {
  readonly examinees: number;
  readonly relancees: number;
}

export interface BilanRappels {
  readonly examines: number;
  readonly veille: number;
  readonly proche: number;
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « mardi 3 mars » — la date telle qu'on la dit au téléphone. */
function jourLisible(date: Date): string {
  const quantieme = date.getDate() === 1 ? '1er' : String(date.getDate());
  return `${JOURS[date.getDay()] ?? ''} ${quantieme} ${MOIS[date.getMonth()] ?? ''}`;
}

/** Les coordonnées du client, qu'il vienne d'une demande ou du carnet du professionnel. */
function coordonnees(rendezVous: {
  readonly client: { readonly email: string | null; readonly telephone: string | null } | null;
  readonly demande: {
    readonly clientEmail: string;
    readonly clientTelephone: string;
  } | null;
}): { readonly email: string | null; readonly telephone: string | null } {
  return {
    email: rendezVous.client?.email ?? rendezVous.demande?.clientEmail ?? null,
    telephone: rendezVous.client?.telephone ?? rendezVous.demande?.clientTelephone ?? null,
  };
}

async function metEnFile(
  modele: string,
  destinataires: { readonly email: string | null; readonly telephone: string | null },
  sujet: string,
  corps: string,
): Promise<number> {
  const messages: { canal: 'email' | 'sms'; destinataire: string; sujet: string | null }[] = [];
  if (destinataires.email !== null) {
    messages.push({ canal: 'email', destinataire: destinataires.email, sujet });
  }
  if (destinataires.telephone !== null) {
    messages.push({ canal: 'sms', destinataire: destinataires.telephone, sujet: null });
  }
  if (messages.length === 0) return 0;

  await prisma.messageSortant.createMany({
    data: messages.map((message) => ({
      canal: message.canal,
      modele,
      destinataire: message.destinataire,
      sujet: message.sujet,
      corps,
      statut: 'en_attente' as const,
    })),
  });
  return messages.length;
}

/**
 * Relance une fois les clients qui n'ont pas répondu à une proposition.
 *
 * On ne remonte pas au-delà des propositions encore vivantes : une proposition expirée n'a
 * plus de créneau à offrir, et réveiller quelqu'un pour un horaire déjà rendu serait pire
 * que le silence.
 */
export async function relanceLesPropositions(
  maintenant: Date = new Date(),
): Promise<BilanRelances> {
  const plages = await prisma.creneau.findMany({
    where: {
      type: 'propose',
      annuleLe: null,
      relanceeLe: null,
      expireLe: { gt: maintenant },
      rendezVous: { statut: 'propose' },
    },
    select: {
      id: true,
      debutLe: true,
      finLe: true,
      creeLe: true,
      relanceeLe: true,
      entreprise: { select: { nom: true } },
      rendezVous: {
        select: {
          id: true,
          client: { select: { email: true, telephone: true } },
          demande: { select: { clientEmail: true, clientTelephone: true } },
        },
      },
    },
  });

  let relancees = 0;
  for (const plage of plages) {
    const rendezVous = plage.rendezVous;
    if (rendezVous === null) continue;
    if (
      !aRelancer(
        { type: 'propose', creeLe: plage.creeLe, relanceeLe: plage.relanceeLe },
        maintenant,
      )
    ) {
      continue;
    }

    const lien = await creeLien(null, 'choisir_creneau', rendezVous.id);
    const quand = `${jourLisible(plage.debutLe)} de ${heureDe(plage.debutLe)} à ${heureDe(plage.finLe)}`;
    const envoyes = await metEnFile(
      'rendez-vous-relance',
      coordonnees(rendezVous),
      `Votre rendez-vous avec ${plage.entreprise.nom}`,
      `${plage.entreprise.nom} vous a proposé un rendez-vous ${quand} et attend votre réponse. Acceptez ou déclinez ici : ${lien.url}`,
    );
    if (envoyes === 0) continue;

    // Marquée relancée même si un seul canal a servi : la relance a eu lieu, et elle est
    // unique. Réessayer demain parce qu'un courriel manquait reviendrait à relancer deux fois.
    await prisma.creneau.update({ where: { id: plage.id }, data: { relanceeLe: maintenant } });
    relancees += 1;
  }

  return { examinees: plages.length, relancees };
}

/**
 * Rappelle les rendez-vous confirmés, la veille puis deux heures avant.
 *
 * Ce travail tourne **toutes les heures** : la fenêtre de deux heures ne se rattrape pas
 * d'une nuit sur l'autre. C'est la différence avec les autres travaux périodiques, et la
 * raison pour laquelle il est bon marché — il ne regarde que les trente heures à venir.
 */
export async function rappelleLesRendezVous(maintenant: Date = new Date()): Promise<BilanRappels> {
  // Trente heures : la fenêtre de la veille, plus une marge pour qu'un worker arrêté une
  // heure ne laisse pas passer un rappel.
  const horizon = new Date(maintenant.getTime() + 30 * 3_600_000);

  const rendezVous = await prisma.rendezVous.findMany({
    where: {
      statut: 'confirme',
      creneau: { annuleLe: null, debutLe: { gt: maintenant, lte: horizon } },
    },
    select: {
      id: true,
      rappelVeilleLe: true,
      rappel2hLe: true,
      creneau: {
        select: { debutLe: true, finLe: true, entreprise: { select: { nom: true } } },
      },
      client: { select: { email: true, telephone: true } },
      demande: { select: { clientEmail: true, clientTelephone: true } },
    },
  });

  let veille = 0;
  let proche = 0;

  for (const rdv of rendezVous) {
    const quoi = rappelAEnvoyer(
      {
        statut: 'confirme',
        debut: rdv.creneau.debutLe,
        rappelVeilleLe: rdv.rappelVeilleLe,
        rappelProcheLe: rdv.rappel2hLe,
      },
      maintenant,
    );
    if (quoi === null) continue;

    const nom = rdv.creneau.entreprise.nom;
    const heure = heureDe(rdv.creneau.debutLe);
    const corps =
      quoi === 'veille'
        ? `Rappel : ${nom} intervient ${jourLisible(rdv.creneau.debutLe)} à ${heure}. Si vous avez un empêchement, prévenez l'entreprise dès maintenant.`
        : `${nom} arrive à ${heure}, dans moins de deux heures. Merci d'être joignable.`;

    const envoyes = await metEnFile(
      quoi === 'veille' ? 'rendez-vous-rappel-veille' : 'rendez-vous-rappel-proche',
      coordonnees(rdv),
      `Rappel de rendez-vous — ${nom}`,
      corps,
    );
    if (envoyes === 0) continue;

    await prisma.rendezVous.update({
      where: { id: rdv.id },
      data: quoi === 'veille' ? { rappelVeilleLe: maintenant } : { rappel2hLe: maintenant },
    });
    if (quoi === 'veille') veille += 1;
    else proche += 1;
  }

  return { examines: rendezVous.length, veille, proche };
}
