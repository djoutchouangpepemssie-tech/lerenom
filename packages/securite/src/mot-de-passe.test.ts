import { describe, expect, it } from 'vitest';
import { empreinteADurcir, hacheMotDePasse, verifieMotDePasse } from './mot-de-passe';

const MOT = 'le chat dort sur le toit';

describe('hacheMotDePasse', () => {
  it('ne contient jamais le mot de passe en clair', async () => {
    const empreinte = await hacheMotDePasse(MOT);
    expect(empreinte).not.toContain(MOT);
    expect(empreinte).not.toContain('chat');
  });

  it('porte ses propres paramètres, pour pouvoir les durcir plus tard', async () => {
    const empreinte = await hacheMotDePasse(MOT);
    expect(empreinte.startsWith('scrypt$')).toBe(true);
    expect(empreinte.split('$')).toHaveLength(6);
  });

  it('donne deux empreintes différentes pour le même mot de passe : le sel est unique', async () => {
    const [a, b] = await Promise.all([hacheMotDePasse(MOT), hacheMotDePasse(MOT)]);
    expect(a).not.toBe(b);
  });
});

describe('verifieMotDePasse', () => {
  it('reconnaît le bon mot de passe', async () => {
    const empreinte = await hacheMotDePasse(MOT);
    expect(await verifieMotDePasse(MOT, empreinte)).toBe(true);
  });

  it('refuse un mot de passe faux, même proche', async () => {
    const empreinte = await hacheMotDePasse(MOT);
    expect(await verifieMotDePasse('le chat dort sur le toît', empreinte)).toBe(false);
    expect(await verifieMotDePasse(`${MOT} `, empreinte)).toBe(false);
  });

  it('traite les accents de la même façon à l’écriture et à la lecture', async () => {
    // Deux façons d'écrire « é » en Unicode doivent ouvrir le même compte.
    const compose = 'phrase de passe électrique';
    const decompose = 'phrase de passe électrique';
    const empreinte = await hacheMotDePasse(compose);
    expect(await verifieMotDePasse(decompose, empreinte)).toBe(true);
  });

  it.each([
    ['', 'une empreinte vide'],
    ['nimportequoi', 'une chaîne quelconque'],
    ['scrypt$x$8$1$c2Vs$ZW1wcmVpbnRl', 'des paramètres illisibles'],
    ['scrypt$65536$8$1$$', 'un sel et une empreinte vides'],
    ['argon2$65536$8$1$c2Vs$ZW1wcmVpbnRl', 'un autre algorithme'],
  ])('rend false sans lever sur %s (%s)', async (stocke) => {
    await expect(verifieMotDePasse(MOT, stocke)).resolves.toBe(false);
  });
});

describe('empreinteADurcir', () => {
  it('ne demande rien pour une empreinte fraîche', async () => {
    expect(empreinteADurcir(await hacheMotDePasse(MOT))).toBe(false);
  });

  it('repère une empreinte calculée avec un coût dépassé', () => {
    expect(empreinteADurcir('scrypt$16384$8$1$c2Vs$ZW1wcmVpbnRl')).toBe(true);
  });

  it('repère un format inconnu, qu’il faudra réécrire', () => {
    expect(empreinteADurcir('bcrypt$2b$12$quelquechose')).toBe(true);
  });
});
