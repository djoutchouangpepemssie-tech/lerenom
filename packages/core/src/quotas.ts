/**
 * Forfaits, compteurs et facturation d'une demande.
 *
 * Deux règles gouvernent tout ce fichier :
 *   — seule une demande **acceptée** est décomptée ; un refus ou une expiration ne coûte rien ;
 *   — une demande urgente est facturée à part et ne consomme jamais le forfait.
 *
 * Le compteur repart à zéro le 1er de chaque mois, sans report.
 */

import type { Parametres } from './parametres.ts';
import type { Formule } from './regles-validees.ts';

export type TypeDemande = 'directe' | 'partagee' | 'urgente';

export interface EtatForfait {
  readonly formule: Formule;
  /** Demandes partagées incluses dans la formule. */
  readonly incluses: number;
  /** Demandes acceptées ce mois-ci, hors urgences. */
  readonly consommees: number;
  readonly restantes: number;
  /** Part du forfait consommée, entre 0 et 1. Vaut 1 quand il n'y a pas de forfait. */
  readonly part: number;
  /** Le pro et l'administrateur sont-ils à alerter ? */
  readonly alerte: boolean;
  readonly epuise: boolean;
}

export function etatForfait(
  formule: Formule,
  demandesAccepteesCeMois: number,
  parametres: Parametres,
): EtatForfait {
  const incluses = parametres.demandesIncluses[formule];
  const consommees = Math.max(0, demandesAccepteesCeMois);
  const restantes = Math.max(0, incluses - consommees);
  const part = incluses === 0 ? 1 : Math.min(1, consommees / incluses);

  return {
    formule,
    incluses,
    consommees,
    restantes,
    part,
    alerte: incluses > 0 && part >= parametres.seuilAlerteForfait,
    epuise: restantes === 0,
  };
}

export interface CoutDemande {
  /** Montant facturé en euros HT. 0 € quand la demande est prise sur le forfait. */
  readonly montantHT: number;
  /** La demande consomme-t-elle une unité du forfait mensuel ? */
  readonly consommeForfait: boolean;
  /** Le texte écrit sur le bouton « Accepter », pour que le pro sache ce qu'il engage. */
  readonly libelleBouton: string;
}

/**
 * Ce que coûte l'acceptation de la prochaine demande.
 *
 * Renvoie `null` quand la formule n'y a pas droit : une demande urgente n'est jamais proposée à
 * une fiche gratuite.
 */
export function coutAcceptation(
  formule: Formule,
  type: TypeDemande,
  demandesAccepteesCeMois: number,
  parametres: Parametres,
): CoutDemande | null {
  if (type === 'urgente') {
    const prix = parametres.prixDemandeUrgente[formule];
    if (prix === null) return null;
    return {
      montantHT: prix,
      consommeForfait: false,
      libelleBouton: `Accepter — ${formatEuros(prix)} (urgence, hors forfait)`,
    };
  }

  if (type === 'directe') {
    return { montantHT: 0, consommeForfait: false, libelleBouton: 'Accepter — incluse' };
  }

  const forfait = etatForfait(formule, demandesAccepteesCeMois, parametres);
  if (forfait.restantes > 0) {
    return {
      montantHT: 0,
      consommeForfait: true,
      libelleBouton: `Accepter — incluse (${forfait.restantes} sur ${forfait.incluses} restantes ce mois)`,
    };
  }

  const prix = parametres.prixDemandePartagee[formule];
  return {
    montantHT: prix,
    consommeForfait: false,
    libelleBouton: `Accepter — ${formatEuros(prix)}`,
  };
}

export interface ReglagesDepense {
  /** Le pro accepte-t-il de payer les demandes au-delà de son forfait ? */
  readonly rechargeAutomatique: boolean;
  /** Plafond de dépense mensuel en euros HT, hors abonnement. `null` = sans plafond. */
  readonly plafondMensuelHT: number | null;
  /** Dépense déjà engagée ce mois-ci, en euros HT. */
  readonly depenseCeMoisHT: number;
}

/**
 * Le pro peut-il encore recevoir une demande partagée ?
 *
 * Tant qu'il a du forfait, oui. Une fois le forfait épuisé, il faut qu'il ait activé la recharge
 * automatique **et** qu'il reste sous son plafond : sans recharge, il ne reçoit plus de demandes
 * partagées, et c'est volontaire — on ne facture jamais un pro qui n'a pas dit oui.
 */
export function peutRecevoirDemandePartagee(
  formule: Formule,
  demandesAccepteesCeMois: number,
  reglages: ReglagesDepense,
  parametres: Parametres,
): boolean {
  const forfait = etatForfait(formule, demandesAccepteesCeMois, parametres);
  if (forfait.restantes > 0) return true;
  if (!reglages.rechargeAutomatique) return false;

  const prix = parametres.prixDemandePartagee[formule];
  if (reglages.plafondMensuelHT === null) return true;
  return reglages.depenseCeMoisHT + prix <= reglages.plafondMensuelHT;
}

/** Une demande recréditée revient dans le forfait du mois en cours. */
export function apresRecredit(demandesAccepteesCeMois: number): number {
  return Math.max(0, demandesAccepteesCeMois - 1);
}

/**
 * Formate un montant à la française : 12 €, 94,80 €, 1 122 €.
 *
 * Les milliers sont séparés par une **espace fine insécable** (U+202F), et l'espace qui
 * précède le symbole l'est aussi : c'est la règle typographique française, et l'insécabilité
 * évite qu'un montant se coupe en fin de ligne — « 1 122 » puis « € » à la ligne suivante est
 * illisible sur une facture.
 *
 * Le groupement est fait à la main plutôt que par `Intl` : le séparateur que `Intl` choisit
 * pour `fr-FR` a changé selon les versions de Node, et un document comptable ne doit pas
 * s'écrire différemment selon la machine qui le produit.
 */
export function formatEuros(montant: number): string {
  // Une espace **insécable** (U+00A0), pas une espace fine insécable (U+202F).
  //
  // La typographie française prescrit la fine, et c'est ce que ce code utilisait. Sur la
  // capture de la facture, « 1122 € » : le séparateur était bien dans la chaîne, invisible à
  // l'écran. Mesure faite dans la police du site : la fine rend 1,6 px contre 3,2 px pour
  // l'insécable — Manrope ne dessine pas la fine et le navigateur la réduit presque à rien.
  //
  // Un séparateur de milliers qu'on ne voit pas ne sépare rien : sur une facture, « 1122 »
  // et « 1 122 » ne se lisent pas à la même vitesse. L'insécable se voit, ne coupe pas en fin
  // de ligne, et aucune police n'a d'excuse pour ne pas la dessiner. La règle typographique
  // sert la lecture ; quand son application la dessert, c'est la lecture qui gagne.
  const INSECABLE = '\u00a0';
  const negatif = montant < 0;
  const absolu = Math.abs(montant);
  const entier = Number.isInteger(absolu);
  const texte = entier ? String(absolu) : absolu.toFixed(2).replace('.', ',');

  const [partieEntiere = '', decimales] = texte.split(',');
  const groupee = partieEntiere.replace(/\B(?=(\d{3})+(?!\d))/g, INSECABLE);
  const nombre = decimales === undefined ? groupee : `${groupee},${decimales}`;

  return `${negatif ? '−' : ''}${nombre}${INSECABLE}€`;
}
