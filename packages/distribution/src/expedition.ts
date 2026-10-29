/**
 * L'expéditeur : le travail qui vide la file des messages.
 *
 * Le produit repose entièrement sur des messages — une demande distribuée prévient trois
 * professionnels, un devis s'ouvre par un lien reçu, un rendez-vous se propose et se rappelle
 * par SMS. Jusqu'ici, tout cela s'écrivait en base et n'en sortait jamais : aucun opérateur
 * n'est raccordé, et rien ne drainait la file. Deux cent quatre-vingt-six messages y
 * dormaient.
 *
 * Ce fichier apporte les deux pièces qui manquaient.
 *
 * **Un point de raccordement.** `Fournisseur` est une interface minuscule : un nom, les canaux
 * qu'il sert, une fonction qui envoie. Le jour où un opérateur SMS ou un service de courriel
 * est choisi, on écrit son adaptateur et on l'enregistre — rien d'autre ne bouge dans le
 * produit. C'est la raison d'être de cette indirection, et la seule.
 *
 * **Un refus de mentir.** Sans fournisseur, le travail **ne marque rien comme envoyé**. Il
 * compte ce qui attend et le dit. Un message passé à `envoye` alors que personne ne l'a reçu
 * serait la pire des sorties : la preuve que rien ne fonctionne disparaîtrait avec lui.
 *
 * La règle qui compte le plus vit ailleurs, dans `decideExpedition` : **un message périmé ne
 * part pas**. Elle existe à cause de cette file dormante. Le jour du raccordement, sans elle,
 * les deux cent quatre-vingt-six partiraient d'un coup — des rappels pour des rendez-vous de
 * la semaine dernière, des créneaux rendus depuis longtemps. Le client ne lit pas dix SMS
 * périmés : il bloque l'expéditeur, et le canal est perdu.
 */

import { prisma } from '@lerenom/db';
import { apresEnvoi, decideExpedition, type CanalMessage, type ResultatEnvoi } from '@lerenom/core';

/** Un message tel que le fournisseur le reçoit. */
export interface MessageAEnvoyer {
  readonly id: string;
  readonly canal: CanalMessage;
  readonly destinataire: string;
  readonly sujet: string | null;
  readonly corps: string;
  readonly modele: string;
}

/**
 * Un service d'envoi.
 *
 * Volontairement minuscule : tout ce qu'un opérateur a de particulier — clés, quotas, formats
 * d'erreur — reste dans son adaptateur. Le reste du produit ne connaît que cette forme.
 */
export interface Fournisseur {
  readonly nom: string;
  readonly canaux: readonly CanalMessage[];
  envoie(message: MessageAEnvoyer): Promise<ResultatEnvoi>;
}

export interface BilanExpedition {
  readonly examines: number;
  readonly envoyes: number;
  readonly abandonnes: number;
  readonly reportes: number;
  /** Messages qu'aucun fournisseur raccordé ne sait servir. */
  readonly sansFournisseur: number;
}

/**
 * Les fournisseurs raccordés.
 *
 * Vide par défaut, et c'est l'état réel du produit aujourd'hui. On ne pose pas d'adaptateur
 * « pour voir » qui ferait croire à un envoi.
 */
const fournisseurs: Fournisseur[] = [];

export function raccordeFournisseur(fournisseur: Fournisseur): void {
  fournisseurs.push(fournisseur);
}

/** Pour les tests : on repart d'une ardoise propre. */
export function oublieLesFournisseurs(): void {
  fournisseurs.length = 0;
}

function fournisseurPour(canal: CanalMessage): Fournisseur | null {
  return fournisseurs.find((f) => f.canaux.includes(canal)) ?? null;
}

/** Combien de messages attendent, et depuis quand. Sert à dire l'état sans rien envoyer. */
export async function fileEnAttente(): Promise<{ nombre: number; plusAncien: Date | null }> {
  const [nombre, plusAncien] = await Promise.all([
    prisma.messageSortant.count({ where: { statut: 'en_attente' } }),
    prisma.messageSortant.findFirst({
      where: { statut: 'en_attente' },
      orderBy: { creeLe: 'asc' },
      select: { creeLe: true },
    }),
  ]);
  return { nombre, plusAncien: plusAncien?.creeLe ?? null };
}

/**
 * Vide la file, autant que les règles le permettent.
 *
 * Les messages sont pris **du plus ancien au plus récent** : c'est l'ordre dans lequel ils ont
 * été écrits, donc celui dans lequel ils ont un sens. Inverser ferait arriver la relance avant
 * la proposition qu'elle relance.
 *
 * Le lot est borné. Un travail qui essaierait de vider une file de plusieurs milliers de
 * messages d'un seul coup tiendrait la base ouverte pendant des minutes et ne rendrait jamais
 * la main ; il vaut mieux en passer deux cents par minute, indéfiniment.
 */
export async function expedieLesMessages(
  maintenant: Date = new Date(),
  taille = 200,
): Promise<BilanExpedition> {
  const messages = await prisma.messageSortant.findMany({
    where: { statut: 'en_attente' },
    orderBy: { creeLe: 'asc' },
    take: taille,
    select: {
      id: true,
      canal: true,
      destinataire: true,
      sujet: true,
      corps: true,
      modele: true,
      statut: true,
      creeLe: true,
      tentatives: true,
      derniereTentativeLe: true,
    },
  });

  let envoyes = 0;
  let abandonnes = 0;
  let reportes = 0;
  let sansFournisseur = 0;

  for (const message of messages) {
    const decision = decideExpedition(message, maintenant);

    if (decision.action === 'abandonner') {
      // Abandonné, jamais effacé : la ligne reste, avec sa raison écrite. Un message disparu
      // en silence est un message dont personne ne saura qu'il n'est pas parti.
      await prisma.messageSortant.update({
        where: { id: message.id },
        data: { statut: 'echec', erreur: decision.raison },
      });
      abandonnes += 1;
      continue;
    }
    if (decision.action === 'attendre') {
      reportes += 1;
      continue;
    }

    const fournisseur = fournisseurPour(message.canal);
    if (fournisseur === null) {
      // On ne touche à rien. Le message attend un fournisseur, et c'est exactement son état :
      // le passer à `envoye` ferait disparaître la preuve que rien ne part.
      sansFournisseur += 1;
      continue;
    }

    let resultat: ResultatEnvoi;
    try {
      resultat = await fournisseur.envoie(message);
    } catch (erreur) {
      // Une exception d'adaptateur est un échec **passager** : on ne peut pas distinguer un
      // bogue d'une panne réseau, et fermer définitivement sur un doute perdrait le message.
      resultat = {
        ok: false,
        erreur: erreur instanceof Error ? erreur.message : 'erreur inconnue du fournisseur',
        definitif: false,
      };
    }

    const suite = apresEnvoi(resultat);
    await prisma.messageSortant.update({
      where: { id: message.id },
      data: {
        statut: suite.statut,
        erreur: suite.erreur,
        tentatives: { increment: 1 },
        derniereTentativeLe: maintenant,
        ...(resultat.ok ? { envoyeLe: maintenant, fournisseurId: resultat.fournisseurId } : {}),
      },
    });

    if (suite.statut === 'envoye') envoyes += 1;
    else if (suite.statut === 'echec') abandonnes += 1;
    else reportes += 1;
  }

  return { examines: messages.length, envoyes, abandonnes, reportes, sansFournisseur };
}
