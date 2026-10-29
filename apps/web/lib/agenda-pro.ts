import { prisma } from '@lerenom/db';
import { creeLien } from '@lerenom/liens';
import {
  MESSAGE_REFUS,
  expirationProposition,
  heureDe,
  peutAnnuler,
  occupeEncore,
  problemesPlage,
  semaineDe,
  type PlageExistante,
  type ProblemePlage,
  type SaisiePlage,
  type TypePlage,
} from '@lerenom/core';

/**
 * L'agenda d'un professionnel.
 *
 * Les règles vivent dans `@lerenom/core` ; ce fichier les branche sur la base. Son seul
 * travail délicat est le **chevauchement**, et il mérite d'être expliqué.
 *
 * Vérifier qu'une plage est libre puis l'écrire, en deux temps, ne garantit rien : deux
 * requêtes simultanées lisent chacune un agenda libre, puis écrivent chacune la leur. La
 * base porte donc une contrainte d'exclusion — `creneaux_sans_chevauchement` — qui est la
 * seule garantie réelle. Le contrôle applicatif sert à **dire lequel** des rendez-vous gêne,
 * ce qu'une violation de contrainte ne dira jamais ; la contrainte sert à ce que la règle
 * soit vraie.
 *
 * Les créneaux **proposés** échappent à la contrainte : ils cessent d'occuper leur horaire à
 * leur expiration, et `now()` ne peut pas entrer dans un index. Cette part-là est arbitrée
 * ici, et c'est aussi ici qu'on fait le ménage.
 */

export interface PlageAffichee {
  readonly id: string;
  /** L'identifiant du rendez-vous, quand la plage en porte un : l'annulation passe par lui. */
  readonly rendezVousId: string | null;
  readonly type: TypePlage;
  readonly debut: Date;
  readonly fin: Date;
  readonly expireLe: Date | null;
  readonly agenceNom: string | null;
  readonly clientNom: string | null;
  readonly demandeReference: string | null;
  readonly statutRendezVous: string | null;
}

function affichee(plage: {
  id: string;
  type: TypePlage;
  debutLe: Date;
  finLe: Date;
  expireLe: Date | null;
  agence: { nom: string | null } | null;
  rendezVous: {
    id: string;
    statut: string;
    demande: { reference: string; clientPrenom: string } | null;
  } | null;
}): PlageAffichee {
  return {
    id: plage.id,
    rendezVousId: plage.rendezVous?.id ?? null,
    type: plage.type,
    debut: plage.debutLe,
    fin: plage.finLe,
    expireLe: plage.expireLe,
    agenceNom: plage.agence?.nom ?? null,
    clientNom: plage.rendezVous?.demande?.clientPrenom ?? null,
    demandeReference: plage.rendezVous?.demande?.reference ?? null,
    statutRendezVous: plage.rendezVous?.statut ?? null,
  };
}

const INCLUSIONS = {
  agence: { select: { nom: true } },
  rendezVous: {
    select: {
      id: true,
      statut: true,
      demande: { select: { reference: true, clientPrenom: true } },
    },
  },
} as const;

/**
 * Les plages de la semaine qui contient `jour`, propositions mortes exclues.
 *
 * Exclues de l'affichage, pas de la base : une proposition expirée reste une trace de ce
 * qu'on a offert à un client, et le back-office pourra vouloir la lire. Elle n'encombre
 * simplement plus la vue de la semaine.
 */
export async function semaineDuPro(
  entrepriseId: string,
  jour: Date,
  maintenant: Date = new Date(),
): Promise<{ readonly jours: readonly Date[]; readonly plages: readonly PlageAffichee[] }> {
  const jours = semaineDe(jour);
  const premier = jours[0];
  const dernier = jours[6];
  if (premier === undefined || dernier === undefined) throw new Error('semaine incomplète');

  const finSemaine = new Date(dernier);
  finSemaine.setDate(finSemaine.getDate() + 1);

  const plages = await prisma.creneau.findMany({
    where: { entrepriseId, debutLe: { lt: finSemaine }, finLe: { gt: premier } },
    orderBy: { debutLe: 'asc' },
    select: {
      id: true,
      type: true,
      debutLe: true,
      finLe: true,
      expireLe: true,
      annuleLe: true,
      ...INCLUSIONS,
    },
  });

  const vivantes = plages.filter((plage) =>
    occupeEncore(
      {
        id: plage.id,
        type: plage.type,
        debut: plage.debutLe,
        fin: plage.finLe,
        expireLe: plage.expireLe,
        annuleLe: plage.annuleLe,
      },
      maintenant,
    ),
  );

  return { jours, plages: vivantes.map(affichee) };
}

export type ResultatPlage =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly problemes: readonly ProblemePlage[] };

/** Les plages déjà posées qui pourraient gêner, hors celle qu'on modifie. */
async function voisines(
  entrepriseId: string,
  saisie: SaisiePlage,
  sauf: string | null,
): Promise<readonly PlageExistante[]> {
  // Une journée de marge de part et d'autre : assez pour attraper tout chevauchement
  // possible, sans charger l'agenda entier.
  const debut = new Date(saisie.debut);
  debut.setDate(debut.getDate() - 1);
  const fin = new Date(saisie.fin);
  fin.setDate(fin.getDate() + 1);

  const plages = await prisma.creneau.findMany({
    where: {
      entrepriseId,
      debutLe: { lt: fin },
      finLe: { gt: debut },
      ...(sauf !== null ? { id: { not: sauf } } : {}),
    },
    select: {
      id: true,
      type: true,
      debutLe: true,
      finLe: true,
      expireLe: true,
      annuleLe: true,
    },
  });

  return plages.map((plage) => ({
    id: plage.id,
    type: plage.type,
    debut: plage.debutLe,
    fin: plage.finLe,
    expireLe: plage.expireLe,
    annuleLe: plage.annuleLe,
  }));
}

/** Traduit une violation de la contrainte d'exclusion en un problème lisible. */
function conflitDeBase(erreur: unknown): readonly ProblemePlage[] | null {
  // `in` rétrécit déjà le type : l'assertion qui suivait ne disait rien de plus, et le lint
  // avait raison de la refuser. Le message reste traité comme inconnu jusqu'au bout.
  const brut =
    typeof erreur === 'object' && erreur !== null && 'message' in erreur ? erreur.message : '';
  const message = typeof brut === 'string' ? brut : '';
  if (!message.includes('creneaux_sans_chevauchement')) return null;
  return [
    {
      champ: 'chevauchement',
      message: 'Une autre plage vient d’être posée sur cet horaire. Rechargez votre agenda.',
    },
  ];
}

export async function poseLaPlage(
  entrepriseId: string,
  saisie: SaisiePlage,
  agenceId: string | null = null,
  maintenant: Date = new Date(),
): Promise<ResultatPlage> {
  const problemes = problemesPlage(saisie, await voisines(entrepriseId, saisie, null), maintenant);
  if (problemes.length > 0) return { ok: false, problemes };

  try {
    const cree = await prisma.creneau.create({
      data: {
        entrepriseId,
        agenceId,
        type: saisie.type,
        debutLe: saisie.debut,
        finLe: saisie.fin,
        propose: saisie.type === 'propose',
        ...(saisie.type === 'propose'
          ? { expireLe: expirationProposition(maintenant, saisie.debut) }
          : {}),
      },
      select: { id: true },
    });
    return { ok: true, id: cree.id };
  } catch (erreur) {
    const conflit = conflitDeBase(erreur);
    if (conflit !== null) return { ok: false, problemes: conflit };
    throw erreur;
  }
}

export async function deplaceLaPlage(
  entrepriseId: string,
  plageId: string,
  saisie: SaisiePlage,
  maintenant: Date = new Date(),
): Promise<ResultatPlage> {
  const existante = await prisma.creneau.findFirst({
    where: { id: plageId, entrepriseId },
    select: { id: true, rendezVous: { select: { statut: true } } },
  });
  if (existante === null) {
    return { ok: false, problemes: [{ champ: 'debut', message: 'Cette plage n’existe pas.' }] };
  }

  // Un rendez-vous confirmé ne se déplace pas en silence : le client l'a noté. On refuse, et
  // l'écran renvoie vers l'annulation, qui, elle, prévient.
  if (existante.rendezVous?.statut === 'confirme') {
    return {
      ok: false,
      problemes: [
        {
          champ: 'debut',
          message:
            'Ce rendez-vous est confirmé par le client. Annulez-le pour en proposer un autre : il doit être prévenu.',
        },
      ],
    };
  }

  const problemes = problemesPlage(
    saisie,
    await voisines(entrepriseId, saisie, plageId),
    maintenant,
  );
  if (problemes.length > 0) return { ok: false, problemes };

  try {
    await prisma.creneau.update({
      where: { id: plageId },
      data: { type: saisie.type, debutLe: saisie.debut, finLe: saisie.fin },
    });
    return { ok: true, id: plageId };
  } catch (erreur) {
    const conflit = conflitDeBase(erreur);
    if (conflit !== null) return { ok: false, problemes: conflit };
    throw erreur;
  }
}

export type ResultatSuppression =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

export async function retireLaPlage(
  entrepriseId: string,
  plageId: string,
): Promise<ResultatSuppression> {
  const plage = await prisma.creneau.findFirst({
    where: { id: plageId, entrepriseId },
    select: { rendezVous: { select: { statut: true } } },
  });
  if (plage === null) return { ok: false, message: 'Cette plage n’existe pas.' };

  if (plage.rendezVous?.statut === 'confirme') {
    return {
      ok: false,
      message:
        'Ce rendez-vous est confirmé par le client. Annulez-le plutôt que de l’effacer : il doit être prévenu.',
    };
  }

  await prisma.creneau.delete({ where: { id: plageId } });
  return { ok: true };
}

/* ------------------------------------------------------------------------- */
/* Les rendez-vous : ce qui s'adresse au client                              */
/* ------------------------------------------------------------------------- */

export type ResultatProposition =
  | { readonly ok: true; readonly id: string; readonly canaux: readonly ('email' | 'sms')[] }
  | { readonly ok: false; readonly problemes: readonly ProblemePlage[] };

/**
 * Propose un créneau à un client, et le lui adresse.
 *
 * La plage est réservée dès l'envoi — sinon le professionnel la vendrait deux fois en
 * attendant la réponse — mais elle se libère seule au bout de quarante-huit heures. Le lien
 * envoyé est à usage unique : accepter ou décliner ne se refait pas.
 *
 * Comme pour le devis, un échec d'envoi ne défait pas la proposition : elle existe, elle
 * occupe l'agenda, et l'écran dit par où elle est partie — ou qu'elle n'est partie nulle part.
 */
export async function proposeAuClient(
  entrepriseId: string,
  saisie: SaisiePlage,
  clientId: string,
  maintenant: Date = new Date(),
): Promise<ResultatProposition> {
  const client = await prisma.clientPro.findFirst({
    where: { id: clientId, entrepriseId },
    select: { nom: true, email: true, telephone: true },
  });
  if (client === null) {
    return {
      ok: false,
      problemes: [{ champ: 'debut', message: 'Ce client n’existe pas.' }],
    };
  }

  const problemes = problemesPlage(
    { ...saisie, type: 'propose' },
    await voisines(entrepriseId, saisie, null),
    maintenant,
  );
  if (problemes.length > 0) return { ok: false, problemes };

  const entreprise = await prisma.entreprise.findUniqueOrThrow({
    where: { id: entrepriseId },
    select: { nom: true },
  });

  const rendezVousId = await prisma.$transaction(async (tx) => {
    const plage = await tx.creneau.create({
      data: {
        entrepriseId,
        type: 'propose',
        debutLe: saisie.debut,
        finLe: saisie.fin,
        propose: true,
        expireLe: expirationProposition(maintenant, saisie.debut),
        rendezVous: { create: { statut: 'propose', clientId } },
      },
      select: { rendezVous: { select: { id: true } } },
    });
    const id = plage.rendezVous?.id;
    if (id === undefined) throw new Error('rendez-vous non créé');
    return id;
  });

  const lien = await creeLien(null, 'choisir_creneau', rendezVousId);
  const quand = `${jourLisible(saisie.debut)} de ${heureDe(saisie.debut)} à ${heureDe(saisie.fin)}`;

  const messages: {
    canal: 'email' | 'sms';
    destinataire: string;
    sujet: string | null;
    corps: string;
  }[] = [];
  if (client.email !== null) {
    messages.push({
      canal: 'email',
      destinataire: client.email,
      sujet: `Proposition de rendez-vous — ${entreprise.nom}`,
      corps: `Bonjour,\n\n${entreprise.nom} vous propose un rendez-vous ${quand}.\n\nPour l'accepter ou proposer autre chose :\n${lien.url}\n\nSans réponse de votre part sous deux jours, le créneau sera remis à disposition.`,
    });
  }
  if (client.telephone !== null) {
    messages.push({
      canal: 'sms',
      destinataire: client.telephone,
      sujet: null,
      corps: `${entreprise.nom} vous propose un rendez-vous ${quand}. Répondez ici : ${lien.url}`,
    });
  }

  if (messages.length > 0) {
    await prisma.messageSortant.createMany({
      data: messages.map((message) => ({
        canal: message.canal,
        modele: 'rendez-vous-propose',
        destinataire: message.destinataire,
        sujet: message.sujet,
        corps: message.corps,
        statut: 'en_attente' as const,
      })),
    });
  }

  return { ok: true, id: rendezVousId, canaux: messages.map((message) => message.canal) };
}

/** « mardi 3 mars » — la date telle qu'on la dit au téléphone. */
function jourLisible(date: Date): string {
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois = [
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
  const quantieme = date.getDate() === 1 ? '1er' : String(date.getDate());
  return `${jours[date.getDay()] ?? ''} ${quantieme} ${mois[date.getMonth()] ?? ''}`;
}

/**
 * Le professionnel annule un rendez-vous, et le client en est prévenu.
 *
 * C'est la sortie qui manquait : un rendez-vous confirmé ne se déplace pas en silence, mais
 * il fallait bien pouvoir s'en défaire. L'annulation libère la plage **et** écrit au client —
 * les deux ensemble, sans quoi l'une des deux finirait par manquer.
 */
export async function annuleLeRendezVous(
  entrepriseId: string,
  rendezVousId: string,
  motif: string,
): Promise<ResultatSuppression> {
  const rendezVous = await prisma.rendezVous.findFirst({
    where: { id: rendezVousId, creneau: { entrepriseId } },
    select: {
      statut: true,
      creneauId: true,
      creneau: { select: { debutLe: true, finLe: true, expireLe: true } },
      client: { select: { email: true, telephone: true } },
      demande: { select: { clientEmail: true, clientTelephone: true } },
    },
  });
  if (rendezVous === null) return { ok: false, message: 'Ce rendez-vous n’existe pas.' };

  const verdict = peutAnnuler({
    statut: rendezVous.statut,
    debut: rendezVous.creneau.debutLe,
    expireLe: rendezVous.creneau.expireLe,
  });
  if (!verdict.ok) return { ok: false, message: MESSAGE_REFUS[verdict.refus] };

  const entreprise = await prisma.entreprise.findUniqueOrThrow({
    where: { id: entrepriseId },
    select: { nom: true },
  });
  const quand = `${jourLisible(rendezVous.creneau.debutLe)} à ${heureDe(rendezVous.creneau.debutLe)}`;

  await prisma.$transaction(async (tx) => {
    await tx.rendezVous.update({
      where: { id: rendezVousId },
      data: { statut: 'annule', annuleLe: new Date() },
    });
    // La plage est **marquée** annulée, pas effacée : l'effacer emporterait le rendez-vous
    // en cascade, et un rendez-vous annulé est une trace. Elle cesse d'occuper son horaire,
    // la contrainte d'exclusion l'ignore, et l'agenda ne la montre plus.
    await tx.creneau.update({
      where: { id: rendezVous.creneauId },
      data: { annuleLe: new Date() },
    });
  });

  const email = rendezVous.client?.email ?? rendezVous.demande?.clientEmail ?? null;
  const telephone = rendezVous.client?.telephone ?? rendezVous.demande?.clientTelephone ?? null;
  const texte = `${entreprise.nom} a dû annuler votre rendez-vous du ${quand}.${motif.trim() === '' ? '' : ` Motif : ${motif.trim()}`} L'entreprise vous recontacte pour convenir d'une autre date.`;

  const messages: { canal: 'email' | 'sms'; destinataire: string; sujet: string | null }[] = [];
  if (email !== null) {
    messages.push({ canal: 'email', destinataire: email, sujet: 'Votre rendez-vous est annulé' });
  }
  if (telephone !== null) messages.push({ canal: 'sms', destinataire: telephone, sujet: null });

  if (messages.length > 0) {
    await prisma.messageSortant.createMany({
      data: messages.map((message) => ({
        canal: message.canal,
        modele: 'rendez-vous-annule',
        destinataire: message.destinataire,
        sujet: message.sujet,
        corps: texte,
        statut: 'en_attente' as const,
      })),
    });
  }

  return { ok: true };
}

/** Les clients du professionnel, pour choisir à qui proposer un créneau. */
export async function clientsDuPro(
  entrepriseId: string,
): Promise<readonly { readonly id: string; readonly nom: string }[]> {
  return prisma.clientPro.findMany({
    where: { entrepriseId },
    orderBy: { nom: 'asc' },
    select: { id: true, nom: true },
  });
}
