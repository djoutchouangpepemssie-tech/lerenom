/**
 * Les contestations et les recrédits : quand Le Renom rend l'argent d'un professionnel.
 *
 * C'est le sujet le plus sensible de la plateforme, parce qu'il oppose deux intérêts
 * légitimes. Le professionnel a payé pour des coordonnées ; si elles ne valent rien, lui faire
 * payer quand même est indéfendable. Le Renom, de son côté, ne peut pas rembourser sur
 * déclaration, sinon chaque demande sans suite deviendrait une demande gratuite.
 *
 * La règle tient en une phrase : **on recrédite ce que Le Renom peut vérifier**, et rien
 * d'autre. Trois motifs se prouvent dans la base — appels tracés, doublon, annulation
 * immédiate — et sont accordés sans discussion. Les autres passent par un humain, qui motive
 * sa décision. Un motif démenti par les faits est refusé tout aussi automatiquement.
 */

export type MotifContestation =
  | 'coordonnees_fausses'
  | 'client_injoignable'
  | 'hors_zone'
  | 'hors_metier'
  | 'doublon'
  | 'demande_fantaisiste'
  | 'annulation_immediate';

/** Ce que Le Renom sait vérifier seul, et ce qui demande un œil. */
export const MOTIFS_CONTESTATION: Readonly<
  Record<MotifContestation, { readonly libelle: string; readonly verifiable: boolean }>
> = Object.freeze({
  client_injoignable: { libelle: 'Client injoignable', verifiable: true },
  doublon: { libelle: 'Demande en double', verifiable: true },
  annulation_immediate: { libelle: 'Annulée juste après acceptation', verifiable: true },
  coordonnees_fausses: { libelle: 'Coordonnées fausses', verifiable: false },
  hors_zone: { libelle: 'Hors de ma zone', verifiable: false },
  hors_metier: { libelle: 'Hors de mon métier', verifiable: false },
  demande_fantaisiste: { libelle: 'Demande fantaisiste', verifiable: false },
});

export interface EtatContestation {
  /** Quand la demande a été acceptée. Le délai de contestation part de là. */
  readonly accepteeLe: Date;
  /** La demande a-t-elle été facturée, ou prise sur le forfait ? Sinon il n'y a rien à rendre. */
  readonly montantHT: number;
  readonly consommeForfait: boolean;
  readonly dejaRecredite: boolean;
  readonly dejaContestee: boolean;
}

export type RecevabiliteContestation =
  | { readonly issue: 'recevable' }
  | { readonly issue: 'hors-delai'; readonly limite: Date }
  | { readonly issue: 'rien-a-rendre' }
  | { readonly issue: 'deja-recreditee' }
  | { readonly issue: 'deja-contestee' };

/**
 * La contestation est-elle recevable ?
 *
 * Le délai court depuis l'acceptation, pas depuis la facture : c'est à ce moment que le
 * professionnel a reçu les coordonnées, donc qu'il a pu constater le problème.
 */
export function contestationRecevable(
  etat: EtatContestation,
  joursContestation: number,
  maintenant: Date = new Date(),
): RecevabiliteContestation {
  if (etat.dejaRecredite) return { issue: 'deja-recreditee' };
  if (etat.dejaContestee) return { issue: 'deja-contestee' };
  if (etat.montantHT <= 0 && !etat.consommeForfait) return { issue: 'rien-a-rendre' };

  const limite = new Date(etat.accepteeLe.getTime() + joursContestation * 24 * 60 * 60 * 1000);
  if (maintenant.getTime() > limite.getTime()) return { issue: 'hors-delai', limite };

  return { issue: 'recevable' };
}

/** Les faits que Le Renom lit dans sa propre base pour instruire une contestation. */
export interface FaitsContestation {
  /** Appels tracés vers le client, restés sans réponse, dans la fenêtre prévue. */
  readonly appelsSansReponse: number;
  /** Le même pro a-t-il déjà reçu la même demande du même client récemment ? */
  readonly doublonAvere: boolean;
  /** Minutes écoulées entre l'acceptation et l'annulation par le client. `null` si pas annulée. */
  readonly minutesAvantAnnulation: number | null;
  /** Le client a-t-il confirmé que l'intervention a eu lieu ? Alors il n'y a rien à rendre. */
  readonly interventionConfirmee: boolean;
  /** Un contact a-t-il eu lieu — appel abouti, rendez-vous, devis ? */
  readonly contactEtabli: boolean;
}

export interface ReglesContestation {
  readonly appelsAvantInjoignable: number;
  readonly heuresFenetreInjoignable: number;
  /** Minutes après l'acceptation pendant lesquelles une annulation client est recréditée. */
  readonly minutesAnnulationRecreditee: number;
}

export type Instruction =
  | { readonly issue: 'recredit-de-droit'; readonly explication: string }
  | { readonly issue: 'refus-de-droit'; readonly explication: string }
  | { readonly issue: 'a-instruire'; readonly explication: string };

/**
 * Instruit une contestation à partir des faits.
 *
 * L'ordre compte. Une intervention confirmée par le client ferme le débat avant tout le
 * reste : quel que soit le motif invoqué, le professionnel a eu ce qu'il a payé. Viennent
 * ensuite les motifs que la base prouve, puis le reste, qui va à un humain.
 */
export function instruitContestation(
  motif: MotifContestation,
  faits: FaitsContestation,
  regles: ReglesContestation,
): Instruction {
  if (faits.interventionConfirmee) {
    return {
      issue: 'refus-de-droit',
      explication:
        'Le client a confirmé que l’intervention a eu lieu : la demande a produit son effet.',
    };
  }

  switch (motif) {
    case 'client_injoignable':
      if (faits.contactEtabli) {
        return {
          issue: 'refus-de-droit',
          explication: 'Un contact a été établi avec le client : il n’était pas injoignable.',
        };
      }
      if (faits.appelsSansReponse >= regles.appelsAvantInjoignable) {
        return {
          issue: 'recredit-de-droit',
          explication: `${String(faits.appelsSansReponse)} appels tracés sans réponse en ${String(regles.heuresFenetreInjoignable)} heures.`,
        };
      }
      return {
        issue: 'a-instruire',
        explication: `Moins de ${String(regles.appelsAvantInjoignable)} appels tracés : la preuve n’est pas faite dans la base.`,
      };

    case 'doublon':
      return faits.doublonAvere
        ? { issue: 'recredit-de-droit', explication: 'Doublon constaté dans la base.' }
        : { issue: 'a-instruire', explication: 'Aucun doublon visible dans la base.' };

    case 'annulation_immediate': {
      const minutes = faits.minutesAvantAnnulation;
      if (minutes === null) {
        return { issue: 'refus-de-droit', explication: 'La demande n’a pas été annulée.' };
      }
      if (faits.contactEtabli) {
        return {
          issue: 'refus-de-droit',
          explication: 'Le contact avait déjà eu lieu avant l’annulation.',
        };
      }
      if (minutes <= regles.minutesAnnulationRecreditee) {
        return {
          issue: 'recredit-de-droit',
          explication: `Annulée par le client ${String(Math.round(minutes))} minutes après l’acceptation, avant tout contact.`,
        };
      }
      return {
        issue: 'a-instruire',
        explication: `Annulée ${String(Math.round(minutes))} minutes après l’acceptation : au-delà du délai de recrédit automatique.`,
      };
    }

    default:
      return {
        issue: 'a-instruire',
        explication: `Motif « ${MOTIFS_CONTESTATION[motif].libelle} » : la base ne permet pas de trancher seule.`,
      };
  }
}

export interface Recredit {
  /** Montant rendu en euros HT. 0 € quand la demande était prise sur le forfait. */
  readonly montantHT: number;
  /** Faut-il rendre l'unité au forfait du mois ? */
  readonly rendAuForfait: boolean;
}

/**
 * Ce qu'un recrédit rend.
 *
 * On rend exactement ce qui a été pris : l'unité de forfait si la demande était incluse,
 * l'argent si elle a été facturée. Jamais les deux, jamais plus.
 */
export function calculeRecredit(etat: EtatContestation): Recredit {
  if (etat.consommeForfait) return { montantHT: 0, rendAuForfait: true };
  return { montantHT: etat.montantHT, rendAuForfait: false };
}
