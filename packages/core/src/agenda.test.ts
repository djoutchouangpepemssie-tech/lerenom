/**
 * L'agenda d'un professionnel. Ce que ces tests gardent :
 *
 *   * **deux plages ne se chevauchent pas**, bornes exclues — deux rendez-vous qui
 *     s'enchaînent ne doivent pas être refusés ;
 *   * **une proposition expirée cesse de bloquer** : sans cela, un agenda se minéralise au
 *     fil des clients qui ne répondent pas ;
 *   * **le passé ne se propose pas**, mais il se consigne ;
 *   * **une plage qui enjambe minuit appartient aux deux jours**.
 */

import { describe, expect, it } from 'vitest';
import {
  DUREE_MAXIMALE_HEURES,
  DUREE_MINIMALE_MINUTES,
  RELANCE_PROPOSITION_HEURES,
  VALIDITE_PROPOSITION_HEURES,
  aRelancer,
  chevauchent,
  dureeMinutes,
  expirationProposition,
  heureDe,
  occupeEncore,
  plagesDuJour,
  problemesPlage,
  semaineDe,
  type PlageExistante,
  type SaisiePlage,
} from './agenda.ts';

/** Un instant fixe : un agenda se raisonne sur des dates, pas sur « maintenant ». */
const MAINTENANT = new Date('2026-03-03T10:00:00');

function a(heure: string): Date {
  return new Date(`2026-03-03T${heure}:00`);
}

function existante(
  debut: string,
  fin: string,
  reste: Partial<PlageExistante> = {},
): PlageExistante {
  return {
    id: `${debut}-${fin}`,
    type: 'intervention',
    debut: a(debut),
    fin: a(fin),
    expireLe: null,
    ...reste,
  };
}

function saisie(
  debut: string,
  fin: string,
  type: SaisiePlage['type'] = 'intervention',
): SaisiePlage {
  return { type, debut: a(debut), fin: a(fin) };
}

describe('chevauchent', () => {
  it('voit le recouvrement partiel, dans les deux sens', () => {
    expect(
      chevauchent({ debut: a('09:00'), fin: a('10:00') }, { debut: a('09:30'), fin: a('11:00') }),
    ).toBe(true);
    expect(
      chevauchent({ debut: a('09:30'), fin: a('11:00') }, { debut: a('09:00'), fin: a('10:00') }),
    ).toBe(true);
  });

  it('voit l’inclusion complète', () => {
    expect(
      chevauchent({ debut: a('09:00'), fin: a('12:00') }, { debut: a('10:00'), fin: a('11:00') }),
    ).toBe(true);
  });

  it('laisse deux rendez-vous s’enchaîner bord à bord', () => {
    // 10 h – 11 h puis 11 h – 12 h : c'est une journée normale, pas un conflit.
    expect(
      chevauchent({ debut: a('10:00'), fin: a('11:00') }, { debut: a('11:00'), fin: a('12:00') }),
    ).toBe(false);
  });

  it('ne voit rien entre deux plages disjointes', () => {
    expect(
      chevauchent({ debut: a('09:00'), fin: a('10:00') }, { debut: a('14:00'), fin: a('15:00') }),
    ).toBe(false);
  });
});

describe('occupeEncore', () => {
  it('une intervention occupe toujours', () => {
    expect(occupeEncore(existante('09:00', '10:00'), MAINTENANT)).toBe(true);
  });

  it('une proposition encore valable occupe', () => {
    const plage = existante('14:00', '15:00', {
      type: 'propose',
      expireLe: new Date(MAINTENANT.getTime() + 3_600_000),
    });
    expect(occupeEncore(plage, MAINTENANT)).toBe(true);
  });

  it('une proposition expirée libère la plage, sans que personne n’intervienne', () => {
    const plage = existante('14:00', '15:00', {
      type: 'propose',
      expireLe: new Date(MAINTENANT.getTime() - 1000),
    });
    expect(occupeEncore(plage, MAINTENANT)).toBe(false);
  });

  it('une proposition sans échéance occupe : on ne libère pas sur une donnée manquante', () => {
    const plage = existante('14:00', '15:00', { type: 'propose', expireLe: null });
    expect(occupeEncore(plage, MAINTENANT)).toBe(true);
  });
});

describe('expiration et relance', () => {
  it('une proposition vaut quarante-huit heures', () => {
    const echeance = expirationProposition(MAINTENANT);
    expect(echeance.getTime() - MAINTENANT.getTime()).toBe(VALIDITE_PROPOSITION_HEURES * 3_600_000);
  });

  it('relance après vingt-quatre heures sans réponse, une seule fois', () => {
    const creeLe = new Date(MAINTENANT.getTime() - RELANCE_PROPOSITION_HEURES * 3_600_000);
    expect(aRelancer({ type: 'propose', creeLe, relanceeLe: null }, MAINTENANT)).toBe(true);
    expect(aRelancer({ type: 'propose', creeLe, relanceeLe: MAINTENANT }, MAINTENANT)).toBe(false);
  });

  it('ne relance pas avant l’heure', () => {
    const creeLe = new Date(MAINTENANT.getTime() - 23 * 3_600_000);
    expect(aRelancer({ type: 'propose', creeLe, relanceeLe: null }, MAINTENANT)).toBe(false);
  });

  it('ne relance jamais sur autre chose qu’une proposition', () => {
    const creeLe = new Date(MAINTENANT.getTime() - 72 * 3_600_000);
    expect(aRelancer({ type: 'intervention', creeLe, relanceeLe: null }, MAINTENANT)).toBe(false);
  });
});

describe('problemesPlage', () => {
  it('ne reproche rien à une plage valable', () => {
    expect(problemesPlage(saisie('14:00', '15:00'), [], MAINTENANT)).toEqual([]);
  });

  it('refuse une fin avant le début', () => {
    expect(problemesPlage(saisie('15:00', '14:00'), [], MAINTENANT)[0]?.champ).toBe('fin');
  });

  it('refuse une plage trop courte', () => {
    const problemes = problemesPlage(saisie('14:00', '14:10'), [], MAINTENANT);
    expect(problemes[0]?.message).toContain(String(DUREE_MINIMALE_MINUTES));
  });

  it('accepte très exactement la durée minimale', () => {
    expect(problemesPlage(saisie('14:00', '14:15'), [], MAINTENANT)).toEqual([]);
  });

  it('refuse une plage démesurée : c’est une date de fin mal saisie', () => {
    const debut = new Date('2026-03-03T08:00:00');
    const fin = new Date('2026-03-04T08:00:00');
    const problemes = problemesPlage({ type: 'intervention', debut, fin }, [], MAINTENANT);
    expect(problemes[0]?.message).toContain(String(DUREE_MAXIMALE_HEURES));
  });

  it('refuse le chevauchement et dit avec quoi', () => {
    const problemes = problemesPlage(
      saisie('09:30', '10:30'),
      [existante('09:00', '10:00')],
      MAINTENANT,
    );
    expect(problemes[0]?.champ).toBe('chevauchement');
    // Le message nomme l'heure du conflit : « ça chevauche » obligerait à chercher quoi.
    expect(problemes[0]?.message).toContain('9 h');
  });

  it('accepte de poser une plage sur une proposition expirée', () => {
    const morte = existante('14:00', '15:00', {
      type: 'propose',
      expireLe: new Date(MAINTENANT.getTime() - 1000),
    });
    expect(problemesPlage(saisie('14:00', '15:00'), [morte], MAINTENANT)).toEqual([]);
  });

  it('refuse de proposer un créneau dans le passé', () => {
    const problemes = problemesPlage(saisie('08:00', '09:00', 'propose'), [], MAINTENANT);
    expect(problemes.map((p) => p.champ)).toContain('debut');
  });

  it('accepte de consigner une intervention passée', () => {
    // Noter après coup ce qu'on a fait ce matin est un usage normal de l'agenda.
    expect(problemesPlage(saisie('08:00', '09:00'), [], MAINTENANT)).toEqual([]);
  });

  it('rend tous les problèmes à la fois', () => {
    const problemes = problemesPlage(
      saisie('08:00', '08:05', 'propose'),
      [existante('07:00', '09:00')],
      MAINTENANT,
    );
    expect(problemes.map((p) => p.champ).toSorted()).toEqual(['chevauchement', 'debut', 'fin']);
  });
});

describe('plagesDuJour', () => {
  it('rend les plages du jour, dans l’ordre', () => {
    const plages = [existante('15:00', '16:00'), existante('09:00', '10:00')];
    const ordonnees = plagesDuJour(plages, a('12:00'));
    expect(ordonnees.map((p) => p.debut.getHours())).toEqual([9, 15]);
  });

  it('écarte les plages d’un autre jour', () => {
    const demain = {
      ...existante('09:00', '10:00'),
      debut: new Date('2026-03-04T09:00:00'),
      fin: new Date('2026-03-04T10:00:00'),
    };
    expect(plagesDuJour([demain], a('12:00'))).toHaveLength(0);
  });

  it('montre une plage à cheval sur minuit dans les deux jours', () => {
    // L'agenda d'un dépanneur de nuit : la perdre au lendemain serait un défaut.
    const nuit = {
      ...existante('23:00', '23:59'),
      debut: new Date('2026-03-03T23:00:00'),
      fin: new Date('2026-03-04T01:00:00'),
    };
    expect(plagesDuJour([nuit], new Date('2026-03-03T12:00:00'))).toHaveLength(1);
    expect(plagesDuJour([nuit], new Date('2026-03-04T12:00:00'))).toHaveLength(1);
  });
});

describe('semaineDe', () => {
  it('commence le lundi', () => {
    // 2026-03-03 est un mardi.
    const semaine = semaineDe(new Date('2026-03-03T15:00:00'));
    expect(semaine).toHaveLength(7);
    expect(semaine[0]?.getDate()).toBe(2);
    expect(semaine[6]?.getDate()).toBe(8);
  });

  it('rattache le dimanche à la semaine qui s’achève, pas à celle qui s’ouvre', () => {
    const semaine = semaineDe(new Date('2026-03-08T15:00:00'));
    expect(semaine[0]?.getDate()).toBe(2);
    expect(semaine[6]?.getDate()).toBe(8);
  });

  it('remet chaque jour à minuit', () => {
    for (const jour of semaineDe(new Date('2026-03-03T15:42:00'))) {
      expect([jour.getHours(), jour.getMinutes(), jour.getSeconds()]).toEqual([0, 0, 0]);
    }
  });
});

describe('affichage', () => {
  it('dit l’heure comme on la prononce', () => {
    expect(heureDe(a('09:00'))).toBe('9 h');
    expect(heureDe(a('14:30'))).toBe('14 h 30');
    expect(heureDe(a('08:05'))).toBe('8 h 05');
  });

  it('compte la durée en minutes', () => {
    expect(dureeMinutes({ debut: a('09:00'), fin: a('10:30') })).toBe(90);
  });
});
