/**
 * Devis et factures du professionnel, pour ses propres clients.
 *
 * Les factures de l'abonnement Le Renom sont un autre sujet, traité par Stripe.
 *
 * Tous les calculs se font en **centimes entiers**. Une facture est un document comptable : un
 * écart d'un centime dû à un arrondi flottant est un écart de trop. Les montants ne reviennent
 * en euros qu'au moment de l'affichage.
 *
 * Conformité du devis de dépannage à domicile (obligatoire depuis le 1er avril 2017, quel que
 * soit le montant) : quantité et prix unitaire ligne par ligne, frais de déplacement, totaux HT
 * et TTC, durée de validité, caractère gratuit ou payant du devis, et possibilité pour le client
 * de conserver les pièces remplacées. `devisConforme` vérifie ces mentions avant l'envoi.
 */

/** Unités autorisées dans l'éditeur. */
export const UNITES = ['unite', 'heure', 'forfait', 'jour', 'm2', 'ml'] as const;
export type Unite = (typeof UNITES)[number];

export const LIBELLES_UNITE: Readonly<Record<Unite, string>> = Object.freeze({
  unite: 'u',
  heure: 'h',
  forfait: 'forfait',
  jour: 'jour',
  m2: 'm²',
  ml: 'ml',
});

/** Les trois taux de TVA utilisables sur un devis de travaux. */
export const TAUX_TVA = [5.5, 10, 20] as const;
export type TauxTva = (typeof TAUX_TVA)[number];

export type TypeLigne = 'prestation' | 'section' | 'texte';

export interface LigneDocument {
  readonly id: string;
  readonly type: TypeLigne;
  readonly designation: string;
  /** Détail affiché sous la ligne : marque, référence, précision technique. */
  readonly detail?: string;
  readonly unite?: Unite;
  /** Quantité, décimale autorisée (2,5 h). */
  readonly quantite?: number;
  /** Prix unitaire HT en euros. */
  readonly prixUnitaireHT?: number;
  readonly tauxTva?: TauxTva;
}

export type TypeDevis = 'estimatif' | 'definitif';
export type ValiditeJours = 15 | 30 | 60;
export type PourcentAcompte = 0 | 30 | 40;

export interface DocumentChiffrable {
  readonly lignes: readonly LigneDocument[];
  /** Remise globale en pourcentage du total HT. */
  readonly remisePourcent?: number;
  readonly acomptePourcent?: PourcentAcompte;
}

export interface LigneTva {
  readonly taux: TauxTva;
  readonly baseHT: number;
  readonly montant: number;
}

export interface Totaux {
  /** Total HT avant remise. */
  readonly totalBrutHT: number;
  readonly remiseHT: number;
  readonly totalHT: number;
  readonly tva: readonly LigneTva[];
  readonly totalTVA: number;
  readonly totalTTC: number;
  /** Acompte demandé, TTC. 0 s'il n'y a pas d'acompte. */
  readonly acompteTTC: number;
  /** Ce qui restera dû après l'acompte. */
  readonly soldeTTC: number;
}

function centimes(euros: number): number {
  return Math.round(euros * 100);
}

function euros(cents: number): number {
  return Math.round(cents) / 100;
}

/** Les lignes qui portent un montant. Les sections et les lignes de texte n'en portent pas. */
function lignesChiffrees(
  lignes: readonly LigneDocument[],
): readonly (LigneDocument & { quantite: number; prixUnitaireHT: number; tauxTva: TauxTva })[] {
  return lignes.filter(
    (l): l is LigneDocument & { quantite: number; prixUnitaireHT: number; tauxTva: TauxTva } =>
      l.type === 'prestation' &&
      typeof l.quantite === 'number' &&
      typeof l.prixUnitaireHT === 'number' &&
      typeof l.tauxTva === 'number',
  );
}

/** Montant HT d'une ligne, en centimes, arrondi au centime comme sur le document imprimé. */
export function montantLigneHT(ligne: LigneDocument): number {
  if (ligne.type !== 'prestation') return 0;
  const quantite = ligne.quantite ?? 0;
  const prix = ligne.prixUnitaireHT ?? 0;
  return euros(Math.round(quantite * centimes(prix)));
}

/**
 * Calcule tous les totaux d'un devis ou d'une facture.
 *
 * La remise globale est répartie **au prorata de chaque taux de TVA**, et non retirée du total :
 * sans cela, une remise sur un document mêlant 10 % et 20 % fausserait la TVA déclarée.
 */
export function calculeTotaux(document: DocumentChiffrable): Totaux {
  const remisePourcent = Math.min(100, Math.max(0, document.remisePourcent ?? 0));
  const chiffrees = lignesChiffrees(document.lignes);

  // Base HT par taux, en centimes.
  const basesParTaux = new Map<TauxTva, number>();
  let brutCents = 0;

  for (const ligne of chiffrees) {
    const montant = Math.round(ligne.quantite * centimes(ligne.prixUnitaireHT));
    brutCents += montant;
    basesParTaux.set(ligne.tauxTva, (basesParTaux.get(ligne.tauxTva) ?? 0) + montant);
  }

  const remiseCents = Math.round((brutCents * remisePourcent) / 100);
  const htCents = brutCents - remiseCents;

  // Répartition de la remise au prorata, le dernier taux absorbant l'arrondi pour que la somme
  // des bases égale exactement le total HT.
  const taux = [...basesParTaux.keys()].sort((a, b) => a - b);
  const tva: LigneTva[] = [];
  let baseCumulee = 0;
  let tvaCents = 0;

  taux.forEach((t, index) => {
    const baseBrute = basesParTaux.get(t) ?? 0;
    const estDernier = index === taux.length - 1;
    const baseNette = estDernier
      ? htCents - baseCumulee
      : Math.round((baseBrute * (100 - remisePourcent)) / 100);
    baseCumulee += baseNette;

    const montantTva = Math.round((baseNette * t) / 100);
    tvaCents += montantTva;
    tva.push({ taux: t, baseHT: euros(baseNette), montant: euros(montantTva) });
  });

  const ttcCents = htCents + tvaCents;
  const acomptePourcent = document.acomptePourcent ?? 0;
  const acompteCents = Math.round((ttcCents * acomptePourcent) / 100);

  return {
    totalBrutHT: euros(brutCents),
    remiseHT: euros(remiseCents),
    totalHT: euros(htCents),
    tva,
    totalTVA: euros(tvaCents),
    totalTTC: euros(ttcCents),
    acompteTTC: euros(acompteCents),
    soldeTTC: euros(ttcCents - acompteCents),
  };
}

export interface MentionsDevis {
  /** Le devis mentionne-t-il les frais de déplacement (même à 0 €) ? */
  readonly fraisDeplacementIndiques: boolean;
  /** Durée de validité affichée. */
  readonly validiteJours: ValiditeJours | null;
  /** Le caractère gratuit ou payant du devis est-il indiqué ? */
  readonly caractereGratuitIndique: boolean;
  /** La possibilité de conserver les pièces remplacées est-elle indiquée ? */
  readonly piecesRemplaceesIndiquee: boolean;
}

export interface ConformiteDevis {
  readonly conforme: boolean;
  readonly manquants: readonly string[];
}

/**
 * Vérifie qu'un devis porte les mentions obligatoires avant l'envoi au client.
 *
 * Ce n'est pas un détail de présentation : un devis de dépannage, de réparation ou d'entretien à
 * domicile sans ces mentions expose le professionnel. Le bouton « Envoyer au client » reste
 * désactivé tant que `conforme` est faux, et l'interface dit ce qui manque.
 */
export function devisConforme(
  document: DocumentChiffrable,
  mentions: MentionsDevis,
): ConformiteDevis {
  const manquants: string[] = [];
  const chiffrees = lignesChiffrees(document.lignes);

  if (chiffrees.length === 0) {
    manquants.push('Au moins une ligne de prestation chiffrée');
  }

  for (const ligne of chiffrees) {
    if (ligne.quantite <= 0) {
      manquants.push(`Quantité manquante ou nulle sur « ${ligne.designation} »`);
    }
    if (ligne.unite === undefined) {
      manquants.push(`Unité manquante sur « ${ligne.designation} »`);
    }
  }

  if (!mentions.fraisDeplacementIndiques) {
    manquants.push('Frais de déplacement (à indiquer, même s’ils sont offerts)');
  }
  if (mentions.validiteJours === null) {
    manquants.push('Durée de validité du devis');
  }
  if (!mentions.caractereGratuitIndique) {
    manquants.push('Caractère gratuit ou payant du devis');
  }
  if (!mentions.piecesRemplaceesIndiquee) {
    manquants.push('Possibilité pour le client de conserver les pièces remplacées');
  }

  return { conforme: manquants.length === 0, manquants };
}

export type TypeFacture = 'acompte' | 'solde' | 'libre';

export interface FacturePreparee {
  readonly type: TypeFacture;
  readonly lignes: readonly LigneDocument[];
  readonly remisePourcent: number;
  /** Montant déjà facturé en acompte, TTC, déduit du solde. */
  readonly acompteDejaFactureTTC: number;
  readonly totaux: Totaux;
  readonly montantAPayerTTC: number;
}

/**
 * Prépare la facture d'acompte à partir d'un devis signé.
 *
 * L'acompte n'est pas une ligne de prestation : c'est un appel de fonds sur le devis. Il porte
 * donc la TVA du devis au prorata, ce que `calculeTotaux` a déjà réparti.
 */
export function prepareFactureAcompte(devis: DocumentChiffrable): FacturePreparee | null {
  const totaux = calculeTotaux(devis);
  if (totaux.acompteTTC <= 0) return null;

  return {
    type: 'acompte',
    lignes: devis.lignes,
    remisePourcent: devis.remisePourcent ?? 0,
    acompteDejaFactureTTC: 0,
    totaux,
    montantAPayerTTC: totaux.acompteTTC,
  };
}

/**
 * Prépare la facture de solde : le total du devis, moins l'acompte déjà facturé.
 * C'est la facture qui apparaît « prête à émettre » dès que le client signe.
 */
export function prepareFactureSolde(
  devis: DocumentChiffrable,
  acompteDejaFactureTTC = 0,
): FacturePreparee {
  const totaux = calculeTotaux(devis);
  const deja = Math.max(0, Math.min(acompteDejaFactureTTC, totaux.totalTTC));

  return {
    type: 'solde',
    lignes: devis.lignes,
    remisePourcent: devis.remisePourcent ?? 0,
    acompteDejaFactureTTC: deja,
    totaux,
    montantAPayerTTC: euros(centimes(totaux.totalTTC) - centimes(deja)),
  };
}

/** Un avoir : le seul moyen de corriger une facture émise, qui n'est ni modifiable ni supprimable. */
export interface Avoir {
  readonly factureNumero: string;
  readonly motif: string;
  readonly montantTTC: number;
}

export function prepareAvoir(
  factureNumero: string,
  montantTTC: number,
  motif: string,
): Avoir | null {
  if (montantTTC <= 0 || motif.trim().length === 0) return null;
  return { factureNumero, motif: motif.trim(), montantTTC: euros(centimes(montantTTC)) };
}

/**
 * Numérotation continue, sans trou ni doublon.
 *
 * Le numéro est attribué **à l'émission**, jamais à la création : un brouillon abandonné ne doit
 * pas laisser un trou dans la séquence, et un trou dans une séquence de factures est un défaut
 * comptable.
 */
export function prochainNumero(
  prefixe: string,
  annee: number,
  dernierNumero: string | null,
): string {
  const format = (n: number): string => `${prefixe}-${annee}-${String(n).padStart(4, '0')}`;
  if (dernierNumero === null) return format(1);

  const motif = new RegExp(`^${prefixe}-(\\d{4})-(\\d+)$`);
  const trouve = motif.exec(dernierNumero);
  if (trouve === null) return format(1);

  const anneePrecedente = Number(trouve[1]);
  const rang = Number(trouve[2]);
  // Chaque année repart à 1 : c'est la pratique courante, et la continuité s'apprécie par série.
  return anneePrecedente === annee ? format(rang + 1) : format(1);
}

/** Vérifie qu'une série de numéros ne comporte ni trou ni doublon. */
export function numerotationContinue(numeros: readonly string[]): boolean {
  const rangs = numeros
    .map((n) => /-(\d+)$/.exec(n))
    .map((t) => (t === null ? Number.NaN : Number(t[1])));

  if (rangs.some(Number.isNaN)) return false;
  const triee = [...rangs].sort((a, b) => a - b);
  if (new Set(triee).size !== triee.length) return false;

  return triee.every((rang, index) => rang === (triee[0] ?? 1) + index);
}
