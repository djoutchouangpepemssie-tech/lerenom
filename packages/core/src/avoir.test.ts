/**
 * L'avoir est le seul moyen de corriger une facture émise. Ce que ces tests gardent :
 *
 *   * **on ne crédite jamais plus qu'on n'a facturé** — y compris en plusieurs avoirs
 *     successifs, qui est la façon dont le dépassement arriverait réellement ;
 *   * **une facture non émise ne se crédite pas** : elle se corrige ;
 *   * **le motif est une phrase**, parce qu'il doit rester lisible un an plus tard ;
 *   * **tous les problèmes sont rendus ensemble**, pour qu'un formulaire se corrige en une
 *     fois.
 */

import { describe, expect, it } from 'vitest';
import {
  MOTIF_LONGUEUR_MINIMALE,
  prepareAvoir,
  problemesAvoir,
  resteACrediter,
  type FactureACrediter,
} from './avoir.ts';

const MOTIF = 'Erreur de quantité sur la main-d’œuvre';

function facture(modifications: Partial<FactureACrediter> = {}): FactureACrediter {
  return { statut: 'emise', montantAPayerTTC: 1000, dejaCrediteTTC: 0, ...modifications };
}

describe('resteACrediter', () => {
  it('rend le montant entier quand rien n’a été crédité', () => {
    expect(resteACrediter(facture())).toBe(1000);
  });

  it('déduit les avoirs déjà émis', () => {
    expect(resteACrediter(facture({ dejaCrediteTTC: 250.5 }))).toBe(749.5);
  });

  it('ne rend jamais un reste négatif', () => {
    // Une reprise de données pourrait produire cet état ; un reste négatif se lirait comme
    // un crédit disponible, ce qu'il n'est pas.
    expect(resteACrediter(facture({ dejaCrediteTTC: 1500 }))).toBe(0);
  });

  it('compte au centime, sans dérive des flottants', () => {
    expect(resteACrediter(facture({ montantAPayerTTC: 0.3, dejaCrediteTTC: 0.1 }))).toBe(0.2);
  });
});

describe('problemesAvoir', () => {
  it('ne reproche rien à un avoir valable', () => {
    expect(problemesAvoir({ montantTTC: 120.5, motif: MOTIF }, facture())).toEqual([]);
  });

  it('refuse de créditer une facture pas encore émise', () => {
    const problemes = problemesAvoir(
      { montantTTC: 100, motif: MOTIF },
      facture({ statut: 'prete' }),
    );
    expect(problemes.map((p) => p.champ)).toContain('facture');
    expect(problemes[0]?.message).toContain('corrigez-la directement');
  });

  it('crédite une facture déjà payée : le client sera remboursé', () => {
    // Payée ne veut pas dire intouchable : une erreur découverte après paiement se corrige
    // par un avoir, suivi d'un remboursement.
    expect(problemesAvoir({ montantTTC: 100, motif: MOTIF }, facture({ statut: 'payee' }))).toEqual(
      [],
    );
  });

  it('refuse un montant nul ou négatif', () => {
    for (const montantTTC of [0, -10, Number.NaN]) {
      const problemes = problemesAvoir({ montantTTC, motif: MOTIF }, facture());
      expect(problemes.map((p) => p.champ)).toContain('montantTTC');
    }
  });

  it('refuse de créditer plus que la facture', () => {
    const problemes = problemesAvoir({ montantTTC: 1000.01, motif: MOTIF }, facture());
    expect(problemes.map((p) => p.champ)).toContain('montantTTC');
    // Le message dit le plafond : « trop élevé » obligerait à chercher le chiffre ailleurs.
    expect(problemes[0]?.message).toContain('1000,00');
  });

  it('accepte très exactement le montant de la facture', () => {
    expect(problemesAvoir({ montantTTC: 1000, motif: MOTIF }, facture())).toEqual([]);
  });

  it('tient compte des avoirs déjà émis pour fixer le plafond', () => {
    // C'est ainsi que le dépassement arriverait vraiment : deux avoirs acceptables séparément.
    const partiellement = facture({ dejaCrediteTTC: 600 });
    expect(problemesAvoir({ montantTTC: 400, motif: MOTIF }, partiellement)).toEqual([]);
    expect(problemesAvoir({ montantTTC: 400.01, motif: MOTIF }, partiellement)).not.toEqual([]);
  });

  it('refuse une facture déjà entièrement créditée, sans parler du montant', () => {
    const problemes = problemesAvoir(
      { montantTTC: 50, motif: MOTIF },
      facture({ dejaCrediteTTC: 1000 }),
    );
    expect(problemes.map((p) => p.champ)).toEqual(['facture']);
    expect(problemes[0]?.message).toContain('entièrement créditée');
  });

  it('exige une phrase, pas un mot', () => {
    expect(problemesAvoir({ montantTTC: 100, motif: '   ' }, facture())[0]?.champ).toBe('motif');
    expect(problemesAvoir({ montantTTC: 100, motif: 'Erreur' }, facture())[0]?.champ).toBe('motif');
    expect('a'.repeat(MOTIF_LONGUEUR_MINIMALE).length).toBe(MOTIF_LONGUEUR_MINIMALE);
    expect(
      problemesAvoir({ montantTTC: 100, motif: 'a'.repeat(MOTIF_LONGUEUR_MINIMALE) }, facture()),
    ).toEqual([]);
  });

  it('ne compte pas les espaces de bordure dans la longueur du motif', () => {
    const court = `  ${'a'.repeat(MOTIF_LONGUEUR_MINIMALE - 1)}  `;
    expect(problemesAvoir({ montantTTC: 100, motif: court }, facture())[0]?.champ).toBe('motif');
  });

  it('rend tous les problèmes à la fois', () => {
    const problemes = problemesAvoir({ montantTTC: 0, motif: '' }, facture({ statut: 'prete' }));
    expect(problemes.map((p) => p.champ).toSorted()).toEqual(['facture', 'montantTTC', 'motif']);
  });
});

describe('prepareAvoir', () => {
  it('prépare un avoir partiel sans annuler la facture', () => {
    const resultat = prepareAvoir({ montantTTC: 120.5, motif: `  ${MOTIF}  ` }, facture());
    expect(resultat).toEqual({
      ok: true,
      avoir: { motif: MOTIF, montantTTC: 120.5, annuleLaFacture: false },
    });
  });

  it('annule la facture quand l’avoir couvre tout ce qui reste', () => {
    const resultat = prepareAvoir(
      { montantTTC: 400, motif: MOTIF },
      facture({ dejaCrediteTTC: 600 }),
    );
    expect(resultat.ok).toBe(true);
    expect(resultat.ok && resultat.avoir.annuleLaFacture).toBe(true);
  });

  it('n’attribue pas de numéro : il se prend dans la transaction qui écrit', () => {
    // Calculer le numéro ici ouvrirait la porte à deux avoirs portant le même.
    const resultat = prepareAvoir({ montantTTC: 10, motif: MOTIF }, facture());
    expect(resultat.ok && Object.keys(resultat.avoir).toSorted()).toEqual([
      'annuleLaFacture',
      'montantTTC',
      'motif',
    ]);
  });

  it('rend les problèmes plutôt qu’un avoir quand la saisie ne tient pas', () => {
    const resultat = prepareAvoir({ montantTTC: 99999, motif: 'non' }, facture());
    expect(resultat.ok).toBe(false);
    expect(!resultat.ok && resultat.problemes.map((p) => p.champ).toSorted()).toEqual([
      'montantTTC',
      'motif',
    ]);
  });
});
