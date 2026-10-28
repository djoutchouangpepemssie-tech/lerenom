import { describe, expect, it } from 'vitest';
import {
  exigeConfiguration,
  LONGUEUR_SECRET_MINIMALE,
  messageConfiguration,
  verifieConfiguration,
} from './configuration.ts';

const COMPLET = {
  SECRET_VERIFICATION: 'a'.repeat(LONGUEUR_SECRET_MINIMALE),
  DATABASE_URL: 'postgresql://postgres:motdepasse@127.0.0.1:5432/lerenom',
};

describe('verifieConfiguration', () => {
  it('ne trouve rien à redire à une configuration complète', () => {
    expect(verifieConfiguration(COMPLET)).toEqual([]);
  });

  it('signale un secret absent', () => {
    const problemes = verifieConfiguration({ ...COMPLET, SECRET_VERIFICATION: undefined });
    expect(problemes).toHaveLength(1);
    expect(problemes[0]?.variable).toBe('SECRET_VERIFICATION');
    expect(problemes[0]?.probleme).toBe('absente');
  });

  it('signale un secret trop court, en disant de combien', () => {
    const problemes = verifieConfiguration({ ...COMPLET, SECRET_VERIFICATION: 'court' });
    expect(problemes[0]?.probleme).toContain('5 caractères');
    expect(problemes[0]?.probleme).toContain('32 au minimum');
  });

  it('signale une base absente', () => {
    const problemes = verifieConfiguration({ ...COMPLET, DATABASE_URL: '' });
    expect(problemes.map((p) => p.variable)).toEqual(['DATABASE_URL']);
  });

  it('rend tous les problèmes d’un coup, pas le premier', () => {
    expect(verifieConfiguration({})).toHaveLength(2);
  });
});

describe('messageConfiguration', () => {
  it('nomme la variable et dit quoi faire', () => {
    const message = messageConfiguration(verifieConfiguration({}));
    expect(message).toContain('SECRET_VERIFICATION');
    expect(message).toContain('openssl rand -hex 32');
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('.env.exemple');
  });
});

describe('exigeConfiguration', () => {
  it('laisse passer une configuration complète', () => {
    expect(() => exigeConfiguration(COMPLET)).not.toThrow();
  });

  it('arrête tout quand une variable manque', () => {
    expect(() => exigeConfiguration({})).toThrow(/Configuration incomplète/);
  });
});
