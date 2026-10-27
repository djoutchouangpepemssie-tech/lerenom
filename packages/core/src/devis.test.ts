import { describe, expect, it } from 'vitest';
import {
  LIBELLES_UNITE,
  TAUX_TVA,
  UNITES,
  calculeTotaux,
  devisConforme,
  montantLigneHT,
  numerotationContinue,
  prepareAvoir,
  prepareFactureAcompte,
  prepareFactureSolde,
  prochainNumero,
} from './devis.js';
import type { DocumentChiffrable, LigneDocument, MentionsDevis } from './devis.js';

function ligne(partiel: Partial<LigneDocument> & { id: string }): LigneDocument {
  return {
    type: 'prestation',
    designation: 'Prestation',
    unite: 'unite',
    quantite: 1,
    prixUnitaireHT: 100,
    tauxTva: 10,
    ...partiel,
  };
}

const MENTIONS_COMPLETES: MentionsDevis = {
  fraisDeplacementIndiques: true,
  validiteJours: 30,
  caractereGratuitIndique: true,
  piecesRemplaceesIndiquee: true,
};

describe('unités et taux', () => {
  it('propose les six unités de l’éditeur, avec leur libellé', () => {
    expect(UNITES).toEqual(['unite', 'heure', 'forfait', 'jour', 'm2', 'ml']);
    expect(LIBELLES_UNITE.m2).toBe('m²');
    expect(LIBELLES_UNITE.heure).toBe('h');
  });

  it('propose les trois taux de TVA des travaux', () => {
    expect(TAUX_TVA).toEqual([5.5, 10, 20]);
  });
});

describe('montantLigneHT', () => {
  it('accepte les quantités décimales : 2,5 h à 48 € font 120 €', () => {
    expect(montantLigneHT(ligne({ id: 'l1', quantite: 2.5, prixUnitaireHT: 48 }))).toBe(120);
  });

  it('arrondit au centime, comme sur le document imprimé', () => {
    expect(montantLigneHT(ligne({ id: 'l1', quantite: 3, prixUnitaireHT: 19.99 }))).toBe(59.97);
    expect(montantLigneHT(ligne({ id: 'l1', quantite: 1.5, prixUnitaireHT: 33.33 }))).toBe(50);
  });

  it('ne compte rien sur une section ou une ligne de texte', () => {
    expect(montantLigneHT(ligne({ id: 's', type: 'section', designation: 'Fournitures' }))).toBe(0);
    expect(
      montantLigneHT(ligne({ id: 't', type: 'texte', designation: 'Accès par la cour' })),
    ).toBe(0);
  });
});

describe('calculeTotaux', () => {
  it('additionne les lignes et applique la TVA du devis', () => {
    const document: DocumentChiffrable = {
      lignes: [
        ligne({
          id: 'l1',
          designation: 'Recherche de fuite',
          quantite: 1,
          prixUnitaireHT: 180,
          tauxTva: 10,
        }),
        ligne({
          id: 'l2',
          designation: 'Main-d’œuvre',
          unite: 'heure',
          quantite: 2.5,
          prixUnitaireHT: 48,
          tauxTva: 10,
        }),
      ],
    };
    const t = calculeTotaux(document);

    expect(t.totalBrutHT).toBe(300);
    expect(t.remiseHT).toBe(0);
    expect(t.totalHT).toBe(300);
    expect(t.totalTVA).toBe(30);
    expect(t.totalTTC).toBe(330);
    expect(t.tva).toEqual([{ taux: 10, baseHT: 300, montant: 30 }]);
  });

  it('ignore les sections et les lignes de texte dans les totaux', () => {
    const t = calculeTotaux({
      lignes: [
        ligne({ id: 's1', type: 'section', designation: 'Fournitures' }),
        ligne({ id: 'l1', prixUnitaireHT: 100, tauxTva: 20 }),
        ligne({ id: 't1', type: 'texte', designation: 'Reprise des enduits incluse' }),
      ],
    });
    expect(t.totalHT).toBe(100);
    expect(t.totalTTC).toBe(120);
  });

  it('sépare les bases de TVA quand plusieurs taux se côtoient', () => {
    const t = calculeTotaux({
      lignes: [
        ligne({ id: 'l1', prixUnitaireHT: 1000, tauxTva: 5.5 }),
        ligne({ id: 'l2', prixUnitaireHT: 1000, tauxTva: 10 }),
        ligne({ id: 'l3', prixUnitaireHT: 1000, tauxTva: 20 }),
      ],
    });

    expect(t.totalHT).toBe(3000);
    expect(t.tva).toEqual([
      { taux: 5.5, baseHT: 1000, montant: 55 },
      { taux: 10, baseHT: 1000, montant: 100 },
      { taux: 20, baseHT: 1000, montant: 200 },
    ]);
    expect(t.totalTVA).toBe(355);
    expect(t.totalTTC).toBe(3355);
  });

  it('répartit la remise au prorata de chaque taux, sans fausser la TVA déclarée', () => {
    const t = calculeTotaux({
      lignes: [
        ligne({ id: 'l1', prixUnitaireHT: 1000, tauxTva: 10 }),
        ligne({ id: 'l2', prixUnitaireHT: 1000, tauxTva: 20 }),
      ],
      remisePourcent: 10,
    });

    expect(t.totalBrutHT).toBe(2000);
    expect(t.remiseHT).toBe(200);
    expect(t.totalHT).toBe(1800);
    // Chaque base baisse de 10 %, et la somme des bases égale exactement le total HT.
    expect(t.tva).toEqual([
      { taux: 10, baseHT: 900, montant: 90 },
      { taux: 20, baseHT: 900, montant: 180 },
    ]);
    expect(t.tva.reduce((s, l) => s + l.baseHT, 0)).toBe(t.totalHT);
    expect(t.totalTTC).toBe(2070);
  });

  it('fait absorber l’arrondi de la remise par le dernier taux, au centime près', () => {
    const t = calculeTotaux({
      lignes: [
        ligne({ id: 'l1', prixUnitaireHT: 33.33, tauxTva: 10 }),
        ligne({ id: 'l2', prixUnitaireHT: 66.67, tauxTva: 20 }),
      ],
      remisePourcent: 7,
    });
    // La somme des bases doit toujours faire le total HT, quel que soit l'arrondi.
    expect(t.tva.reduce((s, l) => s + l.baseHT, 0)).toBeCloseTo(t.totalHT, 10);
    expect(t.totalTTC).toBeCloseTo(t.totalHT + t.totalTVA, 10);
  });

  it('borne la remise entre 0 et 100 %', () => {
    expect(calculeTotaux({ lignes: [ligne({ id: 'l1' })], remisePourcent: -20 }).remiseHT).toBe(0);
    const tout = calculeTotaux({ lignes: [ligne({ id: 'l1' })], remisePourcent: 150 });
    expect(tout.totalHT).toBe(0);
    expect(tout.totalTTC).toBe(0);
  });

  it('calcule l’acompte de 30 % et le solde sur le TTC', () => {
    const t = calculeTotaux({
      lignes: [ligne({ id: 'l1', prixUnitaireHT: 1000, tauxTva: 10 })],
      acomptePourcent: 30,
    });
    expect(t.totalTTC).toBe(1100);
    expect(t.acompteTTC).toBe(330);
    expect(t.soldeTTC).toBe(770);
    expect(t.acompteTTC + t.soldeTTC).toBeCloseTo(t.totalTTC, 10);
  });

  it('calcule l’acompte de 40 %', () => {
    const t = calculeTotaux({
      lignes: [ligne({ id: 'l1', prixUnitaireHT: 500, tauxTva: 20 })],
      acomptePourcent: 40,
    });
    expect(t.totalTTC).toBe(600);
    expect(t.acompteTTC).toBe(240);
    expect(t.soldeTTC).toBe(360);
  });

  it('ne demande aucun acompte par défaut', () => {
    const t = calculeTotaux({ lignes: [ligne({ id: 'l1' })] });
    expect(t.acompteTTC).toBe(0);
    expect(t.soldeTTC).toBe(t.totalTTC);
  });

  it('rend des totaux nuls sur un document vide', () => {
    const t = calculeTotaux({ lignes: [] });
    expect(t).toMatchObject({ totalBrutHT: 0, totalHT: 0, totalTVA: 0, totalTTC: 0 });
    expect(t.tva).toEqual([]);
  });

  it('ne perd pas un centime sur un gros document aux quantités décimales', () => {
    const lignes = Array.from({ length: 200 }, (_, i) =>
      ligne({ id: `l${i}`, quantite: 1.37, prixUnitaireHT: 23.49, tauxTva: 10 }),
    );
    const t = calculeTotaux({ lignes });
    // 1,37 × 23,49 = 32,1813 → 32,18 par ligne, 200 lignes = 6 436,00 €.
    expect(t.totalHT).toBe(6436);
    expect(t.totalTVA).toBe(643.6);
    expect(t.totalTTC).toBe(7079.6);
  });
});

describe('devisConforme', () => {
  const DEVIS: DocumentChiffrable = {
    lignes: [ligne({ id: 'l1', designation: 'Débouchage canalisation' })],
  };

  it('accepte un devis qui porte toutes les mentions obligatoires', () => {
    const resultat = devisConforme(DEVIS, MENTIONS_COMPLETES);
    expect(resultat.conforme).toBe(true);
    expect(resultat.manquants).toEqual([]);
  });

  it('refuse un devis sans ligne chiffrée', () => {
    const resultat = devisConforme(
      { lignes: [ligne({ id: 's', type: 'section', designation: 'Travaux' })] },
      MENTIONS_COMPLETES,
    );
    expect(resultat.conforme).toBe(false);
    expect(resultat.manquants[0]).toContain('ligne de prestation');
  });

  it('exige les frais de déplacement, même offerts', () => {
    const resultat = devisConforme(DEVIS, {
      ...MENTIONS_COMPLETES,
      fraisDeplacementIndiques: false,
    });
    expect(resultat.conforme).toBe(false);
    expect(resultat.manquants.join(' ')).toContain('Frais de déplacement');
  });

  it('exige la durée de validité, le caractère gratuit et les pièces remplacées', () => {
    const resultat = devisConforme(DEVIS, {
      fraisDeplacementIndiques: true,
      validiteJours: null,
      caractereGratuitIndique: false,
      piecesRemplaceesIndiquee: false,
    });
    expect(resultat.manquants).toHaveLength(3);
    expect(resultat.manquants.join(' ')).toContain('validité');
    expect(resultat.manquants.join(' ')).toContain('gratuit ou payant');
    expect(resultat.manquants.join(' ')).toContain('pièces remplacées');
  });

  it('exige une quantité et une unité sur chaque ligne, en nommant la ligne fautive', () => {
    const resultat = devisConforme(
      {
        lignes: [
          {
            id: 'l1',
            type: 'prestation',
            designation: 'Pose de robinet',
            quantite: 0,
            prixUnitaireHT: 90,
            tauxTva: 10,
          },
        ],
      },
      MENTIONS_COMPLETES,
    );
    expect(resultat.conforme).toBe(false);
    expect(resultat.manquants.join(' ')).toContain('Pose de robinet');
    expect(resultat.manquants.join(' ')).toContain('Quantité');
    expect(resultat.manquants.join(' ')).toContain('Unité');
  });
});

describe('facture préparée automatiquement à la signature', () => {
  const DEVIS_AVEC_ACOMPTE: DocumentChiffrable = {
    lignes: [ligne({ id: 'l1', prixUnitaireHT: 2000, tauxTva: 10 })],
    acomptePourcent: 30,
  };

  it('prépare la facture d’acompte au montant de l’acompte', () => {
    const facture = prepareFactureAcompte(DEVIS_AVEC_ACOMPTE);
    expect(facture?.type).toBe('acompte');
    expect(facture?.montantAPayerTTC).toBe(660); // 30 % de 2 200 €
  });

  it('ne prépare aucune facture d’acompte quand il n’y a pas d’acompte', () => {
    expect(prepareFactureAcompte({ lignes: [ligne({ id: 'l1' })] })).toBeNull();
    expect(prepareFactureAcompte({ lignes: [ligne({ id: 'l1' })], acomptePourcent: 0 })).toBeNull();
  });

  it('déduit l’acompte déjà facturé de la facture de solde', () => {
    const solde = prepareFactureSolde(DEVIS_AVEC_ACOMPTE, 660);
    expect(solde.type).toBe('solde');
    expect(solde.acompteDejaFactureTTC).toBe(660);
    expect(solde.montantAPayerTTC).toBe(1540);
    expect(solde.totaux.totalTTC).toBe(2200);
  });

  it('facture tout le TTC quand aucun acompte n’a été émis', () => {
    expect(
      prepareFactureSolde({ lignes: [ligne({ id: 'l1', prixUnitaireHT: 100, tauxTva: 20 })] })
        .montantAPayerTTC,
    ).toBe(120);
  });

  it('ne déduit jamais plus que le total, même sur une saisie aberrante', () => {
    const solde = prepareFactureSolde(DEVIS_AVEC_ACOMPTE, 99999);
    expect(solde.montantAPayerTTC).toBe(0);
    const negatif = prepareFactureSolde(DEVIS_AVEC_ACOMPTE, -500);
    expect(negatif.montantAPayerTTC).toBe(2200);
  });

  it('additionne exactement acompte et solde pour retrouver le total du devis', () => {
    const acompte = prepareFactureAcompte(DEVIS_AVEC_ACOMPTE)!;
    const solde = prepareFactureSolde(DEVIS_AVEC_ACOMPTE, acompte.montantAPayerTTC);
    expect(acompte.montantAPayerTTC + solde.montantAPayerTTC).toBeCloseTo(
      solde.totaux.totalTTC,
      10,
    );
  });
});

describe('prepareAvoir', () => {
  it('crée un avoir motivé : le seul moyen de corriger une facture émise', () => {
    const avoir = prepareAvoir('FA-2026-0012', 120.5, '  Erreur de quantité  ');
    expect(avoir).toEqual({
      factureNumero: 'FA-2026-0012',
      motif: 'Erreur de quantité',
      montantTTC: 120.5,
    });
  });

  it('refuse un avoir sans motif ou sans montant', () => {
    expect(prepareAvoir('FA-2026-0012', 0, 'Erreur')).toBeNull();
    expect(prepareAvoir('FA-2026-0012', -10, 'Erreur')).toBeNull();
    expect(prepareAvoir('FA-2026-0012', 100, '   ')).toBeNull();
  });
});

describe('numérotation', () => {
  it('démarre à 0001 sur la première facture de l’année', () => {
    expect(prochainNumero('FA', 2026, null)).toBe('FA-2026-0001');
    expect(prochainNumero('DV', 2026, null)).toBe('DV-2026-0001');
  });

  it('incrémente sans trou', () => {
    expect(prochainNumero('FA', 2026, 'FA-2026-0001')).toBe('FA-2026-0002');
    expect(prochainNumero('FA', 2026, 'FA-2026-0099')).toBe('FA-2026-0100');
    expect(prochainNumero('FA', 2026, 'FA-2026-9999')).toBe('FA-2026-10000');
  });

  it('repart à 0001 au changement d’année', () => {
    expect(prochainNumero('FA', 2027, 'FA-2026-0412')).toBe('FA-2027-0001');
  });

  it('repart à 0001 si le dernier numéro n’est pas lisible', () => {
    expect(prochainNumero('FA', 2026, 'ancien-systeme-42')).toBe('FA-2026-0001');
  });

  it('reconnaît une série continue', () => {
    expect(numerotationContinue(['FA-2026-0001', 'FA-2026-0002', 'FA-2026-0003'])).toBe(true);
    expect(numerotationContinue(['FA-2026-0007'])).toBe(true);
    expect(numerotationContinue([])).toBe(true);
  });

  it('refuse un trou dans la série : un trou est un défaut comptable', () => {
    expect(numerotationContinue(['FA-2026-0001', 'FA-2026-0003'])).toBe(false);
  });

  it('refuse un doublon', () => {
    expect(numerotationContinue(['FA-2026-0001', 'FA-2026-0001'])).toBe(false);
  });

  it('ne se laisse pas tromper par l’ordre de lecture', () => {
    expect(numerotationContinue(['FA-2026-0003', 'FA-2026-0001', 'FA-2026-0002'])).toBe(true);
  });

  it('refuse une série dont un numéro est illisible', () => {
    expect(numerotationContinue(['FA-2026-0001', 'brouillon'])).toBe(false);
  });
});
