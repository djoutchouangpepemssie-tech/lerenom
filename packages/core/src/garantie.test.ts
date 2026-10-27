import { describe, expect, it } from 'vitest';
import { evalueGarantieExclusif } from './garantie.js';
import type { DossierGarantie } from './garantie.js';
import { PARAMETRES_PAR_DEFAUT } from './parametres.js';

const P = PARAMETRES_PAR_DEFAUT;

function dossier(partiel: Partial<DossierGarantie> = {}): DossierGarantie {
  return {
    mois: [
      { mois: '2026-11', demandesValides: 1 },
      { mois: '2026-12', demandesValides: 1 },
      { mois: '2027-01', demandesValides: 1 },
    ],
    ficheComplete: true,
    tauxReponse: 0.9,
    ...partiel,
  };
}

describe('evalueGarantieExclusif', () => {
  it('accorde le mois offert sous 5 demandes sur 3 mois, fiche complète et 80 % de réponse', () => {
    const resultat = evalueGarantieExclusif(dossier(), P);
    expect(resultat.eligible).toBe(true);
    expect(resultat.demandesSurLaPeriode).toBe(3);
    expect(resultat.seuil).toBe(5);
    expect(resultat.motifRefus).toBeUndefined();
  });

  it('refuse à partir de 5 demandes : le seuil est « moins de 5 »', () => {
    const quatre = evalueGarantieExclusif(
      dossier({
        mois: [
          { mois: '2026-11', demandesValides: 2 },
          { mois: '2026-12', demandesValides: 1 },
          { mois: '2027-01', demandesValides: 1 },
        ],
      }),
      P,
    );
    expect(quatre.eligible).toBe(true);

    const cinq = evalueGarantieExclusif(
      dossier({
        mois: [
          { mois: '2026-11', demandesValides: 2 },
          { mois: '2026-12', demandesValides: 2 },
          { mois: '2027-01', demandesValides: 1 },
        ],
      }),
      P,
    );
    expect(cinq.eligible).toBe(false);
    expect(cinq.motifRefus).toBe('assez-de-demandes');
  });

  it('refuse une période incomplète : la garantie se calcule sur 3 mois civils', () => {
    const resultat = evalueGarantieExclusif(
      dossier({ mois: [{ mois: '2026-11', demandesValides: 0 }] }),
      P,
    );
    expect(resultat.eligible).toBe(false);
    expect(resultat.motifRefus).toBe('periode-incomplete');
    expect(resultat.explication).toContain('3 mois');
  });

  it('refuse une fiche incomplète : la garantie suppose une fiche qui donne de quoi choisir', () => {
    const resultat = evalueGarantieExclusif(dossier({ ficheComplete: false }), P);
    expect(resultat.eligible).toBe(false);
    expect(resultat.motifRefus).toBe('fiche-incomplete');
  });

  it('refuse un abonné qui laisse expirer ses demandes, sous 80 % de réponse', () => {
    expect(evalueGarantieExclusif(dossier({ tauxReponse: 0.79 }), P).motifRefus).toBe(
      'taux-reponse-insuffisant',
    );
    expect(evalueGarantieExclusif(dossier({ tauxReponse: 0.8 }), P).eligible).toBe(true);
  });

  it('explique le refus en pourcentage, comme à l’écran', () => {
    const resultat = evalueGarantieExclusif(dossier({ tauxReponse: 0.42 }), P);
    expect(resultat.explication).toContain('42 %');
    expect(resultat.explication).toContain('80 %');
  });

  it('n’accorde la garantie qu’une fois par période de 3 mois', () => {
    const resultat = evalueGarantieExclusif(dossier({ dejaAccordee: true }), P);
    expect(resultat.eligible).toBe(false);
    expect(resultat.motifRefus).toBe('deja-accordee');
  });

  it('ignore un compte de demandes négatif', () => {
    const resultat = evalueGarantieExclusif(
      dossier({
        mois: [
          { mois: '2026-11', demandesValides: -4 },
          { mois: '2026-12', demandesValides: 1 },
          { mois: '2027-01', demandesValides: 1 },
        ],
      }),
      P,
    );
    expect(resultat.demandesSurLaPeriode).toBe(2);
  });

  it('accorde la garantie à un Exclusif qui n’a reçu aucune demande', () => {
    const resultat = evalueGarantieExclusif(
      dossier({
        mois: [
          { mois: '2026-11', demandesValides: 0 },
          { mois: '2026-12', demandesValides: 0 },
          { mois: '2027-01', demandesValides: 0 },
        ],
        // Sans demande reçue, le taux de réponse est par convention de 100 % : on ne peut pas
        // reprocher à un pro de ne pas avoir répondu à des demandes qu'il n'a pas reçues.
        tauxReponse: 1,
      }),
      P,
    );
    expect(resultat.eligible).toBe(true);
  });
});
