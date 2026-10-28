import { describe, expect, it } from 'vitest';
import { aLaVille, nomVille, telephoneLisible } from './affichage';

describe('nomVille', () => {
  it('retire la mention « Arrondissement » de l’Insee', () => {
    expect(nomVille('Paris 11e Arrondissement')).toBe('Paris 11e');
    expect(nomVille('Lyon 3e Arrondissement')).toBe('Lyon 3e');
  });

  it('laisse les autres noms intacts', () => {
    expect(nomVille('Montreuil')).toBe('Montreuil');
    expect(nomVille('L’Haÿ-les-Roses')).toBe('L’Haÿ-les-Roses');
  });
});

describe('aLaVille', () => {
  it.each([
    ['Montreuil', 'à Montreuil'],
    ['Le Plessis-Robinson', 'au Plessis-Robinson'],
    ['Les Lilas', 'aux Lilas'],
    ['La Courneuve', 'à La Courneuve'],
    ['Paris 11e Arrondissement', 'à Paris 11e'],
  ])('écrit %s « %s »', (nom, attendu) => {
    expect(aLaVille(nom)).toBe(attendu);
  });
});

describe('telephoneLisible', () => {
  it('découpe un numéro français par paires', () => {
    expect(telephoneLisible('+33199000010')).toBe('01 99 00 00 10');
    expect(telephoneLisible('0612345678')).toBe('06 12 34 56 78');
  });

  it('accepte un numéro déjà espacé ou ponctué', () => {
    expect(telephoneLisible('06 12 34 56 78')).toBe('06 12 34 56 78');
    expect(telephoneLisible('06.12.34.56.78')).toBe('06 12 34 56 78');
  });

  it('rend tel quel ce qui n’est pas un numéro français, plutôt que de mal le découper', () => {
    expect(telephoneLisible('+3225550123')).toBe('+3225550123');
    expect(telephoneLisible('non renseigné')).toBe('non renseigné');
  });
});
