/**
 * Le classement d'une page de résultats métier × ville.
 *
 * Deux mécanismes strictement séparés, dans cet ordre :
 *   1. les emplacements payés, au maximum 3, toujours étiquetés « Sponsorisé » ;
 *   2. le classement naturel par le score de qualité, où le paiement ne compte pour rien.
 *
 * Une entreprise affichée dans une place payée est retirée de la liste naturelle : jamais de
 * doublon. Une fiche payante dont la note est sous le minimum perd sa place sponsorisée et
 * retombe dans le classement naturel, à son rang réel.
 */

import type { Parametres } from './parametres.ts';
import type { Formule } from './regles-validees.ts';

export interface CandidatClassement {
  readonly entrepriseId: string;
  readonly formule: Formule;
  /** Score de qualité, entre 0 et 1, recalculé chaque nuit. */
  readonly score: number;
  /** Note moyenne affichée, ou `null` si l'entreprise n'a pas encore d'avis. */
  readonly note: number | null;
  /** L'entreprise détient-elle l'exclusivité de ce métier sur cette zone ? */
  readonly titulaireExclusivite?: boolean;
}

/** Pourquoi une entreprise occupe ce rang. Alimente le bouton « Pourquoi ce résultat ? ». */
export type RaisonRang = 'emplacement-exclusif' | 'emplacement-premium' | 'classement-naturel';

export interface LigneResultat {
  readonly entrepriseId: string;
  readonly rang: number;
  readonly sponsorise: boolean;
  readonly raison: RaisonRang;
  /** Part d'affichage de cette entreprise sur cet emplacement, pour le rapport mensuel. */
  readonly partAffichage?: number;
}

export interface PageResultats {
  readonly lignes: readonly LigneResultat[];
  /** Rang après lequel afficher le séparateur « Classement naturel ». 0 s'il n'y a aucun payé. */
  readonly dernierRangSponsorise: number;
}

/**
 * Rotation équitable : `places` places pour `candidats.length` abonnés.
 *
 * À chaque affichage, la fenêtre glisse d'un cran. Sur un cycle complet, chaque abonné apparaît
 * exactement `places` fois : avec 5 Premium pour 2 places, chacun est affiché 2 fois sur 5, soit
 * 40 % des affichages, ce qui est exactement la règle annoncée au client.
 */
export function rotationEquitable<T>(
  candidats: readonly T[],
  places: number,
  compteurAffichages: number,
): readonly T[] {
  if (places <= 0 || candidats.length === 0) return [];
  if (candidats.length <= places) return candidats;

  const n = candidats.length;
  // Le modulo de JavaScript garde le signe : on le ramène dans [0, n[ pour accepter un compteur
  // remis à zéro ou négatif sans casser l'équité.
  const depart = ((compteurAffichages % n) + n) % n;

  const fenetre: T[] = [];
  for (let i = 0; i < places; i += 1) {
    fenetre.push(candidats[(depart + i) % n]!);
  }
  return fenetre;
}

/** Part d'affichage d'un abonné sur un ensemble de places, entre 0 et 1. */
export function partAffichage(nombreAbonnes: number, places: number): number {
  if (nombreAbonnes <= 0 || places <= 0) return 0;
  return Math.min(1, places / nombreAbonnes);
}

/**
 * Un abonné garde-t-il droit à son emplacement payé ?
 * Une note sous le minimum le lui retire tant qu'elle n'est pas remontée ; une entreprise sans
 * avis n'est pas pénalisée, elle n'a simplement pas encore d'historique.
 */
export function droitEmplacementPaye(
  candidat: CandidatClassement,
  parametres: Parametres,
): boolean {
  if (candidat.note === null) return true;
  return candidat.note >= parametres.noteMinimale;
}

function parScoreDecroissant(a: CandidatClassement, b: CandidatClassement): number {
  if (b.score !== a.score) return b.score - a.score;
  // À score égal, l'ordre reste stable et prévisible : l'identifiant tranche. Sans cela, deux
  // affichages de la même page pourraient intervertir deux entreprises sans raison visible.
  return a.entrepriseId.localeCompare(b.entrepriseId);
}

/**
 * Classe une page de résultats.
 *
 * @param candidats toutes les entreprises éligibles à la page, abonnées ou non
 * @param compteurAffichages nombre d'affichages déjà servis pour cette page, qui fait tourner
 *                           les Premium ; passer la même valeur donne le même ordre
 */
export function classePageResultats(
  candidats: readonly CandidatClassement[],
  parametres: Parametres,
  compteurAffichages = 0,
): PageResultats {
  const lignes: LigneResultat[] = [];
  const dejaPlaces = new Set<string>();
  let rang = 0;

  const eligiblesPaye = candidats.filter((c) => droitEmplacementPaye(c, parametres));

  // 1. L'emplacement Exclusif : le titulaire de l'exclusivité métier × zone, et lui seul.
  const exclusifs = eligiblesPaye
    .filter((c) => c.formule === 'exclusif' && c.titulaireExclusivite === true)
    .sort(parScoreDecroissant)
    .slice(0, parametres.emplacementsExclusif);

  for (const titulaire of exclusifs) {
    rang += 1;
    lignes.push({
      entrepriseId: titulaire.entrepriseId,
      rang,
      sponsorise: true,
      raison: 'emplacement-exclusif',
      partAffichage: 1,
    });
    dejaPlaces.add(titulaire.entrepriseId);
  }

  // 2. Les emplacements Premium. Sans Exclusif sur la zone, ils remontent aux places 1 et 2
  //    (QUESTIONS.md Q2, choix par défaut), sans jamais dépasser le plafond de places payées.
  const placesPremium = Math.min(
    parametres.emplacementsPremium,
    Math.max(0, parametres.emplacementsPayesMax - lignes.length),
  );

  if (placesPremium > 0 && (exclusifs.length > 0 || parametres.premiumRemontentSansExclusif)) {
    const premiumInscrits = eligiblesPaye
      .filter((c) => c.formule === 'premium' && !dejaPlaces.has(c.entrepriseId))
      .sort(parScoreDecroissant)
      // Rareté contrôlée : au-delà du plafond, les suivants sont en liste d'attente et
      // n'entrent pas dans la rotation.
      .slice(0, parametres.premiumMaxParMetierVille);

    const part = partAffichage(premiumInscrits.length, placesPremium);

    for (const premium of rotationEquitable(premiumInscrits, placesPremium, compteurAffichages)) {
      rang += 1;
      lignes.push({
        entrepriseId: premium.entrepriseId,
        rang,
        sponsorise: true,
        raison: 'emplacement-premium',
        partAffichage: part,
      });
      dejaPlaces.add(premium.entrepriseId);
    }
  }

  const dernierRangSponsorise = rang;

  // 3. Le classement naturel : toutes les entreprises, abonnés compris, sans les doublons.
  for (const candidat of [...candidats].sort(parScoreDecroissant)) {
    if (dejaPlaces.has(candidat.entrepriseId)) continue;
    rang += 1;
    lignes.push({
      entrepriseId: candidat.entrepriseId,
      rang,
      sponsorise: false,
      raison: 'classement-naturel',
    });
  }

  return { lignes, dernierRangSponsorise };
}

/** Le texte affiché derrière « Pourquoi ce résultat ? ». Jamais un mot qui promette la qualité. */
export function expliqueRang(ligne: LigneResultat): string {
  switch (ligne.raison) {
    case 'emplacement-exclusif':
      return 'Emplacement sponsorisé. Cette entreprise est le seul partenaire Exclusif de ce métier sur cette zone. Son abonnement lui réserve la première place ; il ne dit rien de la qualité de son travail.';
    case 'emplacement-premium':
      return 'Emplacement sponsorisé. Cette entreprise est partenaire Premium : son abonnement lui donne accès à cet emplacement, partagé en rotation équitable avec les autres partenaires Premium du métier dans cette ville.';
    case 'classement-naturel':
      return 'Classement naturel. Cette position vient du score de qualité : avis, activité sur Le Renom, pertinence pour votre besoin, réactivité et fraîcheur de la fiche. Le paiement n’y entre pour rien.';
  }
}
