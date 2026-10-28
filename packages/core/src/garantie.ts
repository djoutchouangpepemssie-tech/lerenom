/**
 * La garantie Exclusif (règle validée n° 11).
 *
 * Si un Exclusif reçoit moins de 5 demandes sur 3 mois civils consécutifs, alors que sa fiche
 * est complète et qu'il a répondu à au moins 80 % des demandes reçues, le mois suivant est
 * offert. Une fois par période de 3 mois, et seulement après validation en un clic par Arcel :
 * la plateforme calcule et propose, elle n'offre pas toute seule un mois d'abonnement.
 *
 * Les conditions de fiche complète et de taux de réponse ne sont pas une clause d'exclusion
 * commode : elles évitent qu'un abonné inactif, qui laisse expirer ses demandes, se fasse
 * offrir un mois à cause de son propre silence.
 */

import type { Parametres } from './parametres.ts';

export interface MoisGarantie {
  /** Mois civil au format AAAA-MM. */
  readonly mois: string;
  /** Demandes valides reçues : directes et partagées, hors demandes contestées et remboursées. */
  readonly demandesValides: number;
}

export interface DossierGarantie {
  readonly mois: readonly MoisGarantie[];
  /** La fiche était-elle complète sur toute la période ? */
  readonly ficheComplete: boolean;
  /** Taux de réponse du pro sur la période, entre 0 et 1. */
  readonly tauxReponse: number;
  /** Une garantie a-t-elle déjà été accordée pour cette période de 3 mois ? */
  readonly dejaAccordee?: boolean;
}

export type RefusGarantie =
  | 'periode-incomplete'
  | 'assez-de-demandes'
  | 'fiche-incomplete'
  | 'taux-reponse-insuffisant'
  | 'deja-accordee';

export interface ResultatGarantie {
  readonly eligible: boolean;
  readonly demandesSurLaPeriode: number;
  readonly seuil: number;
  readonly motifRefus?: RefusGarantie;
  /** Phrase affichée dans l'espace pro et dans le back-office. */
  readonly explication: string;
}

export function evalueGarantieExclusif(
  dossier: DossierGarantie,
  parametres: Parametres,
): ResultatGarantie {
  const { moisConsecutifs, demandesMinimum, tauxReponseMinimum, ficheCompleteRequise } =
    parametres.garantieExclusif;

  const total = dossier.mois.reduce((somme, m) => somme + Math.max(0, m.demandesValides), 0);
  const base = { demandesSurLaPeriode: total, seuil: demandesMinimum };

  if (dossier.dejaAccordee === true) {
    return {
      ...base,
      eligible: false,
      motifRefus: 'deja-accordee',
      explication: 'Un mois a déjà été offert pour cette période de 3 mois.',
    };
  }

  if (dossier.mois.length < moisConsecutifs) {
    return {
      ...base,
      eligible: false,
      motifRefus: 'periode-incomplete',
      explication: `La garantie se calcule sur ${moisConsecutifs} mois civils consécutifs, à partir du premier mois complet d’abonnement. ${dossier.mois.length} mois disponibles pour l’instant.`,
    };
  }

  if (total >= demandesMinimum) {
    return {
      ...base,
      eligible: false,
      motifRefus: 'assez-de-demandes',
      explication: `${total} demandes valides reçues sur la période, pour un seuil de ${demandesMinimum}.`,
    };
  }

  if (ficheCompleteRequise && !dossier.ficheComplete) {
    return {
      ...base,
      eligible: false,
      motifRefus: 'fiche-incomplete',
      explication:
        'La fiche n’était pas complète sur toute la période : la garantie suppose une fiche qui donne aux visiteurs de quoi choisir.',
    };
  }

  if (dossier.tauxReponse < tauxReponseMinimum) {
    return {
      ...base,
      eligible: false,
      motifRefus: 'taux-reponse-insuffisant',
      explication: `Taux de réponse de ${Math.round(dossier.tauxReponse * 100)} %, pour un minimum de ${Math.round(tauxReponseMinimum * 100)} %.`,
    };
  }

  return {
    ...base,
    eligible: true,
    explication: `${total} demandes valides sur ${moisConsecutifs} mois, en dessous du seuil de ${demandesMinimum} : le mois suivant peut être offert, après validation.`,
  };
}
