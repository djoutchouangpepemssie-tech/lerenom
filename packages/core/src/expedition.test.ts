/**
 * Les règles d'expédition.
 *
 * Le test le plus important de ce fichier est celui de la péremption. Il garde un dégât précis
 * et déjà en attente : deux cent quatre-vingt-six messages dorment en base faute de
 * fournisseur, et le jour où l'on en raccorde un, ils partiraient tous. Des rappels pour des
 * rendez-vous passés, des créneaux rendus depuis longtemps. Le client ne lit pas dix SMS
 * périmés : il bloque l'expéditeur, et on perd le canal pour de bon.
 */

import { describe, expect, it } from 'vitest';
import {
  PEREMPTION_MESSAGE_HEURES,
  TENTATIVES_MAXIMALES,
  apresEnvoi,
  attenteAvantTentative,
  decideExpedition,
  type MessageAExpedier,
} from './expedition.ts';

const MAINTENANT = new Date(2026, 2, 10, 12, 0, 0);

function ilYA(heures: number): Date {
  return new Date(MAINTENANT.getTime() - heures * 3_600_000);
}

function message(modification: Partial<MessageAExpedier> = {}): MessageAExpedier {
  return {
    canal: 'sms',
    statut: 'en_attente',
    destinataire: '0612345678',
    creeLe: ilYA(0.1),
    tentatives: 0,
    derniereTentativeLe: null,
    ...modification,
  };
}

describe('decideExpedition', () => {
  it('expédie un message neuf, en attente, avec un destinataire', () => {
    expect(decideExpedition(message(), MAINTENANT)).toEqual({ action: 'expedier' });
  });

  describe('un message ne part jamais deux fois', () => {
    it.each(['envoye', 'livre', 'echec'] as const)('n’expédie pas un message %s', (statut) => {
      // La garantie la moins chère et la plus importante : l'état fait autorité.
      expect(decideExpedition(message({ statut }), MAINTENANT).action).toBe('attendre');
    });
  });

  describe('la péremption', () => {
    it('abandonne un message plus vieux que le délai, en disant pourquoi', () => {
      const decision = decideExpedition(message({ creeLe: ilYA(30) }), MAINTENANT);

      expect(decision.action).toBe('abandonner');
      if (decision.action !== 'abandonner') return;
      expect(decision.raison).toContain('périmé');
      expect(decision.raison).toContain('30 h');
    });

    it('expédie encore juste avant l’échéance, abandonne juste après', () => {
      const presque = message({ creeLe: ilYA(PEREMPTION_MESSAGE_HEURES - 0.01) });
      expect(decideExpedition(presque, MAINTENANT).action).toBe('expedier');

      const pile = message({ creeLe: ilYA(PEREMPTION_MESSAGE_HEURES) });
      expect(decideExpedition(pile, MAINTENANT).action).toBe('abandonner');
    });

    it('n’envoie rien du dormant, même tout neuf en tentatives', () => {
      // Le cas réel : une file remplie pendant des semaines sans fournisseur. Aucun de ces
      // messages n'a jamais été tenté ; aucun ne doit partir pour autant.
      const dormant = message({ creeLe: ilYA(72), tentatives: 0 });
      expect(decideExpedition(dormant, MAINTENANT).action).toBe('abandonner');
    });

    it('accepte un autre délai quand on lui en donne un', () => {
      const vieux = message({ creeLe: ilYA(30) });
      expect(decideExpedition(vieux, MAINTENANT, 48).action).toBe('expedier');
    });

    it('prime sur les tentatives : on ne réessaie pas ce qui n’a plus d’objet', () => {
      const decision = decideExpedition(
        message({ creeLe: ilYA(30), tentatives: TENTATIVES_MAXIMALES }),
        MAINTENANT,
      );
      expect(decision.action).toBe('abandonner');
      if (decision.action !== 'abandonner') return;
      expect(decision.raison).toContain('périmé');
    });
  });

  describe('les tentatives', () => {
    it('abandonne après le nombre maximal', () => {
      const decision = decideExpedition(
        message({ tentatives: TENTATIVES_MAXIMALES, derniereTentativeLe: ilYA(5) }),
        MAINTENANT,
      );
      expect(decision.action).toBe('abandonner');
      if (decision.action !== 'abandonner') return;
      expect(decision.raison).toContain('tentatives');
    });

    it('fait attendre tant que le délai de la tentative n’est pas écoulé', () => {
      // Quatre tentatives : huit minutes d'attente. Deux minutes écoulées, on patiente.
      const decision = decideExpedition(
        message({ tentatives: 4, derniereTentativeLe: new Date(MAINTENANT.getTime() - 120_000) }),
        MAINTENANT,
      );
      expect(decision.action).toBe('attendre');
      if (decision.action !== 'attendre') return;
      expect(decision.raison).toContain('min');
    });

    it('reprend quand le délai est écoulé', () => {
      const decision = decideExpedition(
        message({
          tentatives: 4,
          derniereTentativeLe: new Date(MAINTENANT.getTime() - 9 * 60_000),
        }),
        MAINTENANT,
      );
      expect(decision.action).toBe('expedier');
    });

    it('n’attend pas avant la première tentative', () => {
      expect(decideExpedition(message({ tentatives: 0 }), MAINTENANT).action).toBe('expedier');
    });
  });

  describe('le destinataire', () => {
    it.each(['', '   '])('abandonne un destinataire « %s »', (destinataire) => {
      // Un champ rempli d'espaces n'est pas une adresse. On n'essaie pas cinq fois pour rien.
      const decision = decideExpedition(message({ destinataire }), MAINTENANT);
      expect(decision.action).toBe('abandonner');
      if (decision.action !== 'abandonner') return;
      expect(decision.raison).toContain('destinataire');
    });
  });
});

describe('attenteAvantTentative', () => {
  it('double à chaque tentative', () => {
    expect([0, 1, 2, 3, 4, 5].map(attenteAvantTentative)).toEqual([0, 1, 2, 4, 8, 16]);
  });

  it('plafonne au lieu de croître sans fin', () => {
    // Sans plafond, la dixième tentative attendrait huit heures, et la vingtième un an.
    expect(attenteAvantTentative(20)).toBe(64);
    expect(attenteAvantTentative(100)).toBe(64);
  });
});

describe('apresEnvoi', () => {
  it('marque envoyé en cas de succès, sans erreur', () => {
    expect(apresEnvoi({ ok: true, fournisseurId: 'abc' })).toEqual({
      statut: 'envoye',
      erreur: null,
    });
  });

  it('laisse en attente un échec passager : il sera repris', () => {
    expect(apresEnvoi({ ok: false, erreur: 'temps dépassé', definitif: false })).toEqual({
      statut: 'en_attente',
      erreur: 'temps dépassé',
    });
  });

  it('clôt un échec définitif : insister ne changerait rien', () => {
    // Un numéro inexistant ne se mettra pas à exister, et chaque tentative coûte.
    expect(apresEnvoi({ ok: false, erreur: 'numéro inexistant', definitif: true })).toEqual({
      statut: 'echec',
      erreur: 'numéro inexistant',
    });
  });

  it('conserve toujours la raison de l’échec', () => {
    for (const definitif of [true, false]) {
      expect(apresEnvoi({ ok: false, erreur: 'quota dépassé', definitif }).erreur).toBe(
        'quota dépassé',
      );
    }
  });
});
