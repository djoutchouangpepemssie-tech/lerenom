/**
 * Le rendez-vous : qui peut quoi, et quand.
 *
 * Ce que ces tests gardent :
 *
 *   * **un client qui rouvre son SMS après avoir répondu est rassuré, pas alarmé** — l'ordre
 *     des refus n'est pas indifférent ;
 *   * **un rendez-vous passé s'annule encore** : c'est ainsi qu'on consigne un client absent ;
 *   * **le rappel le plus proche prime** : un rendez-vous dans une heure n'a pas besoin de
 *     celui de la veille, même s'il n'est jamais parti.
 */

import { describe, expect, it } from 'vitest';
import {
  MESSAGE_REFUS,
  RAPPEL_PROCHE_HEURES,
  RAPPEL_VEILLE_HEURES,
  heuresAvant,
  peutAnnuler,
  peutMarquerHonore,
  peutRepondre,
  rappelAEnvoyer,
  type EtatRendezVous,
  type StatutRendezVous,
} from './rendez-vous.ts';

const MAINTENANT = new Date('2026-03-03T10:00:00');
const DEMAIN = new Date('2026-03-04T10:00:00');
const HIER = new Date('2026-03-02T10:00:00');

function etat(modifications: Partial<EtatRendezVous> = {}): EtatRendezVous {
  return {
    statut: 'propose',
    debut: DEMAIN,
    expireLe: new Date('2026-03-03T18:00:00'),
    ...modifications,
  };
}

describe('peutRepondre', () => {
  it('accepte une proposition vivante pour un créneau à venir', () => {
    expect(peutRepondre(etat(), MAINTENANT)).toEqual({ ok: true });
  });

  it('dit « déjà répondu » avant toute autre raison', () => {
    // Un client qui rouvre son SMS après avoir accepté ne doit pas lire « expiré » : il
    // croirait avoir perdu son rendez-vous.
    const confirme = etat({ statut: 'confirme', expireLe: HIER, debut: HIER });
    expect(peutRepondre(confirme, MAINTENANT)).toEqual({ ok: false, refus: 'deja-repondu' });
    expect(MESSAGE_REFUS['deja-repondu']).toContain('déjà répondu');
  });

  it('refuse une proposition expirée', () => {
    expect(peutRepondre(etat({ expireLe: HIER }), MAINTENANT)).toEqual({
      ok: false,
      refus: 'expire',
    });
  });

  it('refuse un créneau passé, même si la proposition vit encore', () => {
    const tardif = etat({ debut: HIER, expireLe: new Date('2026-03-05T10:00:00') });
    expect(peutRepondre(tardif, MAINTENANT)).toEqual({ ok: false, refus: 'passe' });
  });

  it('accepte une proposition sans échéance', () => {
    expect(peutRepondre(etat({ expireLe: null }), MAINTENANT)).toEqual({ ok: true });
  });
});

describe('peutAnnuler', () => {
  it('annule un rendez-vous proposé comme un rendez-vous confirmé', () => {
    for (const statut of ['propose', 'confirme'] as const) {
      expect(peutAnnuler(etat({ statut }))).toEqual({ ok: true });
    }
  });

  it('annule encore un rendez-vous passé : c’est ainsi qu’on consigne une absence', () => {
    expect(peutAnnuler(etat({ statut: 'confirme', debut: HIER }))).toEqual({ ok: true });
  });

  it('refuse d’annuler deux fois', () => {
    expect(peutAnnuler(etat({ statut: 'annule' }))).toEqual({ ok: false, refus: 'deja-annule' });
  });
});

describe('peutMarquerHonore', () => {
  it('n’honore qu’un rendez-vous confirmé', () => {
    expect(peutMarquerHonore(etat({ statut: 'confirme' }))).toEqual({ ok: true });
  });

  it('refuse d’honorer ce que le client n’a jamais accepté', () => {
    // Le compter fausserait les statistiques du professionnel.
    for (const statut of ['propose', 'annule'] as StatutRendezVous[]) {
      expect(peutMarquerHonore(etat({ statut }))).toEqual({ ok: false, refus: 'pas-confirme' });
    }
  });
});

describe('heuresAvant', () => {
  it('compte les heures qui restent', () => {
    expect(heuresAvant(DEMAIN, MAINTENANT)).toBe(24);
  });

  it('rend un nombre négatif pour un rendez-vous passé', () => {
    expect(heuresAvant(HIER, MAINTENANT)).toBe(-24);
  });
});

describe('rappelAEnvoyer', () => {
  function rdv(heures: number, deja: { veille?: boolean; proche?: boolean } = {}) {
    return {
      statut: 'confirme' as const,
      debut: new Date(MAINTENANT.getTime() + heures * 3_600_000),
      rappelVeilleLe: deja.veille === true ? MAINTENANT : null,
      rappelProcheLe: deja.proche === true ? MAINTENANT : null,
    };
  }

  it('envoie celui de la veille à vingt-quatre heures', () => {
    expect(rappelAEnvoyer(rdv(RAPPEL_VEILLE_HEURES), MAINTENANT)).toBe('veille');
  });

  it('n’envoie rien trop tôt', () => {
    expect(rappelAEnvoyer(rdv(48), MAINTENANT)).toBeNull();
  });

  it('envoie le rappel proche à deux heures', () => {
    expect(rappelAEnvoyer(rdv(RAPPEL_PROCHE_HEURES), MAINTENANT)).toBe('proche');
  });

  it('préfère le rappel proche, même si celui de la veille n’est jamais parti', () => {
    // Un rendez-vous dans une heure n'a plus besoin qu'on lui rappelle « c'est demain ».
    expect(rappelAEnvoyer(rdv(1), MAINTENANT)).toBe('proche');
  });

  it('ne renvoie pas un rappel déjà envoyé', () => {
    expect(rappelAEnvoyer(rdv(20, { veille: true }), MAINTENANT)).toBeNull();
    expect(rappelAEnvoyer(rdv(1, { proche: true, veille: true }), MAINTENANT)).toBeNull();
  });

  it('ne rappelle rien pour un rendez-vous passé', () => {
    expect(rappelAEnvoyer(rdv(-1), MAINTENANT)).toBeNull();
  });

  it('ne rappelle rien pour un rendez-vous non confirmé', () => {
    expect(rappelAEnvoyer({ ...rdv(5), statut: 'propose' }, MAINTENANT)).toBeNull();
    expect(rappelAEnvoyer({ ...rdv(5), statut: 'annule' }, MAINTENANT)).toBeNull();
  });
});
