/**
 * Le score de qualité : le classement naturel, celui que le paiement n'influence jamais.
 *
 * Recalculé chaque nuit par le worker et stocké comme attribut de tri dans le moteur de
 * recherche. Aucune page de résultats ne le calcule au moment de l'affichage.
 */

import type { Parametres, PoidsScore } from './parametres';
import { sommePoidsScore } from './parametres';

/** Les composantes du score, chacune déjà ramenée entre 0 et 1. */
export interface ComposantesScore {
  readonly avis: number;
  readonly activite: number;
  readonly pertinence: number;
  readonly reactivite: number;
  readonly fraicheur: number;
}

function borne01(valeur: number): number {
  if (Number.isNaN(valeur)) return 0;
  return Math.min(1, Math.max(0, valeur));
}

/**
 * Note corrigée par le nombre d'avis (moyenne bayésienne).
 *
 *     A = (v / (v + m)) × n + (m / (v + m)) × C
 *
 * où v est le nombre d'avis, n la note moyenne de l'entreprise, m le nombre d'avis de référence
 * et C la note moyenne du métier. Elle empêche un unique 5/5 de battre cinquante avis à 4,7.
 */
export function noteCorrigee(
  nombreAvis: number,
  noteMoyenne: number,
  noteMoyenneMetier: number,
  avisDeReference: number,
): number {
  const v = Math.max(0, nombreAvis);
  const m = Math.max(0, avisDeReference);
  if (v + m === 0) return noteMoyenneMetier;
  return (v * noteMoyenne + m * noteMoyenneMetier) / (v + m);
}

/** La note corrigée, ramenée entre 0 et 1 pour entrer dans le score (une note va de 1 à 5). */
export function composanteAvis(
  nombreAvis: number,
  noteMoyenne: number,
  noteMoyenneMetier: number,
  avisDeReference: number,
): number {
  const note = noteCorrigee(nombreAvis, noteMoyenne, noteMoyenneMetier, avisDeReference);
  return borne01((note - 1) / 4);
}

/**
 * Le score de qualité, entre 0 et 1.
 *
 * Chaque composante est bornée avant pondération : une donnée aberrante en base ne peut pas
 * faire sortir un score de l'intervalle, ni faire passer une entreprise devant toutes les autres.
 */
export function scoreQualite(composantes: ComposantesScore, poids: PoidsScore): number {
  return (
    borne01(composantes.avis) * poids.avis +
    borne01(composantes.activite) * poids.activite +
    borne01(composantes.pertinence) * poids.pertinence +
    borne01(composantes.reactivite) * poids.reactivite +
    borne01(composantes.fraicheur) * poids.fraicheur
  );
}

/**
 * Les poids viennent du back-office : on vérifie qu'ils somment à 1 avant de s'en servir.
 * Une tolérance d'un millième absorbe les arrondis de saisie.
 */
export function poidsValides(poids: PoidsScore): boolean {
  const valeurs = [poids.avis, poids.activite, poids.pertinence, poids.reactivite, poids.fraicheur];
  if (valeurs.some((v) => v < 0 || Number.isNaN(v))) return false;
  return Math.abs(sommePoidsScore(poids) - 1) <= 0.001;
}

/** Réactivité : taux de réponse et délai moyen, combinés en une composante entre 0 et 1. */
export function composanteReactivite(
  tauxReponse: number,
  delaiMoyenMinutes: number,
  delaiCibleMinutes = 60,
): number {
  const taux = borne01(tauxReponse);
  const rapidite =
    delaiMoyenMinutes <= 0
      ? 1
      : borne01(delaiCibleMinutes / Math.max(delaiCibleMinutes, delaiMoyenMinutes));
  return borne01(0.6 * taux + 0.4 * rapidite);
}

/** Fraîcheur : une fiche mise à jour aujourd'hui vaut 1, une fiche d'il y a un an vaut 0. */
export function composanteFraicheur(joursDepuisMiseAJour: number, joursReference = 365): number {
  if (joursReference <= 0) return 0;
  return borne01(1 - Math.max(0, joursDepuisMiseAJour) / joursReference);
}

/** Le score complet d'une entreprise, prêt à être stocké. */
export function calculeScore(
  entree: {
    readonly nombreAvis: number;
    readonly noteMoyenne: number;
    readonly noteMoyenneMetier: number;
    readonly activite: number;
    readonly pertinence: number;
    readonly tauxReponse: number;
    readonly delaiMoyenMinutes: number;
    readonly joursDepuisMiseAJour: number;
  },
  parametres: Parametres,
): number {
  return scoreQualite(
    {
      avis: composanteAvis(
        entree.nombreAvis,
        entree.noteMoyenne,
        entree.noteMoyenneMetier,
        parametres.avisDeReference,
      ),
      activite: entree.activite,
      pertinence: entree.pertinence,
      reactivite: composanteReactivite(entree.tauxReponse, entree.delaiMoyenMinutes),
      fraicheur: composanteFraicheur(entree.joursDepuisMiseAJour),
    },
    parametres.poidsScore,
  );
}
