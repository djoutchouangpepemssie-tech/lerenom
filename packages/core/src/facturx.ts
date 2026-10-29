/**
 * Factur-X : la facture lisible par une machine.
 *
 * Une facture électronique au sens de la réforme n'est pas un PDF envoyé par courriel : c'est
 * un PDF **qui porte en pièce jointe** un XML structuré, de sorte que le même fichier se lise
 * à l'œil et se traite sans intervention humaine. Ce fichier produit ce XML ; son
 * incorporation au PDF viendra avec la génération serveur (voir `QUESTIONS.md` §Q35).
 *
 * **Le profil retenu est BASIC WL.** Factur-X en définit plusieurs, du plus pauvre au plus
 * riche. MINIMUM ne porte ni ventilation de TVA ni échéance — c'est un profil d'export
 * comptable, pas une facture. BASIC et EN 16931 exigent le détail ligne à ligne, que notre
 * facture possède mais dont la mise en correspondance ouvre une surface d'erreur sans
 * contrepartie immédiate. BASIC WL (« without lines ») porte exactement ce que notre facture
 * tient de sûr : l'identité des deux parties, les dates, la ventilation de TVA par taux, la
 * remise, l'acompte, l'échéance et l'IBAN. C'est le profil le plus riche que nous puissions
 * remplir **sans rien inventer**, et c'est le critère qui a décidé.
 *
 * **La structure n'est pas devinée.** L'ordre des éléments est imposé par le schéma CII : un
 * élément correct placé au mauvais endroit rend le document invalide, et le contrôle ne le dit
 * qu'au rejet. Elle est reprise d'un exemplaire de référence du profil, pas de mémoire.
 *
 * **Les montants ne sont pas recalculés ici.** Ils arrivent déjà faits de `calculeTotaux`.
 * Un XML qui referait l'arithmétique produirait, un jour, un fichier qui contredit le PDF
 * qu'il accompagne — et c'est précisément l'écart que Factur-X existe pour empêcher.
 */

import type { LigneTva, Totaux } from './devis.ts';
import type { AdressePostale } from './document.ts';

/** L'identifiant du profil, tel qu'il doit figurer dans le document. */
export const PROFIL_FACTURX = 'urn:factur-x.eu:1p0:basicwl';

/** Le nom imposé à la pièce jointe XML dans le PDF. Il n'est pas libre. */
export const NOM_FICHIER_FACTURX = 'factur-x.xml';

/**
 * Le code du type de document (UNTDID 1001).
 *
 * `380` pour une facture, `381` pour un avoir. Un avoir envoyé avec le code d'une facture
 * serait comptabilisé à l'envers par le logiciel qui le reçoit.
 */
export const CODE_FACTURE = '380';
export const CODE_AVOIR = '381';

/**
 * La catégorie de TVA (UNTDID 5305).
 *
 * `S` taux normal ou réduit, `E` exonéré — le cas de la franchise en base —, `AE`
 * autoliquidation, `Z` taux zéro.
 */
export type CategorieTva = 'S' | 'E' | 'AE' | 'Z';

export interface PartieFacturx {
  readonly nom: string;
  readonly siret: string | null;
  readonly numeroTva: string | null;
  readonly adresse: AdressePostale | null;
  readonly email?: string | null;
}

export interface FactureFacturx {
  readonly numero: string;
  readonly emiseLe: Date;
  readonly echeanceLe: Date | null;
  /** La date de l'opération, si elle diffère de l'émission. */
  readonly livreeLe: Date | null;
  readonly avoir: boolean;
  readonly vendeur: PartieFacturx;
  readonly acheteur: PartieFacturx;
  readonly totaux: Totaux;
  /** Acompte déjà facturé et encaissé, à retrancher du dû. */
  readonly acompteDejaFactureTTC: number;
  readonly montantAPayerTTC: number;
  readonly iban: string | null;
  /** Franchise en base : la TVA est exonérée, et la raison doit être dite. */
  readonly franchiseTva: boolean;
  readonly autoliquidation: boolean;
  /** Les mentions légales, reprises en notes : le XML doit porter ce que le PDF affiche. */
  readonly notes: readonly { readonly code: CodeNote; readonly texte: string }[];
}

/**
 * Le code qui qualifie une note (UNTDID 4451).
 *
 * `REG` informations réglementaires sur le vendeur, `ABL` immatriculation, `PMD` conditions de
 * pénalités, `PMT` conditions de paiement, `AAB` escompte, `AAI` informations générales.
 */
export type CodeNote = 'REG' | 'ABL' | 'PMD' | 'PMT' | 'AAB' | 'AAI';

/**
 * Échappe le texte d'un nœud XML.
 *
 * Les cinq entités, dont les apostrophes : le nom d'une entreprise en contient souvent, et un
 * `&` dans une raison sociale — « Dupont & Fils » — suffit à rendre le fichier illisible pour
 * le destinataire, qui le rejettera sans dire pourquoi.
 */
function echappe(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** La date au format 102 : AAAAMMJJ, en heure locale — celle de la facture. */
export function dateFacturx(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}${mois}${jour}`;
}

/**
 * Un montant, à deux décimales, point décimal.
 *
 * Jamais `toLocaleString` : la virgule française produirait un nombre que le schéma refuse, et
 * l'erreur ne se verrait qu'au moment du rejet, chez le destinataire.
 */
export function montantFacturx(euros: number): string {
  // `Math.round` sur les centimes plutôt que `toFixed` seul : `toFixed` arrondit au plus
  // proche pair sur certaines valeurs, et un centime d'écart avec le PDF est un rejet.
  return (Math.round(euros * 100) / 100).toFixed(2);
}

function noeud(nom: string, valeur: string, attributs = ''): string {
  return `<${nom}${attributs}>${echappe(valeur)}</${nom}>`;
}

function adresseXml(adresse: AdressePostale | null): string {
  if (adresse === null)
    return '<ram:PostalTradeAddress><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>';
  const lignes = [
    noeud('ram:PostcodeCode', adresse.codePostal),
    noeud('ram:LineOne', adresse.voie),
    ...(adresse.complement !== undefined ? [noeud('ram:LineTwo', adresse.complement)] : []),
    noeud('ram:CityName', adresse.commune),
    '<ram:CountryID>FR</ram:CountryID>',
  ];
  return `<ram:PostalTradeAddress>${lignes.join('')}</ram:PostalTradeAddress>`;
}

function partieXml(balise: string, partie: PartieFacturx): string {
  const morceaux: string[] = [];
  // Le SIRET sert d'identifiant légal, sous le schéma 0002 (répertoire SIRENE).
  if (partie.siret !== null) {
    morceaux.push(noeud('ram:ID', partie.siret, ' schemeID="0002"'));
  }
  morceaux.push(noeud('ram:Name', partie.nom));
  if (partie.siret !== null) {
    morceaux.push(
      `<ram:SpecifiedLegalOrganization>${noeud('ram:ID', partie.siret, ' schemeID="0002"')}</ram:SpecifiedLegalOrganization>`,
    );
  }
  morceaux.push(adresseXml(partie.adresse));
  if (partie.email !== null && partie.email !== undefined && partie.email !== '') {
    morceaux.push(
      `<ram:URIUniversalCommunication>${noeud('ram:URIID', partie.email, ' schemeID="SMTP"')}</ram:URIUniversalCommunication>`,
    );
  }
  if (partie.numeroTva !== null) {
    morceaux.push(
      `<ram:SpecifiedTaxRegistration>${noeud('ram:ID', partie.numeroTva, ' schemeID="VA"')}</ram:SpecifiedTaxRegistration>`,
    );
  }
  return `<${balise}>${morceaux.join('')}</${balise}>`;
}

/** La catégorie de TVA qui s'applique à toute la facture. */
export function categorieTvaDe(facture: {
  readonly franchiseTva: boolean;
  readonly autoliquidation: boolean;
}): CategorieTva {
  if (facture.autoliquidation) return 'AE';
  if (facture.franchiseTva) return 'E';
  return 'S';
}

function taxeXml(ligne: LigneTva, categorie: CategorieTva): string {
  const morceaux = [
    noeud('ram:CalculatedAmount', montantFacturx(ligne.montant), ' currencyID="EUR"'),
    '<ram:TypeCode>VAT</ram:TypeCode>',
    noeud('ram:BasisAmount', montantFacturx(ligne.baseHT), ' currencyID="EUR"'),
    noeud('ram:CategoryCode', categorie),
    // `DueDateTypeCode` 5 : TVA exigible sur les débits. C'est le régime de droit commun des
    // livraisons de biens, et celui que nous appliquons faute d'option contraire déclarée.
    '<ram:DueDateTypeCode>5</ram:DueDateTypeCode>',
    noeud('ram:RateApplicablePercent', montantFacturx(ligne.taux)),
  ];
  return `<ram:ApplicableTradeTax>${morceaux.join('')}</ram:ApplicableTradeTax>`;
}

/**
 * La ligne de TVA d'une facture exonérée.
 *
 * Une facture sans TVA en porte quand même une : au taux zéro, avec sa catégorie et le motif
 * de l'exonération. L'omettre ferait croire à une facture dont on aurait oublié la TVA.
 */
function taxeExonereeXml(baseHT: number, categorie: CategorieTva, motif: string): string {
  const morceaux = [
    noeud('ram:CalculatedAmount', montantFacturx(0), ' currencyID="EUR"'),
    '<ram:TypeCode>VAT</ram:TypeCode>',
    noeud('ram:ExemptionReason', motif),
    noeud('ram:BasisAmount', montantFacturx(baseHT), ' currencyID="EUR"'),
    noeud('ram:CategoryCode', categorie),
    '<ram:DueDateTypeCode>5</ram:DueDateTypeCode>',
    noeud('ram:RateApplicablePercent', montantFacturx(0)),
  ];
  return `<ram:ApplicableTradeTax>${morceaux.join('')}</ram:ApplicableTradeTax>`;
}

/**
 * Des totaux ramenés à un montant TTC voulu, la TVA restant ventilée par taux.
 *
 * Une **facture d'acompte** porte les lignes du chantier entier — c'est ce que le client doit
 * voir — mais ne réclame qu'une fraction du total. Le PDF le dit en toutes lettres ; le XML,
 * lui, ne peut pas : la norme exige que `GrandTotal − Prepaid = DuePayable`, et un document
 * qui annonce 1 234,20 € de total pour 370,26 € dus sans rien entre les deux est rejeté par
 * tout destinataire qui vérifie (règle BR-CO-16 d'EN 16931).
 *
 * Deux façons de fermer l'égalité, et une seule est honnête. Déclarer la différence comme
 * déjà payée serait un mensonge : rien n'a été versé. On ramène donc le document à ce qu'il
 * réclame vraiment — l'acompte, avec sa propre base et sa propre TVA, réparties au prorata de
 * chaque taux. Le dernier taux absorbe l'arrondi, pour que la somme des parts égale le total
 * au centime.
 */
export function totauxRamenesA(totaux: Totaux, ttcVoulu: number): Totaux {
  const centimesVoulus = Math.round(ttcVoulu * 100);
  const centimesSource = Math.round(totaux.totalTTC * 100);
  if (centimesSource === 0 || centimesSource === centimesVoulus || totaux.tva.length === 0) {
    return totaux;
  }

  // On répartit d'abord le TTC entre les taux, puis on déduit base et TVA de chaque part.
  // L'inverse — mettre la base et la TVA à l'échelle chacune de son côté — ne se recompose
  // pas toujours, et un centime d'écart suffit à faire rejeter la facture.
  let ttcPose = 0;
  const parts = totaux.tva.map((ligne, rang) => {
    const dernier = rang === totaux.tva.length - 1;
    const ttcLigne = dernier
      ? centimesVoulus - ttcPose
      : Math.round(((ligne.baseHT + ligne.montant) * centimesVoulus * 100) / totaux.totalTTC / 100);
    ttcPose += ttcLigne;
    const base = Math.round(ttcLigne / (1 + ligne.taux / 100));
    return { taux: ligne.taux, baseHT: base / 100, montant: (ttcLigne - base) / 100 };
  });

  const totalHT = parts.reduce((somme, ligne) => somme + Math.round(ligne.baseHT * 100), 0) / 100;
  const totalTVA = parts.reduce((somme, ligne) => somme + Math.round(ligne.montant * 100), 0) / 100;

  return {
    totalBrutHT: totalHT,
    remiseHT: 0,
    totalHT,
    tva: parts,
    totalTVA,
    totalTTC: centimesVoulus / 100,
    acompteTTC: 0,
    soldeTTC: centimesVoulus / 100,
  };
}

/**
 * La remise, ventilée par taux de TVA.
 *
 * Une remise globale **ne peut pas** être déclarée en bloc quand la facture porte plusieurs
 * taux : dans le modèle CII, une réduction appartient à une catégorie et à un taux. L'attacher
 * entière au premier taux contredirait les bases de TVA déclarées juste au-dessus, que
 * `calculeTotaux` a déjà réduites chacune de sa part — et un destinataire qui recalcule verrait
 * la contradiction sans pouvoir dire laquelle des deux déclarations croire.
 *
 * La part de chaque taux se retrouve à partir de sa base nette : `calculeTotaux` applique la
 * remise proportionnellement, donc `base_nette = base_brute × (1 − r)`. La dernière part
 * **absorbe l'arrondi**, de sorte que la somme des parts égale toujours `AllowanceTotalAmount`
 * au centime. Sans cela, deux factures sur trois présenteraient un écart d'un centime entre le
 * récapitulatif et le détail — assez pour un rejet.
 */
function remisesParTaux(totaux: Totaux, categorie: CategorieTva, devise: string): string {
  if (totaux.remiseHT <= 0) return '';

  const taux =
    totaux.tva.length > 0 ? totaux.tva : [{ taux: 0, baseHT: totaux.totalHT, montant: 0 }];
  const proportion = totaux.totalBrutHT > 0 ? totaux.remiseHT / totaux.totalBrutHT : 0;

  const centimesTotal = Math.round(totaux.remiseHT * 100);
  let centimesPoses = 0;

  return taux
    .map((ligne, rang) => {
      const brutHT = proportion < 1 ? ligne.baseHT / (1 - proportion) : ligne.baseHT;
      const dernier = rang === taux.length - 1;
      const centimes = dernier
        ? centimesTotal - centimesPoses
        : Math.round((brutHT - ligne.baseHT) * 100);
      centimesPoses += centimes;

      return (
        '<ram:SpecifiedTradeAllowanceCharge>' +
        '<ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>' +
        noeud('ram:BasisAmount', montantFacturx(ligne.baseHT + centimes / 100), devise) +
        noeud('ram:ActualAmount', montantFacturx(centimes / 100), devise) +
        noeud('ram:Reason', 'Remise') +
        '<ram:CategoryTradeTax><ram:TypeCode>VAT</ram:TypeCode>' +
        noeud('ram:CategoryCode', categorie) +
        '<ram:DueDateTypeCode>5</ram:DueDateTypeCode>' +
        noeud('ram:RateApplicablePercent', montantFacturx(ligne.taux)) +
        '</ram:CategoryTradeTax>' +
        '</ram:SpecifiedTradeAllowanceCharge>'
      );
    })
    .join('');
}

/**
 * Le XML Factur-X d'une facture, au profil BASIC WL.
 *
 * L'ordre des éléments suit le schéma : il n'est pas réarrangeable. Le résultat est une seule
 * ligne, sans indentation — le fichier est destiné à une machine, et l'indenter ne ferait
 * qu'ajouter des octets à chaque facture.
 */
export function xmlFacturx(facture: FactureFacturx): string {
  const { totaux } = facture;
  const categorie = categorieTvaDe(facture);
  const devise = ' currencyID="EUR"';

  const notes = facture.notes
    .map(
      (note) =>
        `<ram:IncludedNote>${noeud('ram:Content', note.texte)}${noeud('ram:SubjectCode', note.code)}</ram:IncludedNote>`,
    )
    .join('');

  const document = [
    noeud('ram:ID', facture.numero),
    noeud('ram:TypeCode', facture.avoir ? CODE_AVOIR : CODE_FACTURE),
    `<ram:IssueDateTime>${noeud('udt:DateTimeString', dateFacturx(facture.emiseLe), ' format="102"')}</ram:IssueDateTime>`,
    notes,
  ].join('');

  const accord = [
    partieXml('ram:SellerTradeParty', facture.vendeur),
    partieXml('ram:BuyerTradeParty', facture.acheteur),
  ].join('');

  const livraison =
    facture.livreeLe === null
      ? '<ram:ApplicableHeaderTradeDelivery/>'
      : `<ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime>${noeud('udt:DateTimeString', dateFacturx(facture.livreeLe), ' format="102"')}</ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>`;

  // Virement : code 30 (UNTDID 4461). On ne l'annonce que si un IBAN existe — déclarer un
  // moyen de paiement sans coordonnées ne renseigne personne.
  const moyenDePaiement =
    facture.iban === null
      ? ''
      : `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>30</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount>${noeud('ram:IBANID', facture.iban.replace(/\s+/g, ''))}</ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>`;

  const taxes =
    categorie === 'S'
      ? totaux.tva.map((ligne) => taxeXml(ligne, categorie)).join('')
      : taxeExonereeXml(
          totaux.totalHT,
          categorie,
          categorie === 'AE'
            ? 'Autoliquidation : TVA due par le preneur, article 283-2 nonies du CGI'
            : 'TVA non applicable, article 293 B du CGI',
        );

  const remise = remisesParTaux(totaux, categorie, devise);

  const echeance =
    facture.echeanceLe === null
      ? ''
      : `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime>${noeud('udt:DateTimeString', dateFacturx(facture.echeanceLe), ' format="102"')}</ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>`;

  const sommes = [
    noeud('ram:LineTotalAmount', montantFacturx(totaux.totalBrutHT), devise),
    ...(totaux.remiseHT > 0
      ? [noeud('ram:AllowanceTotalAmount', montantFacturx(totaux.remiseHT), devise)]
      : []),
    noeud('ram:TaxBasisTotalAmount', montantFacturx(totaux.totalHT), devise),
    noeud('ram:TaxTotalAmount', montantFacturx(totaux.totalTVA), devise),
    noeud('ram:GrandTotalAmount', montantFacturx(totaux.totalTTC), devise),
    ...(facture.acompteDejaFactureTTC > 0
      ? [noeud('ram:TotalPrepaidAmount', montantFacturx(facture.acompteDejaFactureTTC), devise)]
      : []),
    noeud('ram:DuePayableAmount', montantFacturx(facture.montantAPayerTTC), devise),
  ].join('');

  const reglement = [
    '<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>',
    moyenDePaiement,
    taxes,
    remise,
    echeance,
    `<ram:SpecifiedTradeSettlementHeaderMonetarySummation>${sommes}</ram:SpecifiedTradeSettlementHeaderMonetarySummation>`,
  ].join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rsm:CrossIndustryInvoice' +
    ' xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"' +
    ' xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"' +
    ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"' +
    ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"' +
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<rsm:ExchangedDocumentContext>' +
    '<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>A1</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>' +
    `<ram:GuidelineSpecifiedDocumentContextParameter>${noeud('ram:ID', PROFIL_FACTURX)}</ram:GuidelineSpecifiedDocumentContextParameter>` +
    '</rsm:ExchangedDocumentContext>' +
    `<rsm:ExchangedDocument>${document}</rsm:ExchangedDocument>` +
    '<rsm:SupplyChainTradeTransaction>' +
    `<ram:ApplicableHeaderTradeAgreement>${accord}</ram:ApplicableHeaderTradeAgreement>` +
    livraison +
    `<ram:ApplicableHeaderTradeSettlement>${reglement}</ram:ApplicableHeaderTradeSettlement>` +
    '</rsm:SupplyChainTradeTransaction>' +
    '</rsm:CrossIndustryInvoice>'
  );
}
