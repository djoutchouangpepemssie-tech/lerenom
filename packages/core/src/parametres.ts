/**
 * Les paramètres d'exploitation de la plateforme.
 *
 * Tout seuil, tout délai, tout poids, tout prix se règle ici — et depuis le back-office, où
 * chaque changement est historisé. Aucun composant, aucune route, aucun worker n'écrit une de
 * ces valeurs en dur : les règles de `packages/core` reçoivent toujours les paramètres en
 * argument. C'est ce qui permet à Arcel de changer un délai sans déploiement, et c'est ce qui
 * rend les règles testables avec des valeurs arbitraires.
 */

import type { Formule } from './regles-validees.ts';
import { REGLES_VALIDEES } from './regles-validees.ts';

export interface PoidsScore {
  /** Qualité des avis (note corrigée par le nombre d'avis). */
  readonly avis: number;
  /** Activité sur Le Renom : demandes traitées, connexions, mises à jour. */
  readonly activite: number;
  /** Pertinence pour le besoin, dont la proximité géographique. */
  readonly pertinence: number;
  /** Réactivité : taux et délai de réponse aux demandes reçues. */
  readonly reactivite: number;
  /** Fraîcheur de la fiche. */
  readonly fraicheur: number;
}

export interface Parametres {
  /** Classement naturel : poids de chaque critère du score de qualité. Somme = 1. */
  readonly poidsScore: PoidsScore;
  /** Moyenne bayésienne : nombre d'avis de référence (m dans la formule). */
  readonly avisDeReference: number;
  /** Note moyenne de repli quand le métier n'a pas encore d'historique (C dans la formule). */
  readonly noteMoyenneParDefaut: number;
  /** Une fiche payante sous cette note perd son emplacement sponsorisé, et n'est plus éligible. */
  readonly noteMinimale: number;

  /** Emplacements payés. */
  readonly emplacementsExclusif: number;
  readonly emplacementsPremium: number;
  readonly emplacementsPayesMax: number;
  readonly premiumMaxParMetierVille: number;
  /**
   * Sans Exclusif sur la zone, les Premium occupent-ils les places 1 et 2 ?
   * Choix par défaut de QUESTIONS.md Q2 : oui.
   */
  readonly premiumRemontentSansExclusif: boolean;

  /** Distribution d'une demande partagée. */
  readonly prosMaxParDemande: number;
  /** Minutes pendant lesquelles l'Exclusif de la zone reçoit la demande seul. */
  readonly minutesExclusiviteExclusif: number;
  /** Minutes (ouvrées) laissées aux autres pros pour répondre avant passage au suivant. */
  readonly minutesReponseAutresPros: number;
  /** Minutes d'avance des abonnés sur une demande urgente. */
  readonly minutesAvanceUrgence: number;
  /** Minutes avant d'alerter l'administrateur sur une urgence sans preneur. */
  readonly minutesAlerteUrgenceSansPreneur: number;
  /** Heures au-delà desquelles une demande n'est plus jamais proposée. */
  readonly heuresFraicheurDemande: number;
  /** Part du score de qualité dans le classement des pros non abonnés (le reste : proximité). */
  readonly partQualiteHorsAbonnes: number;
  /** Rayon d'intervention par défaut d'une agence, en kilomètres. */
  readonly rayonAgenceParDefautKm: number;
  /** Élargissement automatique des rayons quand personne n'accepte. */
  readonly facteurElargissementRayon: number;

  /** Quotas et forfaits. */
  /** Part du forfait à partir de laquelle le pro et l'administrateur sont alertés. */
  readonly seuilAlerteForfait: number;
  /** Demandes directes visibles par mois pour une fiche gratuite. */
  readonly demandesDirectesGratuit: number;
  /** Heures laissées à un Gratuit au quota atteint avant de proposer d'autres pros au client. */
  readonly heuresAvantReportDemandeDirecte: number;

  /** Suivi d'une demande acceptée. */
  /** Heures sans appel tracé au client avant que la demande soit proposée à un autre pro. */
  readonly heuresAppelTrace: number;
  /** Nombre d'appels sans réponse ouvrant droit à déclarer le client injoignable. */
  readonly appelsAvantInjoignable: number;
  /** Fenêtre, en heures, dans laquelle ces appels doivent avoir lieu. */
  readonly heuresFenetreInjoignable: number;
  /** Jours laissés au pro pour contester une demande facturée. */
  readonly joursContestation: number;
  /** Heures dont dispose Le Renom pour trancher une contestation. */
  readonly heuresTraitementContestation: number;
  /** Taux de contestation d'un pro au-delà duquel une vérification est déclenchée. */
  readonly seuilAlerteTauxContestation: number;
  /**
   * Minutes après l'acceptation pendant lesquelles l'annulation par le client ouvre droit à
   * un recrédit automatique. Le professionnel a payé des coordonnées qu'il n'a pas eu le
   * temps d'utiliser : les lui facturer serait indéfendable. Passé ce délai, il a pu appeler,
   * et le recrédit redevient une affaire d'instruction.
   */
  readonly minutesAnnulationRecreditee: number;

  /** Messages au client. */
  readonly joursControleClient: number;
  readonly joursDemandeAvis: number;
  /**
   * Jours après l'acceptation au bout desquels on demande au client si l'intervention a eu
   * lieu, quand le professionnel n'a rien déclaré. Sans cette question, un pro qui ne déclare
   * jamais ses chantiers n'a jamais d'avis — donc jamais de mauvais avis.
   */
  readonly joursConfirmationIntervention: number;
  /** Jours entre deux relances « l'intervention a-t-elle eu lieu ? ». */
  readonly joursEntreRelancesConfirmation: number;
  /** Relances maximum avant d'abandonner. On interroge, on ne harcèle pas. */
  readonly relancesConfirmationMax: number;
  readonly joursRelanceDevis: number;
  readonly heuresRelanceCreneau: number;

  /** Facturation Le Renom. */
  readonly tauxTvaLeRenom: number;
  readonly prixOptionVisibilitePartout: number;
  readonly prixMiseEnAvantAuClic: number;

  /** Conformité. */
  /** Mois de conservation d'une demande, affichés dans la politique de confidentialité. */
  readonly moisConservationDemandes: number;

  /** Classement automatique des demandes. */
  /** Confiance minimale pour distribuer sans relecture humaine. */
  readonly confianceClassementAutomatique: number;

  /** Valeurs validées, recopiées pour que les règles n'aient qu'une source à lire. */
  readonly prixMensuelHT: Readonly<Record<Formule, number>>;
  readonly demandesIncluses: Readonly<Record<Formule, number>>;
  readonly prixDemandePartagee: Readonly<Record<Formule, number>>;
  readonly prixDemandeUrgente: Readonly<Record<Formule, number | null>>;
  readonly villesMax: Readonly<Record<Formule, number | null>>;
  readonly agencesMax: Readonly<Record<Formule, number | null>>;
  readonly garantieExclusif: {
    readonly moisConsecutifs: number;
    readonly demandesMinimum: number;
    readonly tauxReponseMinimum: number;
    readonly ficheCompleteRequise: boolean;
  };
}

export const PARAMETRES_PAR_DEFAUT: Parametres = Object.freeze({
  poidsScore: Object.freeze({
    avis: 0.3,
    activite: 0.25,
    pertinence: 0.2,
    reactivite: 0.15,
    fraicheur: 0.1,
  }),
  avisDeReference: 10,
  noteMoyenneParDefaut: 4.3,
  noteMinimale: 3.5,

  emplacementsExclusif: REGLES_VALIDEES.emplacementsExclusif,
  emplacementsPremium: REGLES_VALIDEES.emplacementsPremium,
  emplacementsPayesMax: REGLES_VALIDEES.emplacementsPayesMax,
  premiumMaxParMetierVille: REGLES_VALIDEES.premiumMaxParMetierVille,
  premiumRemontentSansExclusif: true,

  prosMaxParDemande: REGLES_VALIDEES.prosMaxParDemande,
  minutesExclusiviteExclusif: 30,
  minutesReponseAutresPros: 120,
  minutesAvanceUrgence: 5,
  minutesAlerteUrgenceSansPreneur: 10,
  heuresFraicheurDemande: REGLES_VALIDEES.heuresFraicheurDemande,
  partQualiteHorsAbonnes: 0.6,
  rayonAgenceParDefautKm: 10,
  facteurElargissementRayon: 1.5,

  seuilAlerteForfait: 0.8,
  demandesDirectesGratuit: 3,
  heuresAvantReportDemandeDirecte: 24,

  heuresAppelTrace: 24,
  appelsAvantInjoignable: 3,
  heuresFenetreInjoignable: 48,
  joursContestation: 7,
  heuresTraitementContestation: 48,
  seuilAlerteTauxContestation: 0.15,
  minutesAnnulationRecreditee: 60,

  joursControleClient: 2,
  joursDemandeAvis: 15,
  joursConfirmationIntervention: 7,
  joursEntreRelancesConfirmation: 7,
  relancesConfirmationMax: 2,
  joursRelanceDevis: 3,
  heuresRelanceCreneau: 24,

  tauxTvaLeRenom: 0.2,
  prixOptionVisibilitePartout: 29,
  prixMiseEnAvantAuClic: 1,

  moisConservationDemandes: 24,

  confianceClassementAutomatique: 0.7,

  prixMensuelHT: REGLES_VALIDEES.prixMensuelHT,
  demandesIncluses: REGLES_VALIDEES.demandesIncluses,
  prixDemandePartagee: REGLES_VALIDEES.prixDemandePartagee,
  prixDemandeUrgente: REGLES_VALIDEES.prixDemandeUrgente,
  villesMax: REGLES_VALIDEES.villesMax,
  agencesMax: REGLES_VALIDEES.agencesMax,
  garantieExclusif: REGLES_VALIDEES.garantieExclusif,
});

/** Construit un jeu de paramètres en partant des valeurs par défaut. Utile aux tests et au back-office. */
export function avecParametres(remplacements: Partial<Parametres>): Parametres {
  return Object.freeze({ ...PARAMETRES_PAR_DEFAUT, ...remplacements });
}

/** La somme des poids du score doit valoir 1 : un classement dont les poids dérivent n'est plus comparable. */
export function sommePoidsScore(poids: PoidsScore): number {
  return poids.avis + poids.activite + poids.pertinence + poids.reactivite + poids.fraicheur;
}
