import { describe, expect, it } from 'vitest';
import {
  calculeRecredit,
  contestationRecevable,
  instruitContestation,
  MOTIFS_CONTESTATION,
  type EtatContestation,
  type FaitsContestation,
  type MotifContestation,
} from './contestation.ts';

const MAINTENANT = new Date('2026-10-28T10:00:00Z');

const REGLES = {
  appelsAvantInjoignable: 3,
  heuresFenetreInjoignable: 48,
  minutesAnnulationRecreditee: 60,
};

function etat(partiel: Partial<EtatContestation> = {}): EtatContestation {
  return {
    accepteeLe: new Date('2026-10-25T10:00:00Z'),
    montantHT: 12,
    consommeForfait: false,
    dejaRecredite: false,
    dejaContestee: false,
    ...partiel,
  };
}

function faits(partiel: Partial<FaitsContestation> = {}): FaitsContestation {
  return {
    appelsSansReponse: 0,
    doublonAvere: false,
    minutesAvantAnnulation: null,
    interventionConfirmee: false,
    contactEtabli: false,
    ...partiel,
  };
}

describe('contestationRecevable', () => {
  it('accepte dans le délai', () => {
    expect(contestationRecevable(etat(), 7, MAINTENANT)).toEqual({ issue: 'recevable' });
  });

  it('refuse au-delà du délai, et dit jusqu’à quand c’était possible', () => {
    const resultat = contestationRecevable(etat(), 2, MAINTENANT);
    expect(resultat.issue).toBe('hors-delai');
    if (resultat.issue !== 'hors-delai') return;
    expect(resultat.limite.toISOString()).toBe('2026-10-27T10:00:00.000Z');
  });

  it('refuse quand il n’y a rien à rendre', () => {
    expect(
      contestationRecevable(etat({ montantHT: 0, consommeForfait: false }), 7, MAINTENANT),
    ).toEqual({ issue: 'rien-a-rendre' });
  });

  it('accepte une demande prise sur le forfait : l’unité, elle, se rend', () => {
    expect(
      contestationRecevable(etat({ montantHT: 0, consommeForfait: true }), 7, MAINTENANT),
    ).toEqual({ issue: 'recevable' });
  });

  it('ne recrédite pas deux fois, et ne conteste pas deux fois', () => {
    expect(contestationRecevable(etat({ dejaRecredite: true }), 7, MAINTENANT)).toEqual({
      issue: 'deja-recreditee',
    });
    expect(contestationRecevable(etat({ dejaContestee: true }), 7, MAINTENANT)).toEqual({
      issue: 'deja-contestee',
    });
  });
});

describe('instruitContestation', () => {
  it('ferme le débat quand le client a confirmé l’intervention, quel que soit le motif', () => {
    for (const motif of Object.keys(MOTIFS_CONTESTATION) as MotifContestation[]) {
      const decision = instruitContestation(
        motif,
        faits({ interventionConfirmee: true, appelsSansReponse: 9, doublonAvere: true }),
        REGLES,
      );
      expect(decision.issue).toBe('refus-de-droit');
    }
  });

  describe('client injoignable', () => {
    it('recrédite sur trois appels tracés sans réponse', () => {
      const decision = instruitContestation(
        'client_injoignable',
        faits({ appelsSansReponse: 3 }),
        REGLES,
      );
      expect(decision.issue).toBe('recredit-de-droit');
      expect(decision.explication).toContain('3 appels');
    });

    it('renvoie à un humain en deçà : la base ne prouve rien', () => {
      expect(
        instruitContestation('client_injoignable', faits({ appelsSansReponse: 2 }), REGLES).issue,
      ).toBe('a-instruire');
    });

    it('refuse quand le contact a eu lieu', () => {
      const decision = instruitContestation(
        'client_injoignable',
        faits({ appelsSansReponse: 5, contactEtabli: true }),
        REGLES,
      );
      expect(decision.issue).toBe('refus-de-droit');
    });
  });

  describe('doublon', () => {
    it('recrédite un doublon constaté', () => {
      expect(instruitContestation('doublon', faits({ doublonAvere: true }), REGLES).issue).toBe(
        'recredit-de-droit',
      );
    });

    it('renvoie à un humain quand la base ne voit rien', () => {
      expect(instruitContestation('doublon', faits(), REGLES).issue).toBe('a-instruire');
    });
  });

  describe('annulation immédiate', () => {
    it('recrédite une annulation dans l’heure, avant tout contact', () => {
      const decision = instruitContestation(
        'annulation_immediate',
        faits({ minutesAvantAnnulation: 12 }),
        REGLES,
      );
      expect(decision.issue).toBe('recredit-de-droit');
      expect(decision.explication).toContain('12 minutes');
    });

    it('recrédite encore à la minute limite, pas après', () => {
      expect(
        instruitContestation('annulation_immediate', faits({ minutesAvantAnnulation: 60 }), REGLES)
          .issue,
      ).toBe('recredit-de-droit');
      expect(
        instruitContestation('annulation_immediate', faits({ minutesAvantAnnulation: 61 }), REGLES)
          .issue,
      ).toBe('a-instruire');
    });

    it('refuse si le pro avait déjà joint le client', () => {
      expect(
        instruitContestation(
          'annulation_immediate',
          faits({ minutesAvantAnnulation: 5, contactEtabli: true }),
          REGLES,
        ).issue,
      ).toBe('refus-de-droit');
    });

    it('refuse si la demande n’a jamais été annulée', () => {
      expect(instruitContestation('annulation_immediate', faits(), REGLES).issue).toBe(
        'refus-de-droit',
      );
    });
  });

  it.each(['coordonnees_fausses', 'hors_zone', 'hors_metier', 'demande_fantaisiste'] as const)(
    'laisse %s à un humain : la base ne sait pas trancher',
    (motif) => {
      const decision = instruitContestation(motif, faits(), REGLES);
      expect(decision.issue).toBe('a-instruire');
      expect(decision.explication).toContain(MOTIFS_CONTESTATION[motif].libelle);
    },
  );

  it('déclare vérifiables exactement les trois motifs que la base sait prouver', () => {
    const verifiables = Object.entries(MOTIFS_CONTESTATION)
      .filter(([, regle]) => regle.verifiable)
      .map(([cle]) => cle)
      .sort();
    expect(verifiables).toEqual(['annulation_immediate', 'client_injoignable', 'doublon']);
  });
});

describe('calculeRecredit', () => {
  it('rend l’unité au forfait quand la demande y était incluse', () => {
    expect(calculeRecredit(etat({ montantHT: 0, consommeForfait: true }))).toEqual({
      montantHT: 0,
      rendAuForfait: true,
    });
  });

  it('rend l’argent quand la demande a été facturée', () => {
    expect(calculeRecredit(etat({ montantHT: 12, consommeForfait: false }))).toEqual({
      montantHT: 12,
      rendAuForfait: false,
    });
  });

  it('ne rend jamais les deux à la fois', () => {
    const recredit = calculeRecredit(etat({ montantHT: 12, consommeForfait: true }));
    expect(recredit.rendAuForfait && recredit.montantHT > 0).toBe(false);
  });
});
