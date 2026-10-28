import { describe, expect, it } from 'vitest';
import {
  ATOUTS_ATTENDUS,
  LONGUEUR_PRESENTATION_UTILE,
  PHOTOS_ATTENDUES,
  completudeFiche,
  criteresFiche,
  manquesFiche,
  type EtatFiche,
} from './fiche.ts';

const MAINTENANT = new Date('2026-06-15T10:00:00Z');

const VIDE: EtatFiche = {
  description: null,
  slogan: null,
  logoUrl: null,
  couvertureUrl: null,
  telephone: null,
  email: null,
  siteWeb: null,
  horaires: null,
  atouts: [],
  nombrePhotos: 0,
  decennaleNumero: null,
  decennaleAssureur: null,
  decennaleExpireLe: null,
  nombrePrestations: 0,
};

const COMPLETE: EtatFiche = {
  description: 'a'.repeat(LONGUEUR_PRESENTATION_UTILE),
  slogan: 'Le dépannage sans mauvaise surprise',
  logoUrl: 'https://exemple.test/logo.png',
  couvertureUrl: 'https://exemple.test/couverture.jpg',
  telephone: '01 99 00 00 12',
  email: 'contact@exemple.test',
  siteWeb: 'https://exemple.test',
  horaires: { lundi: '08:00-18:00' },
  atouts: ['Devis gratuit', 'Intervention sous 2 h', 'Chantier laissé propre'],
  nombrePhotos: PHOTOS_ATTENDUES,
  decennaleNumero: 'DEC-2026-41',
  decennaleAssureur: 'Assureur fictif',
  decennaleExpireLe: new Date('2027-01-01T00:00:00Z'),
  nombrePrestations: 4,
};

function avec(modifications: Partial<EtatFiche>): EtatFiche {
  return { ...COMPLETE, ...modifications };
}

describe('criteresFiche', () => {
  it('pondère sur un total de 1', () => {
    // Le chiffre qui classe est une fraction : si les poids ne totalisent pas 1, une fiche
    // parfaite ne vaudrait pas 1 et la composante pertinence serait tronquée en silence.
    const total = criteresFiche(VIDE, MAINTENANT).reduce((s, c) => s + c.poids, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('donne à chaque critère une action écrite pour le professionnel', () => {
    for (const critere of criteresFiche(VIDE, MAINTENANT)) {
      expect(critere.action.length).toBeGreaterThan(10);
      expect(critere.libelle.length).toBeGreaterThan(2);
    }
  });

  it('n’a aucune clé en double', () => {
    const cles = criteresFiche(VIDE, MAINTENANT).map((c) => c.cle);
    expect(new Set(cles).size).toBe(cles.length);
  });
});

describe('completudeFiche', () => {
  it('vaut 0 sur une fiche vide', () => {
    expect(completudeFiche(VIDE, MAINTENANT)).toBe(0);
  });

  it('vaut 1 sur une fiche complète', () => {
    expect(completudeFiche(COMPLETE, MAINTENANT)).toBe(1);
  });

  it('reste entre 0 et 1', () => {
    const valeur = completudeFiche(avec({ logoUrl: null, slogan: null }), MAINTENANT);
    expect(valeur).toBeGreaterThan(0);
    expect(valeur).toBeLessThan(1);
  });

  it('pèse la présentation plus que le slogan', () => {
    // Le poids mesure l'utilité pour le visiteur, pas l'effort du professionnel.
    const sansPresentation = completudeFiche(avec({ description: null }), MAINTENANT);
    const sansSlogan = completudeFiche(avec({ slogan: null }), MAINTENANT);
    expect(sansPresentation).toBeLessThan(sansSlogan);
  });

  it('ne compte pas une présentation trop courte', () => {
    expect(completudeFiche(avec({ description: 'Plombier.' }), MAINTENANT)).toBeLessThan(1);
  });

  it('ne compte pas des espaces pour un slogan', () => {
    expect(completudeFiche(avec({ slogan: '   ' }), MAINTENANT)).toBeLessThan(1);
  });

  it('ne compte pas des atouts vides', () => {
    expect(completudeFiche(avec({ atouts: ['', '  ', 'Devis gratuit'] }), MAINTENANT)).toBeLessThan(
      1,
    );
  });

  it('exige au moins trois photos', () => {
    expect(completudeFiche(avec({ nombrePhotos: PHOTOS_ATTENDUES - 1 }), MAINTENANT)).toBeLessThan(
      1,
    );
    expect(completudeFiche(avec({ nombrePhotos: PHOTOS_ATTENDUES }), MAINTENANT)).toBe(1);
  });

  it('exige au moins trois atouts', () => {
    expect(completudeFiche(avec({ atouts: ['Un', 'Deux'] }), MAINTENANT)).toBeLessThan(1);
    expect(ATOUTS_ATTENDUS).toBe(3);
  });

  describe('assurance décennale', () => {
    it('ne compte pas une attestation expirée', () => {
      // Une décennale périmée n'est pas une décennale : l'afficher comme acquise reviendrait à
      // classer plus haut une entreprise qui n'est plus couverte.
      const expiree = avec({ decennaleExpireLe: new Date('2026-01-01T00:00:00Z') });
      expect(completudeFiche(expiree, MAINTENANT)).toBeLessThan(1);
    });

    it('ne compte pas une attestation sans assureur', () => {
      expect(completudeFiche(avec({ decennaleAssureur: null }), MAINTENANT)).toBeLessThan(1);
    });

    it('ne compte pas une attestation sans date d’échéance', () => {
      expect(completudeFiche(avec({ decennaleExpireLe: null }), MAINTENANT)).toBeLessThan(1);
    });
  });

  it('ne compte pas des métiers cochés comme des prestations déclarées', () => {
    expect(completudeFiche(avec({ nombrePrestations: 0 }), MAINTENANT)).toBeLessThan(1);
  });

  it('arrondit au centième', () => {
    const valeur = completudeFiche(avec({ siteWeb: null }), MAINTENANT);
    expect(valeur).toBe(Math.round(valeur * 100) / 100);
  });
});

describe('manquesFiche', () => {
  it('ne rend rien sur une fiche complète', () => {
    expect(manquesFiche(COMPLETE, MAINTENANT)).toEqual([]);
  });

  it('rend tout sur une fiche vide', () => {
    expect(manquesFiche(VIDE, MAINTENANT)).toHaveLength(criteresFiche(VIDE, MAINTENANT).length);
  });

  it('classe du plus utile au moins utile', () => {
    // Un professionnel qui n'a dix minutes doit les passer sur ce qui lui rapporte le plus.
    const manques = manquesFiche(VIDE, MAINTENANT);
    const poids = manques.map((m) => m.poids);
    expect(poids).toEqual([...poids].sort((a, b) => b - a));
    expect(manques[0]?.cle).toBe('presentation');
  });

  it('ne rend que ce qui manque', () => {
    const manques = manquesFiche(avec({ slogan: null, logoUrl: null }), MAINTENANT);
    expect(manques.map((m) => m.cle).sort()).toEqual(['logo', 'slogan']);
  });
});
