import { describe, expect, it } from 'vitest';
import {
  agencesAutorisees,
  ajusteZonesPourFormule,
  nombreDePages,
  prioriteConservation,
  selectionValide,
  villesAutorisees,
} from './zones.ts';
import type { VilleChoisie } from './zones.ts';
import { PARAMETRES_PAR_DEFAUT } from './parametres.ts';

const P = PARAMETRES_PAR_DEFAUT;

const PARIS_11: VilleChoisie = { code: '75111', statut: 'ouvert', population: 147017, siege: true };
const MONTREUIL: VilleChoisie = { code: '93048', statut: 'ouvert', population: 111240 };
const VINCENNES: VilleChoisie = { code: '94080', statut: 'ouvert', population: 49891 };
const BAGNOLET: VilleChoisie = { code: '93006', statut: 'bientot', population: 35779 };
const SAINT_MANDE: VilleChoisie = { code: '94067', statut: 'bientot', population: 22400 };
const CRETEIL: VilleChoisie = { code: '94028', statut: 'annuaire', population: 92897 };
const MEAUX: VilleChoisie = { code: '77284', statut: 'annuaire', population: 55750 };

describe('limites par formule', () => {
  it('autorise 2, 5, 15 villes puis sans limite', () => {
    expect(villesAutorisees('gratuit', P)).toBe(2);
    expect(villesAutorisees('essentiel', P)).toBe(5);
    expect(villesAutorisees('premium', P)).toBe(15);
    expect(villesAutorisees('exclusif', P)).toBeNull();
  });

  it('autorise 1, 1, 3 agences puis sans limite', () => {
    expect(agencesAutorisees('gratuit', P)).toBe(1);
    expect(agencesAutorisees('essentiel', P)).toBe(1);
    expect(agencesAutorisees('premium', P)).toBe(3);
    expect(agencesAutorisees('exclusif', P)).toBeNull();
  });
});

describe('nombreDePages', () => {
  it('multiplie les villes par les métiers : une page = un métier dans une ville', () => {
    expect(nombreDePages(15, 3)).toBe(45);
    expect(nombreDePages(2, 1)).toBe(2);
  });

  it('vaut zéro dès qu’un facteur est nul ou négatif', () => {
    expect(nombreDePages(0, 5)).toBe(0);
    expect(nombreDePages(5, 0)).toBe(0);
    expect(nombreDePages(-3, 5)).toBe(0);
  });
});

describe('selectionValide', () => {
  it('refuse 3 villes en Gratuit et les accepte en Essentiel', () => {
    const trois = [PARIS_11, MONTREUIL, VINCENNES];
    expect(selectionValide(trois, 'gratuit', P)).toBe(false);
    expect(selectionValide(trois, 'essentiel', P)).toBe(true);
  });

  it('accepte n’importe quelle sélection en Exclusif', () => {
    const beaucoup = Array.from({ length: 300 }, (_, i) => ({
      code: String(i),
      statut: 'annuaire' as const,
      population: 1000,
    }));
    expect(selectionValide(beaucoup, 'exclusif', P)).toBe(true);
    expect(selectionValide(beaucoup, 'premium', P)).toBe(false);
  });
});

describe('prioriteConservation', () => {
  it('garde le siège avant tout, puis ouvert, bientôt, annuaire', () => {
    expect(prioriteConservation(PARIS_11)).toBe(0);
    expect(prioriteConservation(MONTREUIL)).toBe(1);
    expect(prioriteConservation(BAGNOLET)).toBe(2);
    expect(prioriteConservation(CRETEIL)).toBe(3);
  });

  it('place le siège en tête même si son statut est l’annuaire', () => {
    expect(prioriteConservation({ ...CRETEIL, siege: true })).toBe(0);
  });
});

describe('ajusteZonesPourFormule', () => {
  const SELECTION = [CRETEIL, BAGNOLET, PARIS_11, MEAUX, MONTREUIL, SAINT_MANDE, VINCENNES];

  it('ne retire rien quand la sélection tient dans la formule', () => {
    const resultat = ajusteZonesPourFormule([PARIS_11, MONTREUIL], 'gratuit', P);
    expect(resultat.retirees).toEqual([]);
    expect(resultat.conservees).toHaveLength(2);
  });

  it('ne retire jamais rien en Exclusif', () => {
    const resultat = ajusteZonesPourFormule(SELECTION, 'exclusif', P);
    expect(resultat.retirees).toEqual([]);
    expect(resultat.conservees).toHaveLength(SELECTION.length);
  });

  it('retire l’annuaire d’abord, le siège jamais : passage à l’Essentiel', () => {
    const resultat = ajusteZonesPourFormule(SELECTION, 'essentiel', P);
    const gardes = resultat.conservees.map((v) => v.code);
    const retires = resultat.retirees.map((v) => v.code);

    expect(resultat.conservees).toHaveLength(5);
    expect(gardes).toContain(PARIS_11.code); // le siège
    expect(gardes).toContain(MONTREUIL.code);
    expect(gardes).toContain(VINCENNES.code);
    // Les deux villes d'annuaire sont les premières retirées.
    expect(retires).toEqual([MEAUX.code, CRETEIL.code]);
  });

  it('ne garde que le siège et la ville ouverte la plus peuplée en Gratuit', () => {
    const resultat = ajusteZonesPourFormule(SELECTION, 'gratuit', P);
    expect(resultat.conservees.map((v) => v.code)).toEqual([PARIS_11.code, MONTREUIL.code]);
    expect(resultat.retirees).toHaveLength(5);
  });

  it('garde la ville la plus peuplée à statut égal', () => {
    const resultat = ajusteZonesPourFormule([CRETEIL, MEAUX], 'gratuit', P);
    expect(resultat.conservees.map((v) => v.code)).toEqual([CRETEIL.code, MEAUX.code]);

    const serre = ajusteZonesPourFormule([MEAUX, CRETEIL], 'gratuit', {
      ...P,
      villesMax: { ...P.villesMax, gratuit: 1 },
    });
    expect(serre.conservees.map((v) => v.code)).toEqual([CRETEIL.code]);
  });

  it('tranche les égalités de population par le code INSEE, pour un résultat reproductible', () => {
    const a: VilleChoisie = { code: '93001', statut: 'annuaire', population: 5000 };
    const b: VilleChoisie = { code: '93002', statut: 'annuaire', population: 5000 };
    const premier = ajusteZonesPourFormule([b, a], 'gratuit', {
      ...P,
      villesMax: { ...P.villesMax, gratuit: 1 },
    });
    expect(premier.conservees.map((v) => v.code)).toEqual(['93001']);
  });

  it('est idempotent : réajuster une sélection déjà ajustée ne retire plus rien', () => {
    const premier = ajusteZonesPourFormule(SELECTION, 'essentiel', P);
    const second = ajusteZonesPourFormule(premier.conservees, 'essentiel', P);
    expect(second.retirees).toEqual([]);
    expect(second.conservees.map((v) => v.code)).toEqual(premier.conservees.map((v) => v.code));
  });

  it('retire toutes les villes si la formule n’en autorise aucune', () => {
    const resultat = ajusteZonesPourFormule(SELECTION, 'gratuit', {
      ...P,
      villesMax: { ...P.villesMax, gratuit: 0 },
    });
    expect(resultat.conservees).toEqual([]);
    expect(resultat.retirees).toHaveLength(SELECTION.length);
  });
});
