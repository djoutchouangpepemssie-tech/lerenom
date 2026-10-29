import type { Formule } from './regles-validees.ts';
import type { Parametres } from './parametres.ts';

/**
 * La liste d'attente d'une place payée.
 *
 * Une zone — un métier, une commune — ne porte qu'un Exclusif et six Premium. Quand elle est
 * complète, un professionnel qui veut y entrer n'a aujourd'hui aucun moyen de le dire, et Le
 * Renom aucun moyen de le savoir. C'est pourtant le seul moment où la rareté qu'on vend a une
 * valeur mesurable : savoir que quatre plombiers attendent une place à Montreuil vaut plus
 * qu'un tableau de recettes.
 *
 * ## Ce que l'inscription à la liste n'est pas
 *
 * **Ce n'est pas une commande.** Personne n'est facturé, personne n'est engagé, et la place
 * qui se libère n'est pas attribuée d'office : le premier de la liste est **prévenu**, et il
 * décide. Attribuer automatiquement créerait un abonnement que personne n'a confirmé — avec,
 * pour l'Exclusif, douze mois d'engagement signés par un silence.
 *
 * ## L'ordre est celui d'arrivée
 *
 * Premier inscrit, premier prévenu. C'est le seul ordre défendable sans décision commerciale :
 * classer par score favoriserait ceux qui n'ont pas besoin de la place, classer par ancienneté
 * d'inscription sur Le Renom punirait les nouveaux venus. Le choix est consigné dans
 * `QUESTIONS.md` §Q42 ; s'il change, il changera ici seul.
 */

export type RefusAttente =
  'place-libre' | 'deja-detenteur' | 'deja-inscrit' | 'formule-sans-emplacement';

export interface EtatZone {
  /** Le détenteur de l'Exclusif, s'il y en a un. */
  readonly exclusif: string | null;
  /** Les détenteurs d'emplacements Premium. */
  readonly premium: readonly string[];
  /** Les entreprises déjà inscrites sur la liste de cette formule, dans l'ordre d'arrivée. */
  readonly enAttente: readonly string[];
}

export interface DemandeAttente {
  readonly entrepriseId: string;
  readonly formule: Formule;
}

export type ReponseAttente =
  | { readonly accepte: true; readonly rang: number }
  | { readonly accepte: false; readonly raison: RefusAttente; readonly explication: string };

/**
 * Combien de places cette formule compte-t-elle sur une zone ?
 *
 * Seules deux formules occupent une place : l'Exclusif et le Premium. `gratuit` et `essentiel`
 * ne sont pas des emplacements — l'essentiel achète une fiche enrichie, pas un rang — et s'y
 * inscrire en liste d'attente n'aurait aucun objet.
 */
export function placesDeLaFormule(formule: Formule, parametres: Parametres): number {
  if (formule === 'exclusif') return parametres.emplacementsExclusif;
  if (formule === 'premium') return parametres.premiumMaxParMetierVille;
  return 0;
}

/**
 * Une entreprise peut-elle s'inscrire sur la liste d'attente de cette zone ?
 *
 * Quatre refus, et chacun protège d'une promesse creuse.
 *
 * **Place libre** : s'inscrire pour attendre une place disponible ferait patienter quelqu'un
 * qui pouvait entrer tout de suite. C'est le refus le plus important, parce qu'il est le seul
 * qui coûte un client.
 *
 * **Déjà détenteur** : on n'attend pas ce qu'on possède. Le cas se présente quand un Premium
 * veut passer Exclusif — légitime, mais c'est un changement de formule, pas une attente.
 *
 * **Déjà inscrit** : la seconde inscription ne ferait que reculer son propre rang si elle
 * était comptée, ou ne rien faire si elle ne l'était pas. Les deux sont déroutants.
 *
 * **Formule sans emplacement** : gratuit et essentiel n'achètent pas de rang.
 */
export function inscriptionPossible(
  zone: EtatZone,
  demande: DemandeAttente,
  parametres: Parametres,
): ReponseAttente {
  const places = placesDeLaFormule(demande.formule, parametres);
  if (places === 0) {
    return {
      accepte: false,
      raison: 'formule-sans-emplacement',
      explication:
        'Cette formule n’occupe pas de place en haut de page : il n’y a rien à attendre.',
    };
  }

  const detenteurs = demande.formule === 'exclusif' ? toExclusif(zone) : zone.premium;

  if (detenteurs.includes(demande.entrepriseId)) {
    return {
      accepte: false,
      raison: 'deja-detenteur',
      explication: 'Vous détenez déjà cette place sur cette zone.',
    };
  }

  if (detenteurs.length < places) {
    return {
      accepte: false,
      raison: 'place-libre',
      explication:
        'Une place est libre sur cette zone : elle se prend tout de suite, sans passer par une liste.',
    };
  }

  if (zone.enAttente.includes(demande.entrepriseId)) {
    return {
      accepte: false,
      raison: 'deja-inscrit',
      explication: 'Vous êtes déjà sur cette liste d’attente.',
    };
  }

  return { accepte: true, rang: zone.enAttente.length + 1 };
}

function toExclusif(zone: EtatZone): readonly string[] {
  return zone.exclusif === null ? [] : [zone.exclusif];
}

/**
 * Qui prévenir quand une place se libère ?
 *
 * Le premier de la liste, et lui seul. Prévenir tout le monde à la fois transformerait la
 * liste en course : le plus rapide gagnerait, l'ordre d'arrivée ne vaudrait plus rien, et on
 * aurait promis une place unique à six entreprises.
 *
 * Rend `null` quand personne n'attend — ce qui est le cas normal, et ne doit pas se lire
 * comme une erreur.
 */
export function prochainServi(zone: EtatZone): string | null {
  return zone.enAttente[0] ?? null;
}

/**
 * Les rangs après le départ d'une entreprise de la liste.
 *
 * Qu'elle ait été servie ou qu'elle se soit désinscrite, les suivants remontent d'un cran.
 * Sans ce recalcul, une liste de six finit par afficher les rangs 1, 4, 5 et 9 — exacts dans
 * l'ordre, absurdes à lire, et impossibles à annoncer à qui demande « je suis combinième ? ».
 */
export function rangsApresDepart(
  enAttente: readonly string[],
  partant: string,
): readonly { readonly entrepriseId: string; readonly rang: number }[] {
  return enAttente
    .filter((entrepriseId) => entrepriseId !== partant)
    .map((entrepriseId, index) => ({ entrepriseId, rang: index + 1 }));
}
