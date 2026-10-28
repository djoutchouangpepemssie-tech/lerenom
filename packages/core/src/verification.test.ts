import { describe, expect, it } from 'vitest';
import {
  codeBienForme,
  decideVerification,
  expirationCode,
  TENTATIVES_MAX,
  type EtatVerification,
} from './verification.ts';

function etat(partiel: Partial<EtatVerification> = {}): EtatVerification {
  return {
    empreinte: 'une-empreinte',
    expireLe: new Date('2026-10-27T12:15:00Z'),
    tentatives: 0,
    dejaVerifie: false,
    ...partiel,
  };
}

const MAINTENANT = new Date('2026-10-27T12:05:00Z');

describe('decideVerification', () => {
  it('accepte quand le code correspond et que tout est en ordre', () => {
    expect(decideVerification(etat(), true, MAINTENANT)).toEqual({ issue: 'verifie' });
  });

  it('refuse un code faux et annonce les tentatives restantes', () => {
    expect(decideVerification(etat(), false, MAINTENANT)).toEqual({
      issue: 'code-faux',
      tentativesRestantes: TENTATIVES_MAX - 1,
    });
  });

  it('ne fait jamais passer les tentatives restantes sous zéro', () => {
    expect(decideVerification(etat({ tentatives: TENTATIVES_MAX - 1 }), false, MAINTENANT)).toEqual(
      {
        issue: 'code-faux',
        tentativesRestantes: 0,
      },
    );
  });

  it('bloque au-delà de la limite de tentatives, même avec le bon code', () => {
    expect(decideVerification(etat({ tentatives: TENTATIVES_MAX }), true, MAINTENANT)).toEqual({
      issue: 'trop-de-tentatives',
    });
  });

  it('refuse un code expiré, même juste', () => {
    expect(decideVerification(etat({ expireLe: new Date(MAINTENANT) }), true, MAINTENANT)).toEqual({
      issue: 'expire',
    });
  });

  it("refuse quand aucun code n'a été tiré", () => {
    expect(decideVerification(etat({ empreinte: null }), true, MAINTENANT)).toEqual({
      issue: 'expire',
    });
  });

  it('signale une demande déjà vérifiée plutôt que de la vérifier deux fois', () => {
    expect(decideVerification(etat({ dejaVerifie: true }), true, MAINTENANT)).toEqual({
      issue: 'deja-verifie',
    });
  });

  it("ne distingue pas un code faux d'un code expiré par l'ordre des contrôles", () => {
    // Expiré ET faux : c'est l'expiration qui est annoncée, jamais le nombre de tentatives.
    const expireEtFaux = etat({ expireLe: new Date('2026-10-27T11:00:00Z') });
    expect(decideVerification(expireEtFaux, false, MAINTENANT)).toEqual({ issue: 'expire' });
  });
});

describe('codeBienForme', () => {
  it.each(['123456', '000000', '999999'])('accepte %s', (valeur) => {
    expect(codeBienForme(valeur)).toBe(true);
  });

  it.each(['12345', '1234567', '12345a', '', ' 123456', '12 456', '１２３４５６'])(
    'refuse %s',
    (valeur) => {
      expect(codeBienForme(valeur)).toBe(false);
    },
  );
});

describe('expirationCode', () => {
  it('place l’expiration un quart d’heure plus tard', () => {
    expect(expirationCode(MAINTENANT).toISOString()).toBe('2026-10-27T12:20:00.000Z');
  });
});
