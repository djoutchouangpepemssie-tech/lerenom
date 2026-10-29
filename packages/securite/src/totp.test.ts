/**
 * La double authentification du back-office.
 *
 * Le test qui compte est le premier : les **vecteurs officiels de la RFC 6238**. Une
 * implémentation de TOTP peut être parfaitement cohérente avec elle-même et refuser tous les
 * codes de Google Authenticator — elle passerait alors tous les tests qu'on écrirait contre
 * elle, et échouerait le jour où quelqu'un sort son téléphone. Les vecteurs sont la seule
 * preuve qu'on parle la même langue que le reste du monde.
 *
 * Ils sont donnés sur huit chiffres par la RFC ; nos codes en font six, ce qui revient au même
 * modulo — la troncature finale est la même opération.
 */

import { describe, expect, it } from 'vitest';
import {
  CHIFFRES_TOTP,
  PAS_TOTP_SECONDES,
  adresseOtpauth,
  codeDejaUtilise,
  codeTotp,
  depuisBase32,
  pasActuel,
  tireSecretTotp,
  verifieTotp,
  versBase32,
} from './totp.ts';

/** Le secret des vecteurs de la RFC : « 12345678901234567890 » en base32. */
const SECRET_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function instant(secondes: number): Date {
  return new Date(secondes * 1000);
}

describe('codeTotp — vecteurs de la RFC 6238', () => {
  it.each([
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
    [20_000_000_000, '353130'],
  ])('à T = %i secondes, le code est %s', (secondes, attendu) => {
    expect(codeTotp(SECRET_RFC, pasActuel(instant(secondes)))).toBe(attendu);
  });
});

describe('base32', () => {
  it('encode et décode sans rien perdre', () => {
    for (const texte of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar', '12345678901234567890']) {
      const octets = new TextEncoder().encode(texte);
      expect(depuisBase32(versBase32(octets))).toEqual(octets);
    }
  });

  it('tolère les espaces et la casse', () => {
    // Un secret se recopie à la main depuis un écran. Refuser « JBSW Y3DP » quand on accepte
    // « JBSWY3DP » n'ajoute aucune sécurité.
    expect(depuisBase32('jbsw y3dp')).toEqual(depuisBase32('JBSWY3DP'));
    expect(depuisBase32('JBSWY3DP====')).toEqual(depuisBase32('JBSWY3DP'));
  });

  it('refuse un caractère qui n’appartient pas à l’alphabet', () => {
    expect(() => depuisBase32('JBSW1DP')).toThrow(/invalide/);
  });
});

describe('tireSecretTotp', () => {
  it('produit un secret de vingt octets, lisible par une application', () => {
    const secret = tireSecretTotp();
    expect(depuisBase32(secret)).toHaveLength(20);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('n’en produit jamais deux fois le même', () => {
    const secrets = new Set(Array.from({ length: 50 }, tireSecretTotp));
    expect(secrets.size).toBe(50);
  });
});

describe('verifieTotp', () => {
  const MAINTENANT = instant(1_234_567_890);

  it('accepte le code du moment', () => {
    const resultat = verifieTotp(SECRET_RFC, '005924', MAINTENANT);
    expect(resultat.valide).toBe(true);
    expect(resultat.pas).toBe(pasActuel(MAINTENANT));
  });

  it('accepte le code écrit avec des espaces', () => {
    // Les applications affichent « 005 924 », et la moitié des gens recopient tel quel.
    expect(verifieTotp(SECRET_RFC, '005 924', MAINTENANT).valide).toBe(true);
  });

  it('tolère une dérive d’horloge d’un pas, pas de deux', () => {
    const pas = pasActuel(MAINTENANT);
    expect(verifieTotp(SECRET_RFC, codeTotp(SECRET_RFC, pas - 1), MAINTENANT).valide).toBe(true);
    expect(verifieTotp(SECRET_RFC, codeTotp(SECRET_RFC, pas + 1), MAINTENANT).valide).toBe(true);
    expect(verifieTotp(SECRET_RFC, codeTotp(SECRET_RFC, pas - 2), MAINTENANT).valide).toBe(false);
    expect(verifieTotp(SECRET_RFC, codeTotp(SECRET_RFC, pas + 2), MAINTENANT).valide).toBe(false);
  });

  it('rend le pas qui a validé, et non celui du moment', () => {
    // L'appelant en a besoin pour refuser que le code resserve.
    const pas = pasActuel(MAINTENANT) - 1;
    expect(verifieTotp(SECRET_RFC, codeTotp(SECRET_RFC, pas), MAINTENANT).pas).toBe(pas);
  });

  it.each(['', '12345', '1234567', 'abcdef', '00592a', '－５９２４'])(
    'refuse « %s » sans calculer quoi que ce soit',
    (propose) => {
      expect(verifieTotp(SECRET_RFC, propose, MAINTENANT)).toEqual({ valide: false, pas: null });
    },
  );

  it('refuse un code juste tiré d’un autre secret', () => {
    const autre = tireSecretTotp();
    const code = codeTotp(autre, pasActuel(MAINTENANT));
    expect(verifieTotp(SECRET_RFC, code, MAINTENANT).valide).toBe(false);
  });

  it('change de code d’un pas à l’autre', () => {
    const pas = pasActuel(MAINTENANT);
    expect(codeTotp(SECRET_RFC, pas)).not.toBe(codeTotp(SECRET_RFC, pas + 1));
  });
});

describe('codeDejaUtilise', () => {
  it('laisse passer le premier code', () => {
    expect(codeDejaUtilise(100, null)).toBe(false);
  });

  it('refuse le même pas une seconde fois', () => {
    // Sans cela, un code lu par-dessus l'épaule reste utilisable une minute et demie.
    expect(codeDejaUtilise(100, 100)).toBe(true);
  });

  it('refuse aussi un pas antérieur, pas seulement le dernier', () => {
    // Rejouer un ancien code doit être impossible, pas seulement rejouer le plus récent.
    expect(codeDejaUtilise(95, 100)).toBe(true);
  });

  it('laisse passer le pas suivant', () => {
    expect(codeDejaUtilise(101, 100)).toBe(false);
  });
});

describe('adresseOtpauth', () => {
  it('porte l’émetteur, le compte et les paramètres', () => {
    const adresse = adresseOtpauth('ABCDEF', 'arcel@lerenom.fr');
    expect(adresse).toContain('otpauth://totp/Le%20Renom%3Aarcel%40lerenom.fr');
    expect(adresse).toContain('secret=ABCDEF');
    expect(adresse).toContain('issuer=Le+Renom');
    expect(adresse).toContain(`digits=${String(CHIFFRES_TOTP)}`);
    expect(adresse).toContain(`period=${String(PAS_TOTP_SECONDES)}`);
  });
});
