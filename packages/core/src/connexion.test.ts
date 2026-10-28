import { describe, expect, it } from 'vitest';
import {
  expirationSession,
  JOURS_INACTIVITE_SESSION,
  JOURS_SESSION,
  MINUTES_VERROUILLAGE,
  TENTATIVES_CONNEXION_MAX,
  validiteSession,
  verrouDeConnexion,
  type EtatSession,
} from './connexion.ts';

const MAINTENANT = new Date('2026-10-28T12:00:00Z');

describe('verrouDeConnexion', () => {
  it('laisse passer tant que la limite n’est pas atteinte', () => {
    expect(
      verrouDeConnexion(
        { tentatives: TENTATIVES_CONNEXION_MAX - 1, derniereTentativeLe: MAINTENANT },
        MAINTENANT,
      ),
    ).toEqual({ issue: 'ouvert' });
  });

  it('verrouille à la limite, et dit combien de temps', () => {
    const resultat = verrouDeConnexion(
      {
        tentatives: TENTATIVES_CONNEXION_MAX,
        derniereTentativeLe: new Date('2026-10-28T11:55:00Z'),
      },
      MAINTENANT,
    );
    expect(resultat.issue).toBe('verrouille');
    if (resultat.issue !== 'verrouille') return;
    expect(resultat.minutesRestantes).toBe(MINUTES_VERROUILLAGE - 5);
  });

  it('rouvre tout seul après le délai : un compte ne se bloque jamais pour de bon', () => {
    const vieux = new Date(MAINTENANT.getTime() - (MINUTES_VERROUILLAGE + 1) * 60_000);
    expect(verrouDeConnexion({ tentatives: 50, derniereTentativeLe: vieux }, MAINTENANT)).toEqual({
      issue: 'ouvert',
    });
  });

  it('ne verrouille pas un compte qui n’a jamais essayé', () => {
    expect(verrouDeConnexion({ tentatives: 9, derniereTentativeLe: null }, MAINTENANT)).toEqual({
      issue: 'ouvert',
    });
  });
});

describe('validiteSession', () => {
  function session(partiel: Partial<EtatSession> = {}): EtatSession {
    return {
      expireLe: new Date('2026-11-20T12:00:00Z'),
      revoqueeLe: null,
      derniereActiviteLe: new Date('2026-10-27T12:00:00Z'),
      ...partiel,
    };
  }

  it('accepte une session fraîche', () => {
    expect(validiteSession(session(), MAINTENANT)).toEqual({ issue: 'valide' });
  });

  it('refuse une session révoquée, avant tout autre motif', () => {
    const revoquee = session({
      revoqueeLe: new Date('2026-10-20T12:00:00Z'),
      expireLe: new Date('2026-10-01T12:00:00Z'),
    });
    expect(validiteSession(revoquee, MAINTENANT)).toEqual({ issue: 'revoquee' });
  });

  it('refuse une session expirée', () => {
    expect(validiteSession(session({ expireLe: MAINTENANT }), MAINTENANT)).toEqual({
      issue: 'expiree',
    });
  });

  it('refuse une session inactive, même si elle n’a pas expiré', () => {
    const inactive = session({
      derniereActiviteLe: new Date(
        MAINTENANT.getTime() - (JOURS_INACTIVITE_SESSION + 1) * 24 * 3_600_000,
      ),
    });
    expect(validiteSession(inactive, MAINTENANT)).toEqual({ issue: 'inactive' });
  });
});

describe('expirationSession', () => {
  it('place l’expiration à la durée prévue', () => {
    const attendu = new Date(MAINTENANT.getTime() + JOURS_SESSION * 24 * 3_600_000);
    expect(expirationSession(MAINTENANT).toISOString()).toBe(attendu.toISOString());
  });
});
