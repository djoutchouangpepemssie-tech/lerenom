/**
 * Le relevé bancaire : ce que ces tests gardent.
 *
 * La clé IBAN attrape les fautes de frappe, et c'est son seul rôle : un IBAN bien formé peut
 * très bien désigner un compte fermé. Les tests portent donc sur ce que le contrôle peut
 * réellement promettre, et sur la normalisation — parce qu'un IBAN stocké avec des espaces ne
 * se compare plus au même IBAN stocké sans.
 */

import { describe, expect, it } from 'vitest';
import {
  bicValide,
  memeCompte,
  normaliseBic,
  normaliseIban,
  normaliseRib,
  paysIban,
  problemesRib,
  type SaisieRib,
} from './rib.ts';

const IBAN = 'FR7630001007941234567890185';

function saisie(modifications: Partial<SaisieRib> = {}): SaisieRib {
  return {
    titulaire: 'Plomberie Martin',
    iban: IBAN,
    bic: 'BNPAFRPP',
    banque: 'Banque fictive',
    ...modifications,
  };
}

describe('bicValide', () => {
  it('accepte un BIC de 8 et de 11 caractères', () => {
    expect(bicValide('BNPAFRPP')).toBe(true);
    expect(bicValide('BNPAFRPPXXX')).toBe(true);
  });

  it('accepte une saisie avec espaces et minuscules', () => {
    expect(bicValide('bnpa fr pp')).toBe(true);
  });

  it('refuse les longueurs intermédiaires et les chiffres mal placés', () => {
    expect(bicValide('BNPAFRP')).toBe(false); // 7
    expect(bicValide('BNPAFRPPX')).toBe(false); // 9
    expect(bicValide('BNPAFRPPXX')).toBe(false); // 10
    expect(bicValide('BNP1FRPP')).toBe(false); // chiffre dans le code banque
    expect(bicValide('BNPAF1PP')).toBe(false); // chiffre dans le code pays
  });

  it('refuse une saisie vide', () => {
    expect(bicValide('')).toBe(false);
  });
});

describe('normalisation', () => {
  it('retire les espaces et met en capitales', () => {
    expect(normaliseIban('fr76 3000 1007 9412 3456 7890 185')).toBe(IBAN);
    expect(normaliseBic('bnpa frpp')).toBe('BNPAFRPP');
  });

  it('retire aussi les tirets d’un IBAN recopié', () => {
    expect(normaliseIban('FR76-3000-1007-9412-3456-7890-185')).toBe(IBAN);
  });

  it('rend le pays d’un IBAN, et rien quand la saisie n’en a pas la forme', () => {
    expect(paysIban(' fr76 3000 ')).toBe('FR');
    expect(paysIban('7630001007')).toBeNull();
  });
});

describe('memeCompte', () => {
  it('ignore la mise en forme', () => {
    expect(memeCompte('fr76 3000 1007 9412 3456 7890 185', IBAN)).toBe(true);
  });

  it('distingue deux comptes différents', () => {
    expect(memeCompte(IBAN, 'FR7630004000031234567890143')).toBe(false);
  });
});

describe('problemesRib', () => {
  it('ne reproche rien à une saisie correcte', () => {
    expect(problemesRib(saisie())).toEqual([]);
  });

  it('accepte un nom de banque vide : c’est un confort d’affichage', () => {
    expect(problemesRib(saisie({ banque: '   ' }))).toEqual([]);
  });

  it('exige un titulaire', () => {
    expect(problemesRib(saisie({ titulaire: ' ' }))[0]?.champ).toBe('titulaire');
    expect(problemesRib(saisie({ titulaire: 'X' }))[0]?.champ).toBe('titulaire');
  });

  it('refuse un IBAN dont la clé ne tombe pas juste', () => {
    // Un seul chiffre changé : exactement la faute de frappe que la clé sert à attraper.
    const faute = `${IBAN.slice(0, -1)}6`;
    const problemes = problemesRib(saisie({ iban: faute }));
    expect(problemes[0]?.champ).toBe('iban');
    expect(problemes[0]?.message).toContain('caractère par caractère');
  });

  it('accepte un IBAN saisi avec des espaces', () => {
    expect(problemesRib(saisie({ iban: 'FR76 3000 1007 9412 3456 7890 185' }))).toEqual([]);
  });

  it('distingue un IBAN absent d’un IBAN faux', () => {
    expect(problemesRib(saisie({ iban: '' }))[0]?.message).toContain('Indiquez');
  });

  it('refuse un BIC mal formé', () => {
    expect(problemesRib(saisie({ bic: 'PASUNBIC' }))).toEqual([]); // 8 lettres : bien formé
    expect(problemesRib(saisie({ bic: 'TROPCOURT1' }))[0]?.champ).toBe('bic');
  });

  it('rend tous les problèmes à la fois', () => {
    const problemes = problemesRib({ titulaire: '', iban: 'nawak', bic: '', banque: '' });
    expect(problemes.map((p) => p.champ).toSorted()).toEqual(['bic', 'iban', 'titulaire']);
  });
});

describe('normaliseRib', () => {
  it('rend la saisie propre, prête à écrire', () => {
    const resultat = normaliseRib(
      saisie({
        titulaire: '  Plomberie Martin  ',
        iban: 'fr76 3000 1007 9412 3456 7890 185',
        bic: 'bnpafrpp',
      }),
    );
    expect(resultat).toEqual({
      ok: true,
      rib: {
        titulaire: 'Plomberie Martin',
        iban: IBAN,
        bic: 'BNPAFRPP',
        banque: 'Banque fictive',
      },
    });
  });

  it('écrit `null` plutôt qu’une chaîne vide pour la banque', () => {
    const resultat = normaliseRib(saisie({ banque: '  ' }));
    expect(resultat.ok && resultat.rib.banque).toBeNull();
  });

  it('rend les problèmes plutôt qu’un RIB quand la saisie ne tient pas', () => {
    const resultat = normaliseRib(saisie({ iban: 'FR00' }));
    expect(resultat.ok).toBe(false);
    expect(!resultat.ok && resultat.problemes.map((p) => p.champ)).toEqual(['iban']);
  });
});
