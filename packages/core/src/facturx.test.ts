/**
 * Le XML Factur-X.
 *
 * Ces tests **analysent** le document au lieu de chercher des morceaux de chaîne. La
 * différence n'est pas cosmétique : un test qui vérifie que le texte contient
 * `<ram:GrandTotalAmount` passe encore quand la balise s'est retrouvée au mauvais niveau, ou
 * quand le document n'est plus bien formé du tout. Or c'est précisément ce que le destinataire
 * vérifiera, et son rejet n'expliquera rien.
 *
 * Deux propriétés valent tous les autres tests de ce fichier.
 *
 * **Le total dû est celui du PDF.** Un XML qui refait l'arithmétique produit un jour un
 * fichier qui contredit la facture qu'il accompagne — c'est exactement l'écart que Factur-X
 * existe pour empêcher.
 *
 * **L'ordre des éléments est respecté.** Le schéma CII l'impose ; un élément correct au
 * mauvais endroit rend le document invalide, et rien dans le code ne le signale.
 */

import { describe, expect, it } from 'vitest';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { calculeTotaux } from './devis.ts';
import {
  CODE_AVOIR,
  CODE_FACTURE,
  PROFIL_FACTURX,
  categorieTvaDe,
  dateFacturx,
  montantFacturx,
  totauxRamenesA,
  xmlFacturx,
  xmpFacturx,
  type FactureFacturx,
} from './facturx.ts';

const analyseur = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  parseAttributeValue: false,
});

/** Le document analysé, pour interroger sa structure plutôt que son texte. */
function analyse(xml: string): Record<string, never> {
  expect(XMLValidator.validate(xml)).toBe(true);
  return analyseur.parse(xml) as Record<string, never>;
}

/** Suit un chemin de balises, et échoue en nommant celle qui manque. */
function au(racine: unknown, ...chemin: readonly string[]): unknown {
  let courant: unknown = racine;
  for (const balise of chemin) {
    expect(courant, `chemin interrompu avant « ${balise} »`).toBeTypeOf('object');
    courant = (courant as Record<string, unknown>)[balise];
    expect(courant, `« ${balise} » absent`).toBeDefined();
  }
  return courant;
}

/** L'ordre réel des enfants d'un élément, tel que le schéma l'impose. */
function ordreDesEnfants(xml: string, parent: string): string[] {
  const ouverture = xml.indexOf(`<${parent}>`);
  const fermeture = xml.indexOf(`</${parent}>`, ouverture);
  const contenu = xml.slice(ouverture + parent.length + 2, fermeture);
  const enfants: string[] = [];
  let profondeur = 0;
  for (const correspondance of contenu.matchAll(/<(\/?)([\w:]+)[^>]*?(\/?)>/g)) {
    const [, fermante, nom, autofermante] = correspondance;
    if (fermante === '/') {
      profondeur -= 1;
      continue;
    }
    if (profondeur === 0) enfants.push(nom ?? '');
    if (autofermante !== '/') profondeur += 1;
  }
  return enfants;
}

const LIGNES = [
  {
    id: 'l1',
    type: 'prestation' as const,
    designation: 'Remplacement du chauffe-eau',
    quantite: 1,
    unite: 'forfait' as const,
    prixUnitaireHT: 890,
    tauxTva: 10 as const,
  },
  {
    id: 'l2',
    type: 'prestation' as const,
    designation: 'Fourniture de joints',
    quantite: 4,
    unite: 'unite' as const,
    prixUnitaireHT: 12,
    tauxTva: 20 as const,
  },
];

function facture(modification: Partial<FactureFacturx> = {}): FactureFacturx {
  const totaux = calculeTotaux({ lignes: LIGNES });
  return {
    numero: 'FA-2026-0007',
    emiseLe: new Date(2026, 2, 10, 9, 0, 0),
    echeanceLe: new Date(2026, 3, 9, 9, 0, 0),
    livreeLe: new Date(2026, 2, 9, 8, 0, 0),
    avoir: false,
    vendeur: {
      nom: 'Plomberie Exemple',
      siret: '12345678900017',
      numeroTva: 'FR12345678900',
      adresse: { voie: '12 rue des Lilas', codePostal: '75011', commune: 'Paris' },
      email: 'contact@exemple.test',
    },
    acheteur: {
      nom: 'Madame Dupuis',
      siret: null,
      numeroTva: null,
      adresse: { voie: '3 allée des Tilleuls', codePostal: '93100', commune: 'Montreuil' },
    },
    totaux,
    acompteDejaFactureTTC: 0,
    montantAPayerTTC: totaux.totalTTC,
    iban: 'FR76 3000 1007 9412 3456 7890 185',
    franchiseTva: false,
    autoliquidation: false,
    notes: [{ code: 'ABL', texte: 'Répertoire des métiers Paris' }],
    ...modification,
  };
}

describe('xmlFacturx', () => {
  it('produit un document bien formé, au profil annoncé', () => {
    const arbre = analyse(xmlFacturx(facture()));
    expect(
      au(
        arbre,
        'rsm:CrossIndustryInvoice',
        'rsm:ExchangedDocumentContext',
        'ram:GuidelineSpecifiedDocumentContextParameter',
        'ram:ID',
      ),
    ).toBe(PROFIL_FACTURX);
  });

  it('porte le numéro, la date et le code de document', () => {
    const doc = au(
      analyse(xmlFacturx(facture())),
      'rsm:CrossIndustryInvoice',
      'rsm:ExchangedDocument',
    ) as Record<string, unknown>;

    expect(doc['ram:ID']).toBe('FA-2026-0007');
    expect(doc['ram:TypeCode']).toBe(CODE_FACTURE);
    expect(
      (au(doc, 'ram:IssueDateTime', 'udt:DateTimeString') as Record<string, unknown>)['#text'],
    ).toBe('20260310');
  });

  it('distingue un avoir d’une facture par son code', () => {
    // Un avoir envoyé sous le code d'une facture est comptabilisé à l'envers par le logiciel
    // qui le reçoit : il augmente la dette au lieu de la réduire.
    const arbre = analyse(xmlFacturx(facture({ avoir: true })));
    expect(au(arbre, 'rsm:CrossIndustryInvoice', 'rsm:ExchangedDocument', 'ram:TypeCode')).toBe(
      CODE_AVOIR,
    );
  });

  describe('les parties', () => {
    it('identifie le vendeur par son SIRET, sa TVA et son adresse', () => {
      const vendeur = au(
        analyse(xmlFacturx(facture())),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeAgreement',
        'ram:SellerTradeParty',
      ) as Record<string, unknown>;

      expect((vendeur['ram:ID'] as Record<string, unknown>)['#text']).toBe('12345678900017');
      expect(vendeur['ram:Name']).toBe('Plomberie Exemple');
      expect(
        (au(vendeur, 'ram:SpecifiedTaxRegistration', 'ram:ID') as Record<string, unknown>)['#text'],
      ).toBe('FR12345678900');
      expect(au(vendeur, 'ram:PostalTradeAddress', 'ram:CityName')).toBe('Paris');
      expect(au(vendeur, 'ram:PostalTradeAddress', 'ram:CountryID')).toBe('FR');
    });

    it('accepte un acheteur particulier, sans SIRET ni TVA', () => {
      // Le cas ordinaire du Renom : le client est un particulier. Un XML qui exigerait son
      // SIRET ne pourrait tout simplement pas être produit.
      const acheteur = au(
        analyse(xmlFacturx(facture())),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeAgreement',
        'ram:BuyerTradeParty',
      ) as Record<string, unknown>;

      expect(acheteur['ram:Name']).toBe('Madame Dupuis');
      expect(acheteur['ram:ID']).toBeUndefined();
      expect(acheteur['ram:SpecifiedTaxRegistration']).toBeUndefined();
      expect(au(acheteur, 'ram:PostalTradeAddress', 'ram:CityName')).toBe('Montreuil');
    });

    it('échappe les caractères qui casseraient le document', () => {
      // « Dupont & Fils » suffit à rendre le fichier illisible pour le destinataire, qui le
      // rejettera sans dire pourquoi.
      const xml = xmlFacturx(
        facture({
          vendeur: { ...facture().vendeur, nom: 'Dupont & Fils <SARL> "Plomberie" d’Antan' },
        }),
      );
      const arbre = analyse(xml);
      expect(
        au(
          arbre,
          'rsm:CrossIndustryInvoice',
          'rsm:SupplyChainTradeTransaction',
          'ram:ApplicableHeaderTradeAgreement',
          'ram:SellerTradeParty',
          'ram:Name',
        ),
      ).toBe('Dupont & Fils <SARL> "Plomberie" d’Antan');
    });
  });

  describe('la TVA', () => {
    it('ventile par taux, une ligne par taux', () => {
      const taxes = au(
        analyse(xmlFacturx(facture())),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
        'ram:ApplicableTradeTax',
      ) as Record<string, unknown>[];

      expect(taxes).toHaveLength(2);
      const taux = taxes.map((taxe) => taxe['ram:RateApplicablePercent']);
      expect(taux).toEqual(['10.00', '20.00']);
      for (const taxe of taxes) expect(taxe['ram:CategoryCode']).toBe('S');
    });

    it('porte une ligne exonérée, avec son motif, en franchise en base', () => {
      // Une facture sans TVA en porte quand même une : l'omettre ferait croire à une TVA
      // oubliée plutôt qu'à une exonération.
      const totaux = calculeTotaux({ lignes: LIGNES });
      const taxe = au(
        analyse(xmlFacturx(facture({ franchiseTva: true }))),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
        'ram:ApplicableTradeTax',
      ) as Record<string, unknown>;

      expect(taxe['ram:CategoryCode']).toBe('E');
      expect(taxe['ram:ExemptionReason']).toContain('293 B');
      expect(taxe['ram:RateApplicablePercent']).toBe('0.00');
      expect((taxe['ram:BasisAmount'] as Record<string, unknown>)['#text']).toBe(
        montantFacturx(totaux.totalHT),
      );
    });

    it('marque l’autoliquidation de sa propre catégorie', () => {
      const taxe = au(
        analyse(xmlFacturx(facture({ autoliquidation: true }))),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
        'ram:ApplicableTradeTax',
      ) as Record<string, unknown>;

      expect(taxe['ram:CategoryCode']).toBe('AE');
      expect(taxe['ram:ExemptionReason']).toContain('283-2 nonies');
    });

    it('fait primer l’autoliquidation sur la franchise', () => {
      expect(categorieTvaDe({ franchiseTva: true, autoliquidation: true })).toBe('AE');
      expect(categorieTvaDe({ franchiseTva: true, autoliquidation: false })).toBe('E');
      expect(categorieTvaDe({ franchiseTva: false, autoliquidation: false })).toBe('S');
    });
  });

  describe('les montants', () => {
    it('reprend les totaux calculés, sans les refaire', () => {
      const totaux = calculeTotaux({ lignes: LIGNES });
      const sommes = au(
        analyse(xmlFacturx(facture())),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
        'ram:SpecifiedTradeSettlementHeaderMonetarySummation',
      ) as Record<string, Record<string, unknown>>;

      expect(sommes['ram:TaxBasisTotalAmount']?.['#text']).toBe(montantFacturx(totaux.totalHT));
      expect(sommes['ram:TaxTotalAmount']?.['#text']).toBe(montantFacturx(totaux.totalTVA));
      expect(sommes['ram:GrandTotalAmount']?.['#text']).toBe(montantFacturx(totaux.totalTTC));
      expect(sommes['ram:DuePayableAmount']?.['#text']).toBe(montantFacturx(totaux.totalTTC));
    });

    it('retranche l’acompte déjà facturé du montant dû', () => {
      const totaux = calculeTotaux({ lignes: LIGNES });
      const sommes = au(
        analyse(
          xmlFacturx(
            facture({
              acompteDejaFactureTTC: 300,
              montantAPayerTTC: totaux.totalTTC - 300,
            }),
          ),
        ),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
        'ram:SpecifiedTradeSettlementHeaderMonetarySummation',
      ) as Record<string, Record<string, unknown>>;

      expect(sommes['ram:TotalPrepaidAmount']?.['#text']).toBe('300.00');
      expect(sommes['ram:DuePayableAmount']?.['#text']).toBe(montantFacturx(totaux.totalTTC - 300));
    });

    it('n’annonce pas d’acompte quand il n’y en a pas', () => {
      const sommes = au(
        analyse(xmlFacturx(facture())),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
        'ram:SpecifiedTradeSettlementHeaderMonetarySummation',
      ) as Record<string, unknown>;
      expect(sommes['ram:TotalPrepaidAmount']).toBeUndefined();
    });

    it('respecte l’ordre imposé par le schéma dans le récapitulatif', () => {
      // Un élément correct au mauvais endroit rend le document invalide, et rien dans le
      // code ne le signale : seul le rejet du destinataire l'apprendrait.
      const totaux = calculeTotaux({ lignes: LIGNES, remisePourcent: 5 });
      const xml = xmlFacturx(
        facture({ totaux, acompteDejaFactureTTC: 100, montantAPayerTTC: totaux.totalTTC - 100 }),
      );
      expect(ordreDesEnfants(xml, 'ram:SpecifiedTradeSettlementHeaderMonetarySummation')).toEqual([
        'ram:LineTotalAmount',
        'ram:AllowanceTotalAmount',
        'ram:TaxBasisTotalAmount',
        'ram:TaxTotalAmount',
        'ram:GrandTotalAmount',
        'ram:TotalPrepaidAmount',
        'ram:DuePayableAmount',
      ]);
    });

    it('respecte l’ordre imposé dans le bloc de règlement', () => {
      const xml = xmlFacturx(facture());
      expect(ordreDesEnfants(xml, 'ram:ApplicableHeaderTradeSettlement')).toEqual([
        'ram:InvoiceCurrencyCode',
        'ram:SpecifiedTradeSettlementPaymentMeans',
        'ram:ApplicableTradeTax',
        'ram:ApplicableTradeTax',
        'ram:SpecifiedTradePaymentTerms',
        'ram:SpecifiedTradeSettlementHeaderMonetarySummation',
      ]);
    });

    it('écrit les montants avec un point décimal et deux décimales', () => {
      // Une virgule française produirait un nombre que le schéma refuse, et l'erreur ne se
      // verrait qu'au rejet, chez le destinataire.
      expect(montantFacturx(1234.5)).toBe('1234.50');
      expect(montantFacturx(0)).toBe('0.00');
      expect(montantFacturx(0.005)).toBe('0.01');
      expect(montantFacturx(1122)).toBe('1122.00');
      expect(montantFacturx(1234.5)).not.toContain(',');
    });
  });

  describe('le règlement', () => {
    it('donne l’IBAN sans ses espaces', () => {
      const moyen = au(
        analyse(xmlFacturx(facture())),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
        'ram:SpecifiedTradeSettlementPaymentMeans',
      ) as Record<string, unknown>;

      expect(moyen['ram:TypeCode']).toBe('30');
      expect(au(moyen, 'ram:PayeePartyCreditorFinancialAccount', 'ram:IBANID')).toBe(
        'FR7630001007941234567890185',
      );
    });

    it('n’annonce aucun moyen de paiement sans IBAN', () => {
      // Déclarer un virement sans coordonnées ne renseigne personne.
      const reglement = au(
        analyse(xmlFacturx(facture({ iban: null }))),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
      ) as Record<string, unknown>;
      expect(reglement['ram:SpecifiedTradeSettlementPaymentMeans']).toBeUndefined();
    });

    it('porte l’échéance, et l’omet quand il n’y en a pas', () => {
      expect(
        (
          au(
            analyse(xmlFacturx(facture())),
            'rsm:CrossIndustryInvoice',
            'rsm:SupplyChainTradeTransaction',
            'ram:ApplicableHeaderTradeSettlement',
            'ram:SpecifiedTradePaymentTerms',
            'ram:DueDateDateTime',
            'udt:DateTimeString',
          ) as Record<string, unknown>
        )['#text'],
      ).toBe('20260409');

      const sansEcheance = au(
        analyse(xmlFacturx(facture({ echeanceLe: null }))),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
      ) as Record<string, unknown>;
      expect(sansEcheance['ram:SpecifiedTradePaymentTerms']).toBeUndefined();
    });

    it('déclare la remise comme une déduction, pas comme un supplément', () => {
      // `ChargeIndicator` à `true` transformerait une remise en majoration : le destinataire
      // réclamerait davantage que ce que le PDF annonce.
      const totaux = calculeTotaux({ lignes: [LIGNES[0]!], remisePourcent: 10 });
      const remise = au(
        analyse(xmlFacturx(facture({ totaux, montantAPayerTTC: totaux.totalTTC }))),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
        'ram:SpecifiedTradeAllowanceCharge',
      ) as Record<string, unknown>;

      expect(au(remise, 'ram:ChargeIndicator', 'udt:Indicator')).toBe('false');
      expect((remise['ram:ActualAmount'] as Record<string, unknown>)['#text']).toBe(
        montantFacturx(totaux.remiseHT),
      );
    });

    it('ventile la remise par taux, et la somme des parts égale le total', () => {
      // Une remise attachée en bloc au premier taux contredirait les bases de TVA déclarées
      // juste au-dessus, que `calculeTotaux` a déjà réduites chacune de sa part.
      const totaux = calculeTotaux({ lignes: LIGNES, remisePourcent: 5 });
      const remises = au(
        analyse(xmlFacturx(facture({ totaux, montantAPayerTTC: totaux.totalTTC }))),
        'rsm:CrossIndustryInvoice',
        'rsm:SupplyChainTradeTransaction',
        'ram:ApplicableHeaderTradeSettlement',
        'ram:SpecifiedTradeAllowanceCharge',
      ) as Record<string, Record<string, unknown>>[];

      expect(remises).toHaveLength(2);
      expect(remises.map((r) => r['ram:CategoryTradeTax']?.['ram:RateApplicablePercent'])).toEqual([
        '10.00',
        '20.00',
      ]);

      const centimes = remises.reduce(
        (somme, r) => somme + Math.round(Number(r['ram:ActualAmount']?.['#text']) * 100),
        0,
      );
      expect(centimes).toBe(Math.round(totaux.remiseHT * 100));
    });

    it('ne laisse jamais un centime d’écart entre le détail et le récapitulatif', () => {
      // La dernière part absorbe l'arrondi. Sans cela, deux factures sur trois présenteraient
      // un écart d'un centime — assez pour un rejet.
      for (const pourcent of [1, 3, 5, 7, 11, 13, 17, 23, 37]) {
        const totaux = calculeTotaux({ lignes: LIGNES, remisePourcent: pourcent });
        const xml = xmlFacturx(facture({ totaux, montantAPayerTTC: totaux.totalTTC }));
        const parts = [...xml.matchAll(/<ram:ActualAmount currencyID="EUR">([\d.]+)</g)].map((c) =>
          Math.round(Number(c[1]) * 100),
        );
        expect(
          parts.reduce((a, b) => a + b, 0),
          `remise de ${String(pourcent)} %`,
        ).toBe(Math.round(totaux.remiseHT * 100));
      }
    });
  });

  describe('les mentions', () => {
    it('reprend les notes avec leur code', () => {
      const note = au(
        analyse(
          xmlFacturx(
            facture({
              notes: [
                { code: 'REG', texte: 'SARL au capital de 10 000 EUR' },
                { code: 'PMD', texte: 'Pénalités au taux BCE majoré de dix points' },
              ],
            }),
          ),
        ),
        'rsm:CrossIndustryInvoice',
        'rsm:ExchangedDocument',
        'ram:IncludedNote',
      ) as Record<string, unknown>[];

      expect(note).toHaveLength(2);
      expect(note[0]?.['ram:SubjectCode']).toBe('REG');
      expect(note[1]?.['ram:Content']).toContain('dix points');
    });

    it('porte la date de livraison quand elle diffère', () => {
      expect(
        (
          au(
            analyse(xmlFacturx(facture())),
            'rsm:CrossIndustryInvoice',
            'rsm:SupplyChainTradeTransaction',
            'ram:ApplicableHeaderTradeDelivery',
            'ram:ActualDeliverySupplyChainEvent',
            'ram:OccurrenceDateTime',
            'udt:DateTimeString',
          ) as Record<string, unknown>
        )['#text'],
      ).toBe('20260309');
    });

    it('reste bien formé sans date de livraison', () => {
      const xml = xmlFacturx(facture({ livreeLe: null }));
      expect(XMLValidator.validate(xml)).toBe(true);
      expect(xml).toContain('<ram:ApplicableHeaderTradeDelivery/>');
    });
  });
});

describe('dateFacturx', () => {
  it('écrit la date au format 102, en heure locale', () => {
    expect(dateFacturx(new Date(2026, 0, 5, 23, 30))).toBe('20260105');
    expect(dateFacturx(new Date(2026, 11, 31, 1, 0))).toBe('20261231');
  });

  it('ne décale pas la date en fin de journée', () => {
    // En UTC, une facture du 31 décembre à 23 h 30 à Paris devient le 1er janvier : elle
    // changerait d'exercice comptable.
    expect(dateFacturx(new Date(2026, 11, 31, 23, 30))).toBe('20261231');
  });
});

describe('totauxRamenesA', () => {
  /** Une facture d'acompte réclame une fraction d'un chantier dont elle montre tout. */
  it('ramène des totaux à un TTC voulu, et l’égalité se ferme', () => {
    const totaux = calculeTotaux({ lignes: [LIGNES[0]!] });
    const acompte = totauxRamenesA(totaux, 370.26);

    expect(acompte.totalTTC).toBe(370.26);
    expect(acompte.totalHT + acompte.totalTVA).toBeCloseTo(370.26, 10);
    expect(acompte.tva[0]?.taux).toBe(10);
    expect(acompte.totalHT).toBe(336.6);
    expect(acompte.totalTVA).toBe(33.66);
  });

  it('répartit entre plusieurs taux sans perdre un centime', () => {
    const totaux = calculeTotaux({ lignes: LIGNES });
    for (const pourcent of [10, 30, 33, 40, 45, 50, 66, 70]) {
      const voulu = Math.round(totaux.totalTTC * pourcent) / 100;
      const ramenes = totauxRamenesA(totaux, voulu);

      const baseCentimes = ramenes.tva.reduce((s, l) => s + Math.round(l.baseHT * 100), 0);
      const tvaCentimes = ramenes.tva.reduce((s, l) => s + Math.round(l.montant * 100), 0);

      expect(ramenes.totalTTC, `${String(pourcent)} %`).toBe(voulu);
      expect(baseCentimes + tvaCentimes, `${String(pourcent)} %`).toBe(Math.round(voulu * 100));
      expect(Math.round(ramenes.totalHT * 100), `${String(pourcent)} %`).toBe(baseCentimes);
      expect(Math.round(ramenes.totalTVA * 100), `${String(pourcent)} %`).toBe(tvaCentimes);
      expect(ramenes.tva.map((l) => l.taux)).toEqual([10, 20]);
    }
  });

  it('ne touche à rien quand le montant voulu est déjà le bon', () => {
    const totaux = calculeTotaux({ lignes: LIGNES });
    expect(totauxRamenesA(totaux, totaux.totalTTC)).toBe(totaux);
  });

  it('ne divise pas par zéro sur une facture vide', () => {
    const vides = calculeTotaux({ lignes: [] });
    expect(totauxRamenesA(vides, 100)).toBe(vides);
  });

  it('produit un XML dont le total dû égale le total général', () => {
    // C'est la règle que le destinataire vérifie, et la seule raison d'être de cette
    // fonction : `GrandTotal − Prepaid = DuePayable`.
    const totaux = calculeTotaux({ lignes: LIGNES });
    const acompte = totauxRamenesA(totaux, 300);
    const sommes = au(
      analyse(xmlFacturx(facture({ totaux: acompte, montantAPayerTTC: 300 }))),
      'rsm:CrossIndustryInvoice',
      'rsm:SupplyChainTradeTransaction',
      'ram:ApplicableHeaderTradeSettlement',
      'ram:SpecifiedTradeSettlementHeaderMonetarySummation',
    ) as Record<string, Record<string, unknown>>;

    expect(sommes['ram:GrandTotalAmount']?.['#text']).toBe('300.00');
    expect(sommes['ram:DuePayableAmount']?.['#text']).toBe('300.00');
    expect(sommes['ram:TotalPrepaidAmount']).toBeUndefined();
  });
});

describe('xmpFacturx', () => {
  it('déclare le profil et le nom de fichier que le lecteur cherche', () => {
    const xmp = xmpFacturx({ creeLe: new Date('2026-03-04T10:00:00Z') });
    expect(xmp).toContain('<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>');
    expect(xmp).toContain('<fx:ConformanceLevel>BASIC WL</fx:ConformanceLevel>');
    expect(xmp).toContain('<fx:DocumentType>INVOICE</fx:DocumentType>');
    expect(xmp).toContain('<fx:Version>1.0</fx:Version>');
  });

  it('annonce PDF/A-3 B', () => {
    const xmp = xmpFacturx();
    expect(xmp).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(xmp).toContain('<pdfaid:conformance>B</pdfaid:conformance>');
  });

  it('décrit son extension, faute de quoi PDF/A refuse un espace de noms inconnu', () => {
    const xmp = xmpFacturx();
    expect(xmp).toContain('urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#');
    expect(xmp).toContain('<pdfaSchema:prefix>fx</pdfaSchema:prefix>');
    // Les quatre propriétés de l'extension doivent être décrites une à une.
    for (const nom of ['DocumentFileName', 'DocumentType', 'Version', 'ConformanceLevel']) {
      expect(xmp).toContain(`<pdfaProperty:name>${nom}</pdfaProperty:name>`);
    }
  });

  it('échappe le titre et l’auteur : une esperluette dans un nom casserait le paquet', () => {
    const xmp = xmpFacturx({ titre: 'Facture F-2026-0001', auteur: 'Durand & Fils' });
    expect(xmp).toContain('Durand &amp; Fils');
    expect(xmp).not.toContain('Durand & Fils');
  });

  it('écrit une date sans millisecondes, comme XMP l’attend', () => {
    const xmp = xmpFacturx({ creeLe: new Date('2026-03-04T10:00:00.123Z') });
    expect(xmp).toContain('<xmp:CreateDate>2026-03-04T10:00:00Z</xmp:CreateDate>');
  });

  it('ouvre et ferme le paquet xpacket, que les lecteurs repèrent pour le trouver', () => {
    const xmp = xmpFacturx();
    expect(xmp.startsWith('<?xpacket begin=')).toBe(true);
    expect(xmp.trimEnd().endsWith('<?xpacket end="w"?>')).toBe(true);
  });
});
