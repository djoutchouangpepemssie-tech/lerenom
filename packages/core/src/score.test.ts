import { describe, expect, it } from 'vitest';
import {
  calculeScore,
  composanteAvis,
  composanteFraicheur,
  composanteReactivite,
  noteCorrigee,
  poidsValides,
  scoreQualite,
} from './score';
import { PARAMETRES_PAR_DEFAUT } from './parametres';

const POIDS = PARAMETRES_PAR_DEFAUT.poidsScore;

describe('noteCorrigee (moyenne bayésienne)', () => {
  it('empêche un unique 5/5 de battre cinquante avis à 4,7', () => {
    const unSeulAvis = noteCorrigee(1, 5, 4.3, 10);
    const cinquanteAvis = noteCorrigee(50, 4.7, 4.3, 10);
    expect(cinquanteAvis).toBeGreaterThan(unSeulAvis);
  });

  it('tend vers la note réelle quand les avis s’accumulent', () => {
    expect(noteCorrigee(10000, 4.9, 4.3, 10)).toBeCloseTo(4.9, 2);
  });

  it('vaut la moyenne du métier sans aucun avis', () => {
    expect(noteCorrigee(0, 0, 4.3, 10)).toBe(4.3);
  });

  it('vaut exactement la moyenne des deux quand v = m', () => {
    expect(noteCorrigee(10, 5, 4, 10)).toBeCloseTo(4.5, 10);
  });

  it('retombe sur la moyenne du métier si les deux poids sont nuls', () => {
    expect(noteCorrigee(0, 5, 4.2, 0)).toBe(4.2);
  });
});

describe('composanteAvis', () => {
  it('ramène une note de 1 à 5 dans l’intervalle 0 à 1', () => {
    // Beaucoup d'avis : la correction bayésienne devient négligeable et la note brute ressort.
    expect(composanteAvis(1_000_000, 5, 4.3, 10)).toBeCloseTo(1, 4);
    expect(composanteAvis(1_000_000, 1, 4.3, 10)).toBeCloseTo(0, 4);
    expect(composanteAvis(1_000_000, 3, 4.3, 10)).toBeCloseTo(0.5, 4);
  });
});

describe('scoreQualite', () => {
  it('vaut 1 quand tout est parfait et 0 quand tout est nul', () => {
    const parfait = { avis: 1, activite: 1, pertinence: 1, reactivite: 1, fraicheur: 1 };
    const nul = { avis: 0, activite: 0, pertinence: 0, reactivite: 0, fraicheur: 0 };
    expect(scoreQualite(parfait, POIDS)).toBeCloseTo(1, 10);
    expect(scoreQualite(nul, POIDS)).toBe(0);
  });

  it('borne les composantes : une donnée aberrante ne fait pas sortir le score', () => {
    const aberrant = {
      avis: 42,
      activite: -7,
      pertinence: 1,
      reactivite: Number.NaN,
      fraicheur: 1,
    };
    const score = scoreQualite(aberrant, POIDS);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('donne le plus de poids aux avis', () => {
    const base = { avis: 0, activite: 0, pertinence: 0, reactivite: 0, fraicheur: 0 };
    const avecAvis = scoreQualite({ ...base, avis: 1 }, POIDS);
    const avecActivite = scoreQualite({ ...base, activite: 1 }, POIDS);
    const avecFraicheur = scoreQualite({ ...base, fraicheur: 1 }, POIDS);
    expect(avecAvis).toBeGreaterThan(avecActivite);
    expect(avecActivite).toBeGreaterThan(avecFraicheur);
    expect(avecAvis).toBeCloseTo(0.3, 10);
  });
});

describe('poidsValides', () => {
  it('accepte les poids par défaut', () => {
    expect(poidsValides(POIDS)).toBe(true);
  });

  it('refuse des poids qui ne somment pas à 1', () => {
    expect(poidsValides({ ...POIDS, avis: 0.5 })).toBe(false);
  });

  it('refuse un poids négatif ou invalide', () => {
    expect(poidsValides({ ...POIDS, avis: -0.1, activite: 0.65 })).toBe(false);
    expect(poidsValides({ ...POIDS, avis: Number.NaN })).toBe(false);
  });

  it('tolère un millième d’arrondi de saisie', () => {
    expect(poidsValides({ ...POIDS, fraicheur: 0.1005 })).toBe(true);
  });
});

describe('composanteReactivite', () => {
  it('récompense un pro qui répond toujours et vite', () => {
    expect(composanteReactivite(1, 10)).toBeCloseTo(1, 10);
  });

  it('pénalise un pro lent même s’il répond toujours', () => {
    expect(composanteReactivite(1, 600)).toBeLessThan(0.7);
  });

  it('pénalise un pro rapide qui répond rarement', () => {
    expect(composanteReactivite(0.2, 5)).toBeLessThan(0.6);
  });

  it('traite un délai nul comme une réponse immédiate', () => {
    expect(composanteReactivite(1, 0)).toBeCloseTo(1, 10);
  });
});

describe('composanteFraicheur', () => {
  it('vaut 1 pour une fiche du jour et 0 au-delà d’un an', () => {
    expect(composanteFraicheur(0)).toBe(1);
    expect(composanteFraicheur(365)).toBe(0);
    expect(composanteFraicheur(500)).toBe(0);
  });

  it('décroît avec le temps', () => {
    expect(composanteFraicheur(30)).toBeGreaterThan(composanteFraicheur(180));
  });

  it('vaut 0 si la référence est nulle', () => {
    expect(composanteFraicheur(10, 0)).toBe(0);
  });
});

describe('calculeScore', () => {
  it('classe le pro irréprochable devant le pro négligé', () => {
    const irreprochable = calculeScore(
      {
        nombreAvis: 212,
        noteMoyenne: 4.9,
        noteMoyenneMetier: 4.3,
        activite: 1,
        pertinence: 1,
        tauxReponse: 0.98,
        delaiMoyenMinutes: 12,
        joursDepuisMiseAJour: 2,
      },
      PARAMETRES_PAR_DEFAUT,
    );

    const neglige = calculeScore(
      {
        nombreAvis: 4,
        noteMoyenne: 3.8,
        noteMoyenneMetier: 4.3,
        activite: 0.1,
        pertinence: 0.3,
        tauxReponse: 0.3,
        delaiMoyenMinutes: 900,
        joursDepuisMiseAJour: 300,
      },
      PARAMETRES_PAR_DEFAUT,
    );

    expect(irreprochable).toBeGreaterThan(neglige);
    expect(irreprochable).toBeLessThanOrEqual(1);
    expect(neglige).toBeGreaterThanOrEqual(0);
  });
});
