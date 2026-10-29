/**
 * Les mentions qu'une facture doit porter, et la vérification qu'elle les porte.
 *
 * Une facture incomplète n'est pas une facture mal présentée : c'est une infraction. L'amende
 * administrative va jusqu'à 75 000 € pour une personne physique et 375 000 € pour une société
 * (article L441-9 du code de commerce), et l'omission d'une mention fiscale se sanctionne par
 * ailleurs de 15 € par mention manquante et par facture (article 1737 du CGI). Le
 * professionnel qui facture depuis Le Renom nous fait confiance pour ne pas le mettre dans ce
 * cas ; `factureConforme` est l'endroit où cette confiance se tient.
 *
 * Trois partis pris gouvernent ce fichier.
 *
 * **Rien de ce qui varie n'est écrit en dur.** Le taux des pénalités de retard change chaque
 * semestre — il suit le taux de refinancement de la BCE — donc il n'est pas une constante : il
 * est soit stipulé par le professionnel, soit laissé au taux légal, et le document imprime
 * alors la formule plutôt qu'un chiffre périmé.
 *
 * **Ce que nous ne savons pas, nous le réclamons.** La forme juridique, le numéro de TVA,
 * l'assurance professionnelle, le médiateur de la consommation : rien de tout cela n'est dans
 * SIRENE. Plutôt que de les deviner ou de les taire, le contrôle les déclare manquants et le
 * bouton « Émettre » reste fermé, comme `devisConforme` ferme « Envoyer au client ».
 *
 * **Les quatre mentions de la facturation électronique sont traitées dès maintenant.** Le
 * décret n° 2022-1299 du 7 octobre 2022 en ajoute quatre : le numéro SIREN du client, l'adresse
 * de livraison lorsqu'elle diffère, la catégorie de l'opération, et l'option du paiement de la
 * TVA sur les débits. L'obligation d'émission n'atteint les petites entreprises qu'après les
 * grandes, mais une facture qui les porte déjà n'aura rien à rattraper. Voir `QUESTIONS.md`
 * §Q35 pour ce qui reste à faire confirmer par un conseil.
 */

/** Une adresse postale, telle qu'elle s'imprime sur un document. */
export interface AdressePostale {
  readonly voie: string;
  readonly complement?: string;
  readonly codePostal: string;
  readonly commune: string;
}

/** Le registre où l'entreprise est immatriculée, et le lieu qui en dépend. */
export interface Immatriculation {
  /** `rcs` pour les sociétés et commerçants, `rm` pour les artisans. */
  readonly registre: 'rcs' | 'rm';
  /** La ville du greffe pour le RCS, le département pour le répertoire des métiers. */
  readonly lieu: string;
}

/**
 * L'assurance professionnelle, obligatoire sur les documents des métiers du bâtiment.
 *
 * La couverture géographique en fait partie : une assurance valable en France métropolitaine
 * ne dit rien d'un chantier ailleurs, et le client a le droit de le savoir avant de signer.
 */
export interface AssuranceProfessionnelle {
  readonly assureur: string;
  readonly contrat?: string;
  readonly couverture: string;
}

/** Le médiateur de la consommation, obligatoire dès qu'on facture un particulier. */
export interface Mediateur {
  readonly nom: string;
  /** Le site du médiateur : le client doit pouvoir le saisir sans appeler personne. */
  readonly url: string;
}

/** Celui qui facture. */
export interface Emetteur {
  readonly nom: string;
  readonly formeJuridique: string | null;
  readonly adresse: AdressePostale | null;
  readonly siret: string | null;
  readonly numeroTva: string | null;
  /**
   * Franchise en base de TVA (article 293 B du CGI). Quand elle s'applique, la facture ne
   * porte pas de TVA mais doit porter la mention — et le numéro de TVA cesse d'être exigible.
   */
  readonly franchiseTva: boolean;
  readonly immatriculation: Immatriculation | null;
  /** En euros. Exigible des sociétés, sans objet pour une entreprise individuelle. */
  readonly capitalSocialEuros: number | null;
  readonly assurance: AssuranceProfessionnelle | null;
  readonly mediateur: Mediateur | null;
  /** Métier du bâtiment : l'assurance devient exigible. */
  readonly batiment: boolean;
  /** Société : le capital social devient exigible. */
  readonly societe: boolean;
}

/** Celui qui est facturé. */
export interface Destinataire {
  readonly nom: string;
  readonly adresse: AdressePostale | null;
  /** Renseigné pour un client professionnel ; sans objet pour un particulier. */
  readonly siren: string | null;
  readonly professionnel: boolean;
}

/**
 * Le taux des pénalités de retard.
 *
 * `legal` n'est pas une absence : c'est le régime qui s'applique faute de stipulation, et la
 * facture l'imprime sous sa forme littérale — « taux de refinancement de la BCE majoré de dix
 * points ». Écrire le chiffre du semestre serait plus lisible et faux six mois plus tard.
 */
export type TauxPenalites =
  { readonly mode: 'legal' } | { readonly mode: 'stipule'; readonly tauxAnnuel: number };

/**
 * L'indemnité forfaitaire pour frais de recouvrement, en euros.
 *
 * Fixée par le décret n° 2012-1115 du 2 octobre 2012. Elle est due par facture impayée, de
 * plein droit, sans mise en demeure. Montant posé ici et nulle part ailleurs : le jour où un
 * décret le change, il y a un seul endroit à corriger.
 */
export const INDEMNITE_RECOUVREMENT_EUROS = 40;

/** Le délai de paiement par défaut entre professionnels, faute de stipulation. */
export const DELAI_PAIEMENT_LEGAL_JOURS = 30;

/** Les conditions de règlement, telles qu'elles s'impriment. */
export interface ConditionsReglement {
  readonly echeanceLe: Date | null;
  readonly tauxPenalites: TauxPenalites;
  /** Conditions d'escompte en cas de paiement anticipé, ou `null` s'il n'y en a aucune. */
  readonly escompte: string | null;
}

/** La catégorie de l'opération, l'une des quatre mentions du décret n° 2022-1299. */
export type CategorieOperation = 'biens' | 'services' | 'mixte';

/** Tout ce qu'une facture doit porter, hors lignes et totaux. */
export interface MentionsFacture {
  readonly numero: string | null;
  readonly emiseLe: Date | null;
  /** La date de l'opération, qui n'est pas celle de la facture. */
  readonly prestationLe: Date | null;
  readonly emetteur: Emetteur;
  readonly destinataire: Destinataire;
  readonly reglement: ConditionsReglement;
  readonly categorieOperation: CategorieOperation | null;
  /** L'adresse de livraison, à ne renseigner que si elle diffère de celle du destinataire. */
  readonly adresseLivraison: AdressePostale | null;
  /** L'option du paiement de la TVA sur les débits, si elle a été exercée. */
  readonly tvaSurLesDebits: boolean;
  /** Sous-traitance du bâtiment : la TVA est due par le preneur. */
  readonly autoliquidation: boolean;
}

export interface ConformiteFacture {
  readonly conforme: boolean;
  readonly manquants: readonly string[];
}

function adresseComplete(adresse: AdressePostale | null): boolean {
  if (adresse === null) return false;
  return (
    adresse.voie.trim() !== '' && adresse.codePostal.trim() !== '' && adresse.commune.trim() !== ''
  );
}

function renseigne(valeur: string | null | undefined): boolean {
  return valeur !== null && valeur !== undefined && valeur.trim() !== '';
}

/**
 * Vérifie qu'une facture porte les mentions obligatoires avant son émission.
 *
 * L'ordre des manquants suit celui du document, de l'en-tête au pied : le professionnel qui lit
 * la liste la retrouve de haut en bas sur son écran, au lieu de chercher.
 *
 * Le contrôle ne regarde pas les lignes ni les totaux — `calculeTotaux` et `devisConforme` s'en
 * chargent, et deux fonctions qui vérifient la même chose finissent par ne plus être d'accord.
 */
export function factureConforme(mentions: MentionsFacture): ConformiteFacture {
  const manquants: string[] = [];
  const { emetteur, destinataire, reglement } = mentions;

  // ── L'émetteur ───────────────────────────────────────────────────────────────────────────
  if (!renseigne(emetteur.nom)) manquants.push('Dénomination de l’entreprise');
  if (!renseigne(emetteur.formeJuridique)) manquants.push('Forme juridique (EI, SASU, SARL…)');
  if (!adresseComplete(emetteur.adresse)) manquants.push('Adresse du siège de l’entreprise');
  if (!renseigne(emetteur.siret)) manquants.push('Numéro SIRET');
  if (emetteur.immatriculation === null || !renseigne(emetteur.immatriculation.lieu)) {
    manquants.push(
      'Immatriculation : ville du greffe (RCS) ou département (répertoire des métiers)',
    );
  }
  if (emetteur.societe && emetteur.capitalSocialEuros === null) {
    manquants.push('Capital social');
  }
  // La franchise en base dispense de numéro de TVA : l'exiger quand même ferait réclamer au
  // professionnel un numéro qu'il n'a pas, et c'est le genre de blocage qui fait abandonner.
  if (!emetteur.franchiseTva && !renseigne(emetteur.numeroTva)) {
    manquants.push('Numéro de TVA intracommunautaire');
  }
  if (emetteur.batiment && emetteur.assurance === null) {
    manquants.push('Assurance professionnelle : assureur et couverture géographique');
  }
  if (emetteur.batiment && emetteur.assurance !== null) {
    if (!renseigne(emetteur.assurance.assureur)) manquants.push('Nom de l’assureur');
    if (!renseigne(emetteur.assurance.couverture)) {
      manquants.push('Couverture géographique de l’assurance');
    }
  }
  if (!destinataire.professionnel && emetteur.mediateur === null) {
    manquants.push('Médiateur de la consommation (obligatoire face à un particulier)');
  }

  // ── Le destinataire ──────────────────────────────────────────────────────────────────────
  if (!renseigne(destinataire.nom)) manquants.push('Nom du client');
  if (!adresseComplete(destinataire.adresse)) manquants.push('Adresse de facturation du client');
  if (destinataire.professionnel && !renseigne(destinataire.siren)) {
    manquants.push('Numéro SIREN du client');
  }

  // ── Le document ──────────────────────────────────────────────────────────────────────────
  if (!renseigne(mentions.numero)) manquants.push('Numéro de facture');
  if (mentions.emiseLe === null) manquants.push('Date d’émission');
  if (mentions.prestationLe === null) manquants.push('Date de la prestation');
  if (mentions.categorieOperation === null) {
    manquants.push(
      'Catégorie de l’opération (livraison de biens, prestation de services, ou les deux)',
    );
  }

  // ── Le règlement ─────────────────────────────────────────────────────────────────────────
  if (reglement.echeanceLe === null) manquants.push('Date d’échéance du règlement');
  if (reglement.tauxPenalites.mode === 'stipule' && reglement.tauxPenalites.tauxAnnuel <= 0) {
    manquants.push('Taux des pénalités de retard');
  }

  return { conforme: manquants.length === 0, manquants };
}

/**
 * La phrase des pénalités de retard, telle qu'elle s'imprime.
 *
 * Au taux légal, on imprime la formule et non le chiffre du semestre : un taux périmé sur une
 * facture est plus dangereux qu'une formule, parce qu'il a l'air juste.
 */
export function phrasePenalites(taux: TauxPenalites): string {
  const indemnite = `Tout retard de paiement entraîne une indemnité forfaitaire de ${String(INDEMNITE_RECOUVREMENT_EUROS)} € pour frais de recouvrement, exigible de plein droit.`;
  if (taux.mode === 'stipule') {
    return `En cas de retard de paiement, des pénalités de retard sont dues au taux annuel de ${taux.tauxAnnuel.toLocaleString('fr-FR')} %. ${indemnite}`;
  }
  return `En cas de retard de paiement, des pénalités de retard sont dues au taux d’intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de dix points de pourcentage. ${indemnite}`;
}

/** La phrase de la franchise en base de TVA. Son libellé est imposé par le texte. */
export const MENTION_FRANCHISE_TVA = 'TVA non applicable, article 293 B du CGI.';

/** La phrase de l'autoliquidation, en sous-traitance du bâtiment. */
export const MENTION_AUTOLIQUIDATION =
  'Autoliquidation : TVA due par le preneur, article 283-2 nonies du CGI.';

/** La catégorie de l'opération, telle qu'elle s'imprime. */
export const LIBELLE_CATEGORIE_OPERATION: Readonly<Record<CategorieOperation, string>> =
  Object.freeze({
    biens: 'Livraison de biens',
    services: 'Prestation de services',
    mixte: 'Livraison de biens et prestation de services',
  });

/**
 * L'échéance de règlement, à partir de la date d'émission.
 *
 * Le délai par défaut est celui de la loi, trente jours : un délai inventé plus court
 * avantagerait le professionnel contre son client, et un plus long l'inverse.
 */
export function echeanceDe(emiseLe: Date, delaiJours: number = DELAI_PAIEMENT_LEGAL_JOURS): Date {
  const echeance = new Date(emiseLe.getTime());
  echeance.setDate(echeance.getDate() + delaiJours);
  return echeance;
}
