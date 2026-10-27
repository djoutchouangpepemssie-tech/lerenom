/**
 * Les 15 décisions validées par Arcel le 27 octobre 2026.
 *
 * Ce fichier est la seule source de vérité de ces valeurs. Elles ne se changent pas sans une
 * décision d'Arcel : les tests de `regles-validees.test.ts` échouent si l'une d'elles bouge.
 *
 * Le reste du code ne lit jamais ces constantes directement : il lit les paramètres
 * (`parametres.ts`), qui sont historisés et modifiables depuis le back-office et dont ces
 * valeurs sont les valeurs par défaut. La distinction compte : un prix validé est une décision
 * commerciale, un paramètre est un réglage d'exploitation.
 */

/** Les quatre formules, de la moins à la plus engageante. */
export const FORMULES = ['gratuit', 'essentiel', 'premium', 'exclusif'] as const;
export type Formule = (typeof FORMULES)[number];

/** Rang d'une formule, pour comparer deux formules entre elles. */
export const RANG_FORMULE: Readonly<Record<Formule, number>> = Object.freeze({
  gratuit: 0,
  essentiel: 1,
  premium: 2,
  exclusif: 3,
});

export const REGLES_VALIDEES = Object.freeze({
  /** Règle 1 — Prix des formules, en euros HT par mois. */
  prixMensuelHT: Object.freeze({ gratuit: 0, essentiel: 29, premium: 79, exclusif: 229 }),

  /** Règle 1 — Paiement annuel : 2 mois offerts, soit 10 mois payés. */
  moisPayesEnAnnuel: 10,

  /** Règle 1 — Seul l'Exclusif est engagé, pour 12 mois. */
  moisEngagement: Object.freeze({ gratuit: 0, essentiel: 0, premium: 0, exclusif: 12 }),

  /** Règle 2 — Demandes partagées incluses dans le forfait mensuel. */
  demandesIncluses: Object.freeze({ gratuit: 0, essentiel: 0, premium: 5, exclusif: 15 }),

  /**
   * Règle 2 — Prix d'une demande partagée, en euros HT.
   * Gratuit et Essentiel n'ont pas de forfait : chaque demande est à 15 €.
   * Premium et Exclusif paient ce prix une fois leur forfait épuisé.
   */
  prixDemandePartagee: Object.freeze({ gratuit: 15, essentiel: 15, premium: 12, exclusif: 9 }),

  /**
   * Règle 3 — Demande urgente (intervention sous 2 h), en euros HT.
   * Réservée aux formules payantes, facturée à part, ne consomme pas le forfait.
   * `null` = la formule n'y a pas accès.
   */
  prixDemandeUrgente: Object.freeze({
    gratuit: null,
    essentiel: 25,
    premium: 20,
    exclusif: 15,
  }),

  /** Règle 4 — Nombre de villes où le pro peut apparaître. `null` = sans limite. */
  villesMax: Object.freeze({ gratuit: 2, essentiel: 5, premium: 15, exclusif: null }),

  /** Règle 5 — Nombre d'adresses d'agence. `null` = sans limite. */
  agencesMax: Object.freeze({ gratuit: 1, essentiel: 1, premium: 3, exclusif: null }),

  /** Règle 6 — Un emplacement Exclusif et deux emplacements Premium, jamais plus. */
  emplacementsExclusif: 1,
  emplacementsPremium: 2,
  /** Règle 6 — Plafond absolu d'emplacements payés sur une page de résultats. */
  emplacementsPayesMax: 3,
  /** Rareté contrôlée : au-delà, liste d'attente (au moins un affichage sur trois chacun). */
  premiumMaxParMetierVille: 6,

  /** Règle 8 — Le refus est gratuit et motivé ; l'acceptation est définitive. */
  acceptationDefinitive: true,
  motifRefusObligatoire: true,

  /** Règle 9 — Le client n'a ni compte ni tableau de bord. */
  espaceClient: false,

  /** Règle 11 — Garantie Exclusif. */
  garantieExclusif: Object.freeze({
    moisConsecutifs: 3,
    demandesMinimum: 5,
    tauxReponseMinimum: 0.8,
    ficheCompleteRequise: true,
  }),

  /** Règle 12 — Aucun contenu de référencement visible sur le site public. */
  contenuSeoVisible: false,

  /** Règle 13 — Catalogue annoncé. Les compteurs affichés sont calculés, jamais écrits en dur. */
  catalogueAnnonce: Object.freeze({ univers: 18, metiers: 69, prestations: 479 }),

  /** Règle 15 — Jamais plus de 3 pros par demande, jamais de revente après 72 heures. */
  prosMaxParDemande: 3,
  heuresFraicheurDemande: 72,
} as const);

/** Prix annuel HT d'une formule : 10 mois payés pour 12. */
export function prixAnnuelHT(formule: Formule): number {
  return REGLES_VALIDEES.prixMensuelHT[formule] * REGLES_VALIDEES.moisPayesEnAnnuel;
}
