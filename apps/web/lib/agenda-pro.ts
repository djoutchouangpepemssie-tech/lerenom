import { prisma } from '@lerenom/db';
import {
  expirationProposition,
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
    statut: string;
    demande: { reference: string; clientPrenom: string } | null;
  } | null;
}): PlageAffichee {
  return {
    id: plage.id,
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
    select: { id: true, type: true, debutLe: true, finLe: true, expireLe: true },
  });

  return plages.map((plage) => ({
    id: plage.id,
    type: plage.type,
    debut: plage.debutLe,
    fin: plage.finLe,
    expireLe: plage.expireLe,
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
        ...(saisie.type === 'propose' ? { expireLe: expirationProposition(maintenant) } : {}),
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
