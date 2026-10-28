import { describe, expect, it } from 'vitest';
import {
  DUREE_LIEN_JOURS,
  decideLien,
  expirationLien,
  jetonBienForme,
  lienRejouable,
  type ActionLien,
  type LienStocke,
} from './liens';

const MAINTENANT = new Date('2026-10-28T10:00:00Z');
const TOUTES: readonly ActionLien[] = Object.keys(DUREE_LIEN_JOURS) as ActionLien[];

function lien(partiel: Partial<LienStocke> = {}): LienStocke {
  return {
    action: 'annuler_demande',
    expireLe: new Date('2026-11-04T10:00:00Z'),
    utiliseLe: null,
    ...partiel,
  };
}

describe('DUREE_LIEN_JOURS', () => {
  it('couvre toutes les actions, sans durée nulle ni négative', () => {
    expect(TOUTES).toHaveLength(10);
    for (const action of TOUTES) {
      expect(DUREE_LIEN_JOURS[action]).toBeGreaterThan(0);
    }
  });

  it('laisse l’accès aux coordonnées plus longtemps que la fenêtre d’annulation', () => {
    expect(DUREE_LIEN_JOURS.voir_pros).toBeGreaterThan(DUREE_LIEN_JOURS.annuler_demande);
  });

  it('laisse la question « l’intervention a-t-elle eu lieu ? » ouverte le temps des relances', () => {
    // Une question, deux relances à une semaine d'intervalle, plus une marge : le lien du
    // premier message doit encore fonctionner quand le client s'y remet.
    expect(DUREE_LIEN_JOURS.confirmer_intervention).toBeGreaterThanOrEqual(21);
  });

  it('ferme la modification avant la péremption de la demande, à 72 heures', () => {
    expect(DUREE_LIEN_JOURS.modifier_demande).toBeLessThanOrEqual(3);
  });
});

describe('lienRejouable', () => {
  it('laisse revenir sur une consultation', () => {
    expect(lienRejouable('voir_pros')).toBe(true);
    expect(lienRejouable('modifier_demande')).toBe(true);
  });

  it.each(['annuler_demande', 'deposer_avis', 'signer_devis', 'payer_facture'] as const)(
    'consomme %s, qui ne se refait pas',
    (action) => {
      expect(lienRejouable(action)).toBe(false);
    },
  );
});

describe('decideLien', () => {
  it('accepte un lien neuf et valide', () => {
    expect(decideLien(lien(), MAINTENANT)).toEqual({ issue: 'valide' });
  });

  it('refuse un lien expiré, à la seconde près', () => {
    expect(decideLien(lien({ expireLe: new Date(MAINTENANT) }), MAINTENANT)).toEqual({
      issue: 'expire',
    });
  });

  it('refuse un lien à action unique déjà consommé', () => {
    expect(decideLien(lien({ utiliseLe: new Date('2026-10-29T08:00:00Z') }), MAINTENANT)).toEqual({
      issue: 'deja-utilise',
    });
  });

  it('laisse rouvrir une consultation déjà ouverte', () => {
    const consultation = lien({
      action: 'voir_pros',
      utiliseLe: new Date('2026-10-29T08:00:00Z'),
      expireLe: new Date('2027-01-26T10:00:00Z'),
    });
    expect(decideLien(consultation, MAINTENANT)).toEqual({ issue: 'valide' });
  });

  it('annonce l’expiration plutôt que la consommation quand les deux valent', () => {
    const vieuxEtUse = lien({
      expireLe: new Date('2026-10-01T10:00:00Z'),
      utiliseLe: new Date('2026-09-30T10:00:00Z'),
    });
    expect(decideLien(vieuxEtUse, MAINTENANT)).toEqual({ issue: 'expire' });
  });
});

describe('expirationLien', () => {
  it('applique la durée de l’action', () => {
    expect(expirationLien('annuler_demande', MAINTENANT).toISOString()).toBe(
      '2026-11-04T10:00:00.000Z',
    );
    expect(expirationLien('voir_pros', MAINTENANT).toISOString()).toBe('2027-01-26T10:00:00.000Z');
  });

  it('place toujours l’expiration dans le futur', () => {
    for (const action of TOUTES) {
      expect(expirationLien(action, MAINTENANT).getTime()).toBeGreaterThan(MAINTENANT.getTime());
    }
  });
});

describe('jetonBienForme', () => {
  it('accepte 43 caractères de base64url', () => {
    expect(jetonBienForme('a'.repeat(43))).toBe(true);
    expect(jetonBienForme(`${'-_'.repeat(21)}A`)).toBe(true);
  });

  it.each(['', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}+`, `${'a'.repeat(42)}/`])(
    'refuse %s',
    (valeur) => {
      expect(jetonBienForme(valeur)).toBe(false);
    },
  );
});
