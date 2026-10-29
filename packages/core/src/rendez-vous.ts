/**
 * Le rendez-vous : ce que le client peut en faire, et ce que le professionnel peut encore
 * en faire.
 *
 * Un rendez-vous naît proposé, puis le client accepte ou décline. Les deux parties peuvent
 * ensuite l'annuler. Ce fichier dit **qui peut quoi, et quand** — le reste, l'envoi des
 * messages et l'écriture en base, est du câblage.
 *
 * Une idée gouverne l'ensemble : **un rendez-vous engage deux personnes**. Dès qu'il est
 * confirmé, aucune des deux ne peut plus le modifier dans son coin. Le professionnel qui a
 * un empêchement annule — et l'annulation prévient. Il ne déplace pas en silence un horaire
 * que son client a noté sur son frigo.
 */

export type StatutRendezVous = 'propose' | 'confirme' | 'honore' | 'annule' | 'client_absent';

export const LIBELLE_STATUT_RENDEZ_VOUS: Readonly<Record<StatutRendezVous, string>> = Object.freeze(
  {
    propose: 'Proposé, en attente de réponse',
    confirme: 'Confirmé',
    honore: 'Honoré',
    annule: 'Annulé',
    client_absent: 'Client absent',
  },
);

/** Ce qu'il faut savoir d'un rendez-vous pour décider de ce qu'on peut en faire. */
export interface EtatRendezVous {
  readonly statut: StatutRendezVous;
  /** Le début de la plage. Un rendez-vous passé ne se confirme plus. */
  readonly debut: Date;
  /** L'échéance de la proposition. `null` quand le rendez-vous n'est plus au stade proposé. */
  readonly expireLe: Date | null;
}

export type RefusRendezVous = 'deja-repondu' | 'expire' | 'passe' | 'deja-annule' | 'pas-confirme';

export const MESSAGE_REFUS: Readonly<Record<RefusRendezVous, string>> = Object.freeze({
  'deja-repondu': 'Vous avez déjà répondu à cette proposition.',
  expire: 'Cette proposition a expiré. Demandez un nouveau créneau à l’entreprise.',
  passe: 'Ce créneau est passé. Demandez-en un nouveau à l’entreprise.',
  'deja-annule': 'Ce rendez-vous est déjà annulé.',
  'pas-confirme': 'Ce rendez-vous n’est pas confirmé.',
});

export type Verdict =
  { readonly ok: true } | { readonly ok: false; readonly refus: RefusRendezVous };

const OK: Verdict = { ok: true };

/**
 * Le client peut-il répondre à cette proposition ?
 *
 * Trois refus, dans cet ordre. **Déjà répondu** d'abord : c'est le cas le plus fréquent — un
 * client qui rouvre son SMS — et le message doit le rassurer plutôt que l'alarmer. Puis
 * l'expiration. Puis le créneau passé, qui attrape le cas où la proposition vivait encore
 * mais où l'horaire, lui, est derrière nous.
 */
export function peutRepondre(etat: EtatRendezVous, maintenant: Date = new Date()): Verdict {
  if (etat.statut !== 'propose') return { ok: false, refus: 'deja-repondu' };
  if (etat.expireLe !== null && etat.expireLe.getTime() <= maintenant.getTime()) {
    return { ok: false, refus: 'expire' };
  }
  if (etat.debut.getTime() <= maintenant.getTime()) return { ok: false, refus: 'passe' };
  return OK;
}

/**
 * Le rendez-vous peut-il encore être annulé ?
 *
 * Un rendez-vous passé **peut** être annulé : c'est ainsi qu'on consigne un client absent ou
 * une intervention qui n'a pas eu lieu. Seul un rendez-vous déjà annulé ne l'est plus.
 */
export function peutAnnuler(etat: EtatRendezVous): Verdict {
  if (etat.statut === 'annule') return { ok: false, refus: 'deja-annule' };
  return OK;
}

/**
 * Le rendez-vous peut-il être marqué honoré ?
 *
 * Seulement s'il était confirmé : un créneau que le client n'a jamais accepté ne peut pas
 * avoir été honoré, et le compter ainsi fausserait les statistiques du professionnel.
 */
export function peutMarquerHonore(etat: EtatRendezVous): Verdict {
  if (etat.statut !== 'confirme') return { ok: false, refus: 'pas-confirme' };
  return OK;
}

/**
 * Combien d'heures avant le rendez-vous ?
 *
 * Négatif quand il est passé. Sert à décider des rappels et à choisir le ton d'un message :
 * « demain » et « dans trois semaines » ne se disent pas pareil.
 */
export function heuresAvant(debut: Date, maintenant: Date = new Date()): number {
  return (debut.getTime() - maintenant.getTime()) / 3_600_000;
}

/** Le rappel de la veille est-il à envoyer ? */
export const RAPPEL_VEILLE_HEURES = 24;
/** Le rappel juste avant, pour que le client soit chez lui. */
export const RAPPEL_PROCHE_HEURES = 2;

export function rappelAEnvoyer(
  rendezVous: {
    readonly statut: StatutRendezVous;
    readonly debut: Date;
    readonly rappelVeilleLe: Date | null;
    readonly rappelProcheLe: Date | null;
  },
  maintenant: Date = new Date(),
): 'veille' | 'proche' | null {
  if (rendezVous.statut !== 'confirme') return null;
  const heures = heuresAvant(rendezVous.debut, maintenant);
  if (heures <= 0) return null;

  // Le plus proche d'abord : un rendez-vous dans une heure n'a plus besoin du rappel de la
  // veille, même s'il n'est jamais parti.
  if (heures <= RAPPEL_PROCHE_HEURES && rendezVous.rappelProcheLe === null) return 'proche';
  if (heures <= RAPPEL_VEILLE_HEURES && rendezVous.rappelVeilleLe === null) return 'veille';
  return null;
}
