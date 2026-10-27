import { describe, expect, it } from 'vitest';
import {
  formateIban,
  ibanValide,
  masqueIban,
  mobileFrancaisValide,
  normaliseMobileFrancais,
  sirenValide,
  siretValide,
} from './validateurs.js';

describe('siretValide', () => {
  it('accepte un SIRET dont la clé de Luhn est juste', () => {
    // SIRET construit pour satisfaire Luhn : 73282932000074 (exemple de documentation publique).
    expect(siretValide('73282932000074')).toBe(true);
  });

  it('refuse un SIRET dont la clé est fausse', () => {
    expect(siretValide('73282932000075')).toBe(false);
  });

  it('refuse ce qui n’est pas 14 chiffres', () => {
    expect(siretValide('123')).toBe(false);
    expect(siretValide('7328293200007A')).toBe(false);
    expect(siretValide('732829320000740')).toBe(false);
    expect(siretValide('')).toBe(false);
  });

  it('tolère les espaces de saisie', () => {
    expect(siretValide('732 829 320 00074')).toBe(true);
  });

  it('applique l’exception de La Poste, dont la somme doit être multiple de 5', () => {
    // La Poste (SIREN 356000000) ne respecte pas la clé de Luhn : règle documentée par l'Insee.
    // 3+5+6+0+0+0+0+0+0+0+0+0+0+1 = 15, multiple de 5 : accepté.
    expect(siretValide('35600000000001')).toBe(true);
    // 16, qui n'est pas multiple de 5 : refusé.
    expect(siretValide('35600000000002')).toBe(false);
  });
});

describe('sirenValide', () => {
  it('accepte un SIREN valide et refuse un SIREN faux', () => {
    expect(sirenValide('732829320')).toBe(true);
    expect(sirenValide('732829321')).toBe(false);
  });

  it('accepte le SIREN de La Poste', () => {
    expect(sirenValide('356000000')).toBe(true);
  });

  it('refuse ce qui n’est pas 9 chiffres', () => {
    expect(sirenValide('73282932')).toBe(false);
    expect(sirenValide('7328293200')).toBe(false);
  });
});

describe('ibanValide', () => {
  it('accepte un IBAN français valide', () => {
    expect(ibanValide('FR7630006000011234567890189')).toBe(true);
  });

  it('accepte les formats avec espaces ou tirets, en minuscules', () => {
    expect(ibanValide('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
    expect(ibanValide('fr7630006000011234567890189')).toBe(true);
    expect(ibanValide('FR76-3000-6000-0112-3456-7890-189')).toBe(true);
  });

  it('refuse un IBAN dont la clé de contrôle est fausse', () => {
    expect(ibanValide('FR7630006000011234567890188')).toBe(false);
  });

  it('refuse un IBAN français de mauvaise longueur', () => {
    expect(ibanValide('FR763000600001123456789018')).toBe(false);
    expect(ibanValide('FR76300060000112345678901890')).toBe(false);
  });

  it('refuse une saisie qui n’a pas la forme d’un IBAN', () => {
    expect(ibanValide('')).toBe(false);
    expect(ibanValide('1234567890')).toBe(false);
    expect(ibanValide('FRXX30006000011234567890189')).toBe(false);
  });

  it('accepte un IBAN d’un autre pays européen', () => {
    expect(ibanValide('DE89370400440532013000')).toBe(true);
    expect(ibanValide('BE68539007547034')).toBe(true);
    expect(ibanValide('GB82WEST12345698765432')).toBe(true);
  });

  it('refuse un IBAN trop court ou trop long pour la norme', () => {
    expect(ibanValide('FR761234567890')).toBe(false);
  });
});

describe('formateIban et masqueIban', () => {
  it('formate par groupes de 4, comme sur un relevé', () => {
    expect(formateIban('FR7630006000011234567890189')).toBe('FR76 3000 6000 0112 3456 7890 189');
  });

  it('masque le milieu et garde le pays, la clé et les 4 derniers caractères', () => {
    const masque = masqueIban('FR7630006000011234567890189');
    expect(masque.startsWith('FR76')).toBe(true);
    expect(masque.replace(/\s/g, '').endsWith('0189')).toBe(true);
    expect(masque).toContain('•');
    // Aucun chiffre du milieu ne doit rester lisible.
    expect(masque.replace(/\s/g, '').slice(4, -4)).toMatch(/^•+$/);
  });

  it('ne révèle rien d’une saisie trop courte', () => {
    expect(masqueIban('FR76')).toBe('••••');
  });
});

describe('mobileFrancaisValide', () => {
  it('accepte les mobiles au format national et international', () => {
    expect(mobileFrancaisValide('0612345678')).toBe(true);
    expect(mobileFrancaisValide('0712345678')).toBe(true);
    expect(mobileFrancaisValide('+33612345678')).toBe(true);
    expect(mobileFrancaisValide('0033612345678')).toBe(true);
    expect(mobileFrancaisValide('06 12 34 56 78')).toBe(true);
    expect(mobileFrancaisValide('06.12.34.56.78')).toBe(true);
  });

  it('refuse un fixe, un numéro trop court ou un numéro étranger', () => {
    expect(mobileFrancaisValide('0145678901')).toBe(false);
    expect(mobileFrancaisValide('061234567')).toBe(false);
    expect(mobileFrancaisValide('+32612345678')).toBe(false);
    expect(mobileFrancaisValide('')).toBe(false);
  });
});

describe('normaliseMobileFrancais', () => {
  it('ramène tous les formats acceptés au format E.164', () => {
    expect(normaliseMobileFrancais('0612345678')).toBe('+33612345678');
    expect(normaliseMobileFrancais('06 12 34 56 78')).toBe('+33612345678');
    expect(normaliseMobileFrancais('+33612345678')).toBe('+33612345678');
    expect(normaliseMobileFrancais('0033612345678')).toBe('+33612345678');
  });

  it('rend null sur un numéro invalide, plutôt qu’un numéro approximatif', () => {
    expect(normaliseMobileFrancais('0145678901')).toBeNull();
    expect(normaliseMobileFrancais('nimporte quoi')).toBeNull();
  });
});
