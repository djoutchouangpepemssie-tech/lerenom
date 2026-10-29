import { describe, expect, it } from 'vitest';
import { PARAMETRES_PAR_DEFAUT } from './parametres.ts';
import {
  inscriptionPossible,
  placesDeLaFormule,
  prochainServi,
  rangsApresDepart,
  type EtatZone,
} from './liste-attente.ts';

/** Une zone dont les six places Premium sont prises. */
function zoneComplete(enAttente: readonly string[] = []): EtatZone {
  return {
    exclusif: 'exclusif-1',
    premium: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
    enAttente,
  };
}

const P = PARAMETRES_PAR_DEFAUT;

describe('placesDeLaFormule', () => {
  it('ne compte que les formules qui achètent un rang', () => {
    expect(placesDeLaFormule('exclusif', P)).toBe(P.emplacementsExclusif);
    expect(placesDeLaFormule('premium', P)).toBe(P.premiumMaxParMetierVille);
    expect(placesDeLaFormule('essentiel', P)).toBe(0);
    expect(placesDeLaFormule('gratuit', P)).toBe(0);
  });
});

describe('inscriptionPossible', () => {
  it('accepte sur une zone Premium complète, au rang suivant', () => {
    const reponse = inscriptionPossible(
      zoneComplete(['a', 'b']),
      {
        entrepriseId: 'c',
        formule: 'premium',
      },
      P,
    );
    expect(reponse).toEqual({ accepte: true, rang: 3 });
  });

  it('refuse quand une place est libre : on ne fait pas attendre qui pouvait entrer', () => {
    const zone: EtatZone = { exclusif: null, premium: ['p1'], enAttente: [] };
    const reponse = inscriptionPossible(zone, { entrepriseId: 'c', formule: 'premium' }, P);
    expect(reponse.accepte).toBe(false);
    if (!reponse.accepte) expect(reponse.raison).toBe('place-libre');
  });

  it('refuse l’Exclusif tant que personne ne le détient', () => {
    const zone: EtatZone = { exclusif: null, premium: [], enAttente: [] };
    const reponse = inscriptionPossible(zone, { entrepriseId: 'c', formule: 'exclusif' }, P);
    expect(reponse.accepte).toBe(false);
    if (!reponse.accepte) expect(reponse.raison).toBe('place-libre');
  });

  it('accepte l’Exclusif quand il est pris', () => {
    const reponse = inscriptionPossible(
      zoneComplete(),
      { entrepriseId: 'c', formule: 'exclusif' },
      P,
    );
    expect(reponse).toEqual({ accepte: true, rang: 1 });
  });

  it('refuse à qui détient déjà la place', () => {
    const reponse = inscriptionPossible(
      zoneComplete(),
      { entrepriseId: 'p3', formule: 'premium' },
      P,
    );
    expect(reponse.accepte).toBe(false);
    if (!reponse.accepte) expect(reponse.raison).toBe('deja-detenteur');
  });

  it('refuse à l’Exclusif en place de s’inscrire sur sa propre exclusivité', () => {
    const reponse = inscriptionPossible(
      zoneComplete(),
      { entrepriseId: 'exclusif-1', formule: 'exclusif' },
      P,
    );
    expect(reponse.accepte).toBe(false);
    if (!reponse.accepte) expect(reponse.raison).toBe('deja-detenteur');
  });

  it('laisse un Premium en place s’inscrire pour l’Exclusif : c’est une autre place', () => {
    const reponse = inscriptionPossible(
      zoneComplete(),
      { entrepriseId: 'p3', formule: 'exclusif' },
      P,
    );
    expect(reponse).toEqual({ accepte: true, rang: 1 });
  });

  it('refuse la seconde inscription', () => {
    const reponse = inscriptionPossible(
      zoneComplete(['a', 'b']),
      {
        entrepriseId: 'b',
        formule: 'premium',
      },
      P,
    );
    expect(reponse.accepte).toBe(false);
    if (!reponse.accepte) expect(reponse.raison).toBe('deja-inscrit');
  });

  it('refuse une formule qui n’achète pas de rang', () => {
    const reponse = inscriptionPossible(
      zoneComplete(),
      { entrepriseId: 'c', formule: 'essentiel' },
      P,
    );
    expect(reponse.accepte).toBe(false);
    if (!reponse.accepte) expect(reponse.raison).toBe('formule-sans-emplacement');
  });

  it('refuse la place libre avant de regarder si l’on est déjà inscrit', () => {
    // L'ordre compte : à qui est déjà sur une liste devenue inutile, on dit que la place est
    // libre — c'est l'information qui lui sert — et non qu'il est déjà inscrit.
    const zone: EtatZone = { exclusif: null, premium: ['p1'], enAttente: ['c'] };
    const reponse = inscriptionPossible(zone, { entrepriseId: 'c', formule: 'premium' }, P);
    expect(reponse.accepte).toBe(false);
    if (!reponse.accepte) expect(reponse.raison).toBe('place-libre');
  });
});

describe('prochainServi', () => {
  it('prévient le premier arrivé, et lui seul', () => {
    expect(prochainServi(zoneComplete(['a', 'b', 'c']))).toBe('a');
  });

  it('rend null quand personne n’attend, ce qui est le cas normal', () => {
    expect(prochainServi(zoneComplete())).toBeNull();
  });
});

describe('rangsApresDepart', () => {
  it('resserre les rangs : une liste ne compte pas 1, 3, 4', () => {
    expect(rangsApresDepart(['a', 'b', 'c'], 'b')).toEqual([
      { entrepriseId: 'a', rang: 1 },
      { entrepriseId: 'c', rang: 2 },
    ]);
  });

  it('laisse la liste intacte quand le partant n’y était pas', () => {
    expect(rangsApresDepart(['a', 'b'], 'z')).toEqual([
      { entrepriseId: 'a', rang: 1 },
      { entrepriseId: 'b', rang: 2 },
    ]);
  });

  it('vide la liste quand le dernier part', () => {
    expect(rangsApresDepart(['a'], 'a')).toEqual([]);
  });
});
