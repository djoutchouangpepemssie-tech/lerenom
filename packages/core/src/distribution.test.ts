import { describe, expect, it } from 'vitest';
import {
  MOTIFS_REFUS,
  demandeComplete,
  demandePerimee,
  noteMixte,
  objectifPros,
  peutEncoreDistribuer,
  peutEtreRePropose,
  planifieCascadePartagee,
  planifieCascadeUrgente,
  rapproche,
  rayonElargi,
  solliciter,
  statutDemande,
} from './distribution';
import type { EtatDistribution, ProCandidat, ProRetenu } from './distribution';
import { PARAMETRES_PAR_DEFAUT, avecParametres } from './parametres';

const P = PARAMETRES_PAR_DEFAUT;

const ADRESSE = { latitude: 48.8594, longitude: 2.3765 }; // Paris 11e
const MONTREUIL = { latitude: 48.8638, longitude: 2.4485 }; // ≈ 5,3 km
const VERSAILLES = { latitude: 48.8014, longitude: 2.1301 }; // ≈ 19 km

function pro(partiel: Partial<ProCandidat> & { entrepriseId: string }): ProCandidat {
  return {
    formule: 'gratuit',
    score: 0.5,
    note: 4.5,
    metierCorrespond: true,
    disponible: true,
    compteAJour: true,
    demandesAccepteesCeMois: 0,
    agences: [{ agenceId: `${partiel.entrepriseId}-a1`, position: ADRESSE, rayonKm: 10 }],
    ...partiel,
  };
}

function retenu(partiel: Partial<ProRetenu> & { entrepriseId: string }): ProRetenu {
  return {
    formule: 'gratuit',
    score: 0.5,
    agenceId: `${partiel.entrepriseId}-a1`,
    distanceKm: 2,
    titulaireExclusivite: false,
    demandesAccepteesCeMois: 0,
    ...partiel,
  };
}

describe('rapproche : éligibilité d’un pro à une demande', () => {
  it('retient un pro du bon métier, disponible, dans sa zone', () => {
    const { retenus, ecartes } = rapproche([pro({ entrepriseId: 'ok' })], ADRESSE, P);
    expect(retenus).toHaveLength(1);
    expect(ecartes).toHaveLength(0);
    expect(retenus[0]?.distanceKm).toBeCloseTo(0, 5);
  });

  it('écarte un pro dont le métier ne correspond pas', () => {
    const { retenus, ecartes } = rapproche(
      [pro({ entrepriseId: 'plombier', metierCorrespond: false })],
      ADRESSE,
      P,
    );
    expect(retenus).toHaveLength(0);
    expect(ecartes[0]?.raison).toBe('metier-different');
  });

  it('écarte un pro hors zone en disant la distance et le rayon', () => {
    const { ecartes } = rapproche(
      [
        pro({
          entrepriseId: 'loin',
          agences: [{ agenceId: 'a1', position: MONTREUIL, rayonKm: 4 }],
        }),
      ],
      ADRESSE,
      P,
    );
    expect(ecartes[0]?.raison).toBe('hors-zone');
    expect(ecartes[0]?.explication).toMatch(/^Hors zone : 5,\d km pour un rayon de 4,0 km\.$/);
  });

  it('écarte un pro indisponible comme indisponible, pas comme hors zone', () => {
    const { ecartes } = rapproche([pro({ entrepriseId: 'absent', disponible: false })], ADRESSE, P);
    expect(ecartes[0]?.raison).toBe('indisponible');
  });

  it('écarte un pro sous la note minimale de 3,5', () => {
    const { ecartes } = rapproche([pro({ entrepriseId: 'mal-note', note: 3.2 })], ADRESSE, P);
    expect(ecartes[0]?.raison).toBe('note-insuffisante');
    expect(ecartes[0]?.explication).toContain('3,2');
  });

  it('retient un pro qui n’a pas encore d’avis', () => {
    const { retenus } = rapproche([pro({ entrepriseId: 'nouveau', note: null })], ADRESSE, P);
    expect(retenus).toHaveLength(1);
  });

  it('écarte un pro dont le compte n’est pas à jour', () => {
    const { ecartes } = rapproche(
      [pro({ entrepriseId: 'impaye', compteAJour: false })],
      ADRESSE,
      P,
    );
    expect(ecartes[0]?.raison).toBe('compte-non-a-jour');
  });

  it('écarte un pro sans aucune agence enregistrée', () => {
    const { ecartes } = rapproche([pro({ entrepriseId: 'sans-agence', agences: [] })], ADRESSE, P);
    expect(ecartes[0]?.raison).toBe('hors-zone');
    expect(ecartes[0]?.explication).toBe('Aucune agence enregistrée.');
  });

  it('rattache la demande à l’agence la plus proche qui couvre l’adresse', () => {
    const { retenus } = rapproche(
      [
        pro({
          entrepriseId: 'trois-agences',
          formule: 'premium',
          agences: [
            { agenceId: 'versailles', position: VERSAILLES, rayonKm: 30 },
            { agenceId: 'montreuil', position: MONTREUIL, rayonKm: 30 },
            { agenceId: 'paris-11', position: ADRESSE, rayonKm: 30 },
          ],
        }),
      ],
      ADRESSE,
      P,
    );
    expect(retenus[0]?.agenceId).toBe('paris-11');
  });

  it('ignore une agence hors zone au profit d’une agence qui couvre', () => {
    const { retenus } = rapproche(
      [
        pro({
          entrepriseId: 'mixte',
          agences: [
            { agenceId: 'trop-petit-rayon', position: ADRESSE, rayonKm: 0 },
            { agenceId: 'montreuil', position: MONTREUIL, rayonKm: 10 },
          ],
        }),
      ],
      ADRESSE,
      P,
    );
    expect(retenus[0]?.agenceId).toBe('montreuil');
  });
});

describe('planifieCascadePartagee', () => {
  const EXCLUSIF = retenu({
    entrepriseId: 'plomberie-martin',
    formule: 'exclusif',
    titulaireExclusivite: true,
    score: 0.92,
    distanceKm: 1.2,
  });
  const PREMIUM_A = retenu({
    entrepriseId: 'dupont-plomberie',
    formule: 'premium',
    score: 0.88,
    distanceKm: 2.1,
    demandesAccepteesCeMois: 4,
  });
  const PREMIUM_B = retenu({
    entrepriseId: 'atelier-roche',
    formule: 'premium',
    score: 0.84,
    distanceKm: 3.4,
    demandesAccepteesCeMois: 1,
  });
  const ESSENTIEL = retenu({
    entrepriseId: 'sos-fuite-11',
    formule: 'essentiel',
    score: 0.79,
    distanceKm: 1.8,
  });
  const GRATUIT = retenu({
    entrepriseId: 'plomb-art-11',
    formule: 'gratuit',
    score: 0.74,
    distanceKm: 0.9,
  });

  it('donne la demande à l’Exclusif seul pendant 30 minutes', () => {
    const cascade = planifieCascadePartagee([EXCLUSIF, PREMIUM_A, PREMIUM_B], P);
    expect(cascade[0]).toMatchObject({
      entrepriseId: 'plomberie-martin',
      rang: 1,
      tour: 1,
      raisonRang: 'exclusif-de-la-zone',
      minutesApresDepot: 0,
      minutesPourRepondre: 30,
    });
    // Personne d'autre avant la 30e minute.
    expect(cascade.filter((e) => e.minutesApresDepot === 0)).toHaveLength(1);
    expect(cascade[1]?.minutesApresDepot).toBe(30);
  });

  it('sert d’abord le Premium qui a reçu le moins de demandes par rapport à son forfait', () => {
    const cascade = planifieCascadePartagee([EXCLUSIF, PREMIUM_A, PREMIUM_B], P);
    const premium = cascade.filter((e) => e.tour === 2);
    // Atelier Roche a consommé 1/5 de son forfait, Dupont 4/5 : l'équité passe avant le score.
    expect(premium[0]?.entrepriseId).toBe('atelier-roche');
    expect(premium[1]?.entrepriseId).toBe('dupont-plomberie');
    expect(premium.every((e) => e.raisonRang === 'premium-le-moins-servi')).toBe(true);
  });

  it('tranche par la distance quand deux Premium ont consommé la même part', () => {
    const a = retenu({
      entrepriseId: 'proche',
      formule: 'premium',
      score: 0.5,
      distanceKm: 1,
      demandesAccepteesCeMois: 2,
    });
    const b = retenu({
      entrepriseId: 'loin',
      formule: 'premium',
      score: 0.99,
      distanceKm: 9,
      demandesAccepteesCeMois: 2,
    });
    const cascade = planifieCascadePartagee([a, b], P);
    expect(cascade[0]?.entrepriseId).toBe('proche');
  });

  it('fait partir les Premium tout de suite s’il n’y a pas d’Exclusif sur la zone', () => {
    const cascade = planifieCascadePartagee([PREMIUM_A, PREMIUM_B], P);
    expect(cascade.every((e) => e.minutesApresDepot === 0)).toBe(true);
    expect(cascade).toHaveLength(2);
  });

  it('ne sollicite jamais plus de 3 pros', () => {
    const cascade = planifieCascadePartagee(
      [EXCLUSIF, PREMIUM_A, PREMIUM_B, ESSENTIEL, GRATUIT],
      P,
    );
    expect(cascade).toHaveLength(3);
    expect(cascade.map((e) => e.entrepriseId)).toEqual([
      'plomberie-martin',
      'atelier-roche',
      'dupont-plomberie',
    ]);
  });

  it('laisse les places restantes aux Essentiel et Gratuit, à 60 % qualité et 40 % proximité', () => {
    const cascade = planifieCascadePartagee([ESSENTIEL, GRATUIT], P);
    expect(cascade).toHaveLength(2);
    expect(cascade.every((e) => e.tour === 3)).toBe(true);
    expect(cascade.every((e) => e.raisonRang === 'score-et-proximite')).toBe(true);
    // SOS Fuite a un meilleur score (0,79 contre 0,74) mais Plomb'Art est plus proche :
    // la note mixte tranche, et elle est calculable à la main.
    expect(cascade[0]?.entrepriseId).toBe(
      noteMixte(ESSENTIEL, P) >= noteMixte(GRATUIT, P) ? 'sos-fuite-11' : 'plomb-art-11',
    );
  });

  it('traite un Exclusif hors de sa zone d’exclusivité comme les autres', () => {
    const exclusifAilleurs = retenu({
      entrepriseId: 'exclusif-ailleurs',
      formule: 'exclusif',
      titulaireExclusivite: false,
      score: 0.9,
    });
    const cascade = planifieCascadePartagee([exclusifAilleurs, PREMIUM_B], P);
    expect(cascade[0]?.entrepriseId).toBe('atelier-roche');
    expect(cascade[0]?.tour).toBe(2);
    expect(cascade[1]?.entrepriseId).toBe('exclusif-ailleurs');
    expect(cascade[1]?.tour).toBe(3);
  });

  it('numérote les rangs sans trou et laisse 2 heures aux pros non exclusifs', () => {
    const cascade = planifieCascadePartagee([EXCLUSIF, PREMIUM_A, ESSENTIEL], P);
    expect(cascade.map((e) => e.rang)).toEqual([1, 2, 3]);
    expect(cascade[1]?.minutesPourRepondre).toBe(120);
    expect(cascade[2]?.minutesPourRepondre).toBe(120);
  });

  it('ne rend aucune étape sans pro éligible', () => {
    expect(planifieCascadePartagee([], P)).toEqual([]);
  });
});

describe('planifieCascadeUrgente', () => {
  const EXCLUSIF = retenu({
    entrepriseId: 'exclusif',
    formule: 'exclusif',
    titulaireExclusivite: true,
    distanceKm: 3,
  });
  const PREMIUM = retenu({ entrepriseId: 'premium', formule: 'premium', distanceKm: 1 });
  const ESSENTIEL = retenu({ entrepriseId: 'essentiel', formule: 'essentiel', distanceKm: 2 });
  const GRATUIT = retenu({ entrepriseId: 'gratuit', formule: 'gratuit', distanceKm: 0.5 });

  it('alerte l’Exclusif et les Premium en même temps, avec 5 minutes d’avance', () => {
    const cascade = planifieCascadeUrgente([EXCLUSIF, PREMIUM, ESSENTIEL], P);
    const immediats = cascade.filter((e) => e.minutesApresDepot === 0).map((e) => e.entrepriseId);
    expect(immediats).toEqual(['premium', 'exclusif']); // le plus proche d'abord
    expect(cascade.find((e) => e.entrepriseId === 'essentiel')?.minutesApresDepot).toBe(5);
  });

  it('n’alerte jamais une fiche gratuite, qui n’a pas accès aux urgences', () => {
    const cascade = planifieCascadeUrgente([PREMIUM, GRATUIT], P);
    expect(cascade.map((e) => e.entrepriseId)).not.toContain('gratuit');
  });

  it('alerte tout le monde en même temps s’il n’y a aucun abonné prioritaire', () => {
    const cascade = planifieCascadeUrgente([ESSENTIEL], P);
    expect(cascade[0]?.minutesApresDepot).toBe(5);
  });

  it('laisse 10 minutes avant l’alerte à l’administrateur', () => {
    const cascade = planifieCascadeUrgente([PREMIUM], P);
    expect(cascade[0]?.minutesPourRepondre).toBe(10);
  });
});

describe('état d’une demande', () => {
  function etat(partiel: Partial<EtatDistribution> = {}): EtatDistribution {
    return {
      objectif: 3,
      acceptes: [],
      refus: [],
      expires: [],
      enCours: [],
      heuresDepuisDepot: 1,
      ...partiel,
    };
  }

  it('fixe l’objectif à 3 pros pour une partagée, 1 sinon', () => {
    expect(objectifPros('partagee', P)).toBe(3);
    expect(objectifPros('urgente', P)).toBe(1);
    expect(objectifPros('directe', P)).toBe(1);
  });

  it('est complète quand l’objectif est atteint', () => {
    expect(demandeComplete(etat({ acceptes: ['a', 'b'] }))).toBe(false);
    expect(demandeComplete(etat({ acceptes: ['a', 'b', 'c'] }))).toBe(true);
    expect(demandeComplete(etat({ objectif: 1, acceptes: ['a'] }))).toBe(true);
  });

  it('est périmée au bout de 72 heures', () => {
    expect(demandePerimee(etat({ heuresDepuisDepot: 71.9 }), P)).toBe(false);
    expect(demandePerimee(etat({ heuresDepuisDepot: 72 }), P)).toBe(true);
  });

  it('compte chaque pro sollicité une seule fois', () => {
    expect(
      solliciter(
        etat({
          acceptes: ['a'],
          refus: [{ entrepriseId: 'b', motif: 'indisponible' }],
          expires: ['c'],
          enCours: ['a'],
        }),
      ),
    ).toBe(3);
  });

  it('ne distribue plus au-delà de 3 pros sollicités, même si personne n’a accepté', () => {
    const trois = etat({
      refus: [
        { entrepriseId: 'a', motif: 'indisponible' },
        { entrepriseId: 'b', motif: 'trop-loin' },
      ],
      expires: ['c'],
    });
    expect(peutEncoreDistribuer(trois, P)).toBe(false);
    expect(statutDemande(trois, P)).toBe('sans-preneur');
  });

  it('ne distribue plus une demande périmée, complète, en pause ou suspecte', () => {
    expect(peutEncoreDistribuer(etat({ heuresDepuisDepot: 80 }), P)).toBe(false);
    expect(peutEncoreDistribuer(etat({ acceptes: ['a', 'b', 'c'] }), P)).toBe(false);
    expect(peutEncoreDistribuer(etat({ enPause: true }), P)).toBe(false);
    expect(peutEncoreDistribuer(etat({ suspecte: true }), P)).toBe(false);
  });

  it('distribue encore une demande fraîche et incomplète', () => {
    expect(peutEncoreDistribuer(etat({ acceptes: ['a'] }), P)).toBe(true);
  });

  it('nomme le statut affiché dans le centre de distribution', () => {
    expect(statutDemande(etat({ suspecte: true }), P)).toBe('suspecte');
    expect(statutDemande(etat({ enPause: true }), P)).toBe('en-pause');
    expect(statutDemande(etat({ acceptes: ['a', 'b', 'c'] }), P)).toBe('complete');
    expect(statutDemande(etat({ enCours: ['a'] }), P)).toBe('en-distribution');
    expect(statutDemande(etat(), P)).toBe('en-attente-de-relance');
    expect(statutDemande(etat({ refus: [{ entrepriseId: 'a', motif: 'trop-loin' }] }), P)).toBe(
      'en-attente-de-relance',
    );
  });
});

describe('peutEtreRePropose', () => {
  it('ne re-propose jamais après un « pas mon métier »', () => {
    expect(peutEtreRePropose('pas-mon-metier', false, false)).toBe(false);
    expect(peutEtreRePropose('pas-mon-metier', false, true)).toBe(false);
  });

  it('re-propose automatiquement un refus « indisponible »', () => {
    expect(peutEtreRePropose('indisponible', false, false)).toBe(true);
  });

  it('ne re-propose pas automatiquement « trop loin » ou « budget trop bas »', () => {
    expect(peutEtreRePropose('trop-loin', false, false)).toBe(false);
    expect(peutEtreRePropose('budget-trop-bas', false, false)).toBe(false);
  });

  it('laisse l’administrateur forcer les autres motifs', () => {
    expect(peutEtreRePropose('trop-loin', false, true)).toBe(true);
    expect(peutEtreRePropose('budget-trop-bas', false, true)).toBe(true);
  });

  it('ne re-propose jamais deux fois la même demande au même pro', () => {
    for (const motif of ['indisponible', 'trop-loin', 'budget-trop-bas'] as const) {
      expect(peutEtreRePropose(motif, true, false)).toBe(false);
      expect(peutEtreRePropose(motif, true, true)).toBe(false);
    }
  });

  it('propose un libellé pour chaque motif de refus', () => {
    expect(Object.keys(MOTIFS_REFUS)).toEqual([
      'indisponible',
      'trop-loin',
      'pas-mon-metier',
      'budget-trop-bas',
    ]);
    for (const libelle of Object.values(MOTIFS_REFUS)) {
      expect(libelle.length).toBeGreaterThan(5);
    }
  });
});

describe('rayonElargi', () => {
  it('élargit les rayons de 50 % quand personne n’accepte', () => {
    expect(rayonElargi(10, P)).toBe(15);
    expect(rayonElargi(4, avecParametres({ facteurElargissementRayon: 2 }))).toBe(8);
  });
});
