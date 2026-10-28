import { describe, expect, it } from 'vitest';
import { codeBienForme, jetonBienForme, LONGUEUR_CODE, TENTATIVES_MAX } from '@lerenom/core';
import {
  empreinteCode,
  empreinteJeton,
  empreintesEgales,
  tireCode,
  tireJeton,
  verifieCode,
} from './index.ts';

const SECRET = 'secret-de-test-assez-long-pour-etre-credible';
const DEMANDE = 'dem_01HZ';
const MAINTENANT = new Date('2026-10-27T12:05:00Z');

function etat(code = '123456') {
  return {
    demandeId: DEMANDE,
    empreinte: empreinteCode(code, DEMANDE, SECRET),
    expireLe: new Date('2026-10-27T12:15:00Z'),
    tentatives: 0,
    dejaVerifie: false,
  };
}

describe('tireCode', () => {
  it('tire toujours six chiffres, zéros de tête compris', () => {
    for (let i = 0; i < 2_000; i += 1) {
      const code = tireCode();
      expect(code).toHaveLength(LONGUEUR_CODE);
      expect(codeBienForme(code)).toBe(true);
    }
  });

  it('couvre tout l’intervalle, bornes comprises', () => {
    const tirages = new Set(Array.from({ length: 5_000 }, () => tireCode()));
    expect(tirages.size).toBeGreaterThan(4_000);
    for (const code of tirages) {
      const valeur = Number(code);
      expect(valeur).toBeGreaterThanOrEqual(0);
      expect(valeur).toBeLessThan(10 ** LONGUEUR_CODE);
    }
  });
});

describe('empreinteCode', () => {
  it('ne contient jamais le code en clair', () => {
    expect(empreinteCode('123456', DEMANDE, SECRET)).not.toContain('123456');
  });

  it('est stable : la même entrée donne la même empreinte', () => {
    expect(empreinteCode('123456', DEMANDE, SECRET)).toBe(empreinteCode('123456', DEMANDE, SECRET));
  });

  it('change avec la demande : une empreinte volée ne sert pas ailleurs', () => {
    expect(empreinteCode('123456', DEMANDE, SECRET)).not.toBe(
      empreinteCode('123456', 'dem_autre', SECRET),
    );
  });

  it('change avec le secret du serveur', () => {
    expect(empreinteCode('123456', DEMANDE, SECRET)).not.toBe(
      empreinteCode('123456', DEMANDE, 'un-autre-secret'),
    );
  });
});

describe('empreintesEgales', () => {
  it('reconnaît deux empreintes identiques', () => {
    const e = empreinteCode('123456', DEMANDE, SECRET);
    expect(empreintesEgales(e, e)).toBe(true);
  });

  it('refuse deux empreintes différentes', () => {
    expect(
      empreintesEgales(
        empreinteCode('123456', DEMANDE, SECRET),
        empreinteCode('654321', DEMANDE, SECRET),
      ),
    ).toBe(false);
  });

  it('refuse sans lever quand les longueurs diffèrent', () => {
    expect(empreintesEgales('abcd', empreinteCode('123456', DEMANDE, SECRET))).toBe(false);
  });

  it('refuse deux empreintes vides plutôt que de les déclarer égales', () => {
    expect(empreintesEgales('', '')).toBe(false);
  });

  it('refuse une empreinte qui n’est pas de l’hexadécimal', () => {
    expect(empreintesEgales('zzzz', 'zzzz')).toBe(false);
  });
});

describe('verifieCode', () => {
  it('accepte le bon code', () => {
    expect(verifieCode(etat(), '123456', SECRET, MAINTENANT)).toEqual({ issue: 'verifie' });
  });

  it('refuse un code faux', () => {
    expect(verifieCode(etat(), '000000', SECRET, MAINTENANT)).toEqual({
      issue: 'code-faux',
      tentativesRestantes: TENTATIVES_MAX - 1,
    });
  });

  it('refuse le bon code présenté avec un autre secret', () => {
    expect(
      verifieCode(etat(), '123456', 'secret-different-mais-tout-aussi-long-que-lautre', MAINTENANT),
    ).toEqual({
      issue: 'code-faux',
      tentativesRestantes: TENTATIVES_MAX - 1,
    });
  });

  it('refuse le bon code présenté sur une autre demande', () => {
    expect(
      verifieCode({ ...etat(), demandeId: 'dem_autre' }, '123456', SECRET, MAINTENANT),
    ).toEqual({ issue: 'code-faux', tentativesRestantes: TENTATIVES_MAX - 1 });
  });

  it('accepte un code à zéros de tête sans le confondre avec sa valeur numérique', () => {
    expect(verifieCode(etat('000123'), '000123', SECRET, MAINTENANT)).toEqual({ issue: 'verifie' });
    expect(verifieCode(etat('000123'), '123', SECRET, MAINTENANT)).toEqual({
      issue: 'code-faux',
      tentativesRestantes: TENTATIVES_MAX - 1,
    });
  });

  it("refuse quand aucun code n'a été tiré, sans appeler la comparaison", () => {
    expect(verifieCode({ ...etat(), empreinte: null }, '123456', SECRET, MAINTENANT)).toEqual({
      issue: 'expire',
    });
  });
});

describe('tireJeton', () => {
  it('tire un jeton bien formé, à chaque fois', () => {
    for (let i = 0; i < 1_000; i += 1) {
      expect(jetonBienForme(tireJeton())).toBe(true);
    }
  });

  it('ne tire jamais deux fois le même', () => {
    const tirages = new Set(Array.from({ length: 5_000 }, () => tireJeton()));
    expect(tirages.size).toBe(5_000);
  });
});

describe('empreinteJeton', () => {
  it('ne contient pas le jeton en clair', () => {
    const jeton = tireJeton();
    expect(empreinteJeton(jeton, SECRET)).not.toContain(jeton);
  });

  it('est stable : c’est par elle qu’on retrouve la ligne', () => {
    const jeton = tireJeton();
    expect(empreinteJeton(jeton, SECRET)).toBe(empreinteJeton(jeton, SECRET));
  });

  it('change avec le secret du serveur', () => {
    const jeton = tireJeton();
    expect(empreinteJeton(jeton, SECRET)).not.toBe(empreinteJeton(jeton, 'un-autre-secret'));
  });

  it('ne se confond pas avec l’empreinte d’un code de vérification', () => {
    expect(empreinteJeton('123456', SECRET)).not.toBe(empreinteCode('123456', DEMANDE, SECRET));
  });
});
