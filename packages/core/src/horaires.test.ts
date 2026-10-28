import { describe, expect, it } from 'vitest';
import {
  JOURS,
  creneauLisible,
  estOuvert,
  fermetureEnCours,
  heureLisible,
  heuresProposees,
  horairesDepuisJson,
  horairesRenseignes,
  minutesDepuisTexte,
  normaliseHoraires,
  prochaineOuverture,
  problemesHoraires,
  semaineFermee,
  texteDepuisMinutes,
  type Horaires,
} from './horaires.ts';

/** Une semaine d'artisan : pause du midi, samedi matin, dimanche fermé. */
function semaineOrdinaire(): Horaires {
  return {
    lundi: [
      { debut: 8 * 60, fin: 12 * 60 },
      { debut: 14 * 60, fin: 18 * 60 },
    ],
    mardi: [
      { debut: 8 * 60, fin: 12 * 60 },
      { debut: 14 * 60, fin: 18 * 60 },
    ],
    mercredi: [
      { debut: 8 * 60, fin: 12 * 60 },
      { debut: 14 * 60, fin: 18 * 60 },
    ],
    jeudi: [
      { debut: 8 * 60, fin: 12 * 60 },
      { debut: 14 * 60, fin: 18 * 60 },
    ],
    vendredi: [{ debut: 8 * 60, fin: 17 * 60 }],
    samedi: [{ debut: 9 * 60, fin: 13 * 60 }],
    dimanche: [],
  };
}

describe('conversion', () => {
  it('lit une heure écrite', () => {
    expect(minutesDepuisTexte('08:30')).toBe(510);
    expect(minutesDepuisTexte('0:05')).toBe(5);
    expect(minutesDepuisTexte('23:59')).toBe(1439);
  });

  it('refuse ce qui n’est pas une heure', () => {
    expect(minutesDepuisTexte('')).toBeNull();
    expect(minutesDepuisTexte('8h30')).toBeNull();
    expect(minutesDepuisTexte('24:00')).toBeNull();
    expect(minutesDepuisTexte('12:60')).toBeNull();
  });

  it('fait l’aller-retour sans rien perdre', () => {
    for (const minutes of [0, 5, 510, 720, 1439]) {
      expect(minutesDepuisTexte(texteDepuisMinutes(minutes))).toBe(minutes);
    }
  });

  it('écrit l’heure à la française', () => {
    // « 14 h » et non « 14 h 00 » : c'est la typographie française, et c'est ce qui se lit.
    expect(heureLisible(14 * 60)).toBe('14 h');
    expect(heureLisible(8 * 60 + 30)).toBe('8 h 30');
    expect(heureLisible(9 * 60 + 5)).toBe('9 h 05');
  });

  it('écrit un créneau avec un tiret cadratin', () => {
    expect(creneauLisible({ debut: 8 * 60, fin: 12 * 60 + 30 })).toBe('8 h – 12 h 30');
  });
});

describe('heuresProposees', () => {
  it('propose le quart d’heure, de minuit à minuit', () => {
    const heures = heuresProposees();
    expect(heures[0]).toBe(0);
    expect(heures.at(-1)).toBe(24 * 60);
    expect(heures).toHaveLength(24 * 4 + 1);
  });

  it('ajoute une valeur qui ne tombe pas sur le pas, sans la déplacer', () => {
    // Une fiche enregistrée autrefois à 8 h 05 ne doit pas voir son horaire changer au seul
    // motif qu'on rouvre l'écran.
    const heures = heuresProposees(8 * 60 + 5);
    expect(heures).toContain(8 * 60 + 5);
    expect(heures.indexOf(8 * 60 + 5)).toBe(heures.indexOf(8 * 60) + 1);
  });

  it('n’ajoute rien quand la valeur tombe déjà sur le pas', () => {
    expect(heuresProposees(8 * 60)).toHaveLength(heuresProposees().length);
  });
});

describe('problemesHoraires', () => {
  it('accepte une semaine ordinaire', () => {
    expect(problemesHoraires(semaineOrdinaire())).toEqual([]);
  });

  it('accepte une semaine entièrement fermée', () => {
    expect(problemesHoraires(semaineFermee())).toEqual([]);
  });

  it('refuse une fermeture avant l’ouverture', () => {
    const horaires = { ...semaineFermee(), lundi: [{ debut: 18 * 60, fin: 8 * 60 }] };
    expect(problemesHoraires(horaires)).toHaveLength(1);
    expect(problemesHoraires(horaires)[0]?.jour).toBe('lundi');
  });

  it('refuse une plage de durée nulle', () => {
    const horaires = { ...semaineFermee(), mardi: [{ debut: 600, fin: 600 }] };
    expect(problemesHoraires(horaires)).toHaveLength(1);
  });

  it('refuse deux plages qui se chevauchent', () => {
    const horaires = {
      ...semaineFermee(),
      mercredi: [
        { debut: 8 * 60, fin: 13 * 60 },
        { debut: 12 * 60, fin: 18 * 60 },
      ],
    };
    expect(problemesHoraires(horaires)[0]?.message).toContain('chevauchent');
  });

  it('accepte deux plages qui se touchent sans se chevaucher', () => {
    const horaires = {
      ...semaineFermee(),
      jeudi: [
        { debut: 8 * 60, fin: 12 * 60 },
        { debut: 12 * 60, fin: 18 * 60 },
      ],
    };
    expect(problemesHoraires(horaires)).toEqual([]);
  });

  it('n’a rien à redire d’un horaire inhabituel', () => {
    // Ouvrir le dimanche à 5 h n'est pas une erreur : c'est le métier de certains. On relève
    // ce qui est impossible, pas ce qui surprend.
    const horaires = { ...semaineFermee(), dimanche: [{ debut: 5 * 60, fin: 7 * 60 }] };
    expect(problemesHoraires(horaires)).toEqual([]);
  });
});

describe('normaliseHoraires', () => {
  it('range les créneaux dans l’ordre', () => {
    const horaires = {
      ...semaineFermee(),
      lundi: [
        { debut: 14 * 60, fin: 18 * 60 },
        { debut: 8 * 60, fin: 12 * 60 },
      ],
    };
    expect(normaliseHoraires(horaires).lundi.map((c) => c.debut)).toEqual([8 * 60, 14 * 60]);
  });

  it('fusionne deux plages qui se touchent', () => {
    // Saisies séparément, « 8 h – 12 h » et « 12 h – 18 h » décrivent une journée continue :
    // les garder distinctes afficherait une pause qui n'existe pas.
    const horaires = {
      ...semaineFermee(),
      lundi: [
        { debut: 8 * 60, fin: 12 * 60 },
        { debut: 12 * 60, fin: 18 * 60 },
      ],
    };
    expect(normaliseHoraires(horaires).lundi).toEqual([{ debut: 8 * 60, fin: 18 * 60 }]);
  });

  it('écarte une plage de durée nulle', () => {
    const horaires = { ...semaineFermee(), lundi: [{ debut: 600, fin: 600 }] };
    expect(normaliseHoraires(horaires).lundi).toEqual([]);
  });

  it('garde la pause du midi', () => {
    expect(normaliseHoraires(semaineOrdinaire()).lundi).toHaveLength(2);
  });

  it('n’invente aucun jour', () => {
    const normalisee = normaliseHoraires(semaineFermee());
    expect(Object.keys(normalisee).toSorted()).toEqual([...JOURS].toSorted());
  });
});

describe('estOuvert', () => {
  const horaires = semaineOrdinaire();

  it('dit ouvert pendant un créneau', () => {
    expect(estOuvert(horaires, 'lundi', 10 * 60)).toBe(true);
    expect(estOuvert(horaires, 'lundi', 15 * 60)).toBe(true);
  });

  it('dit fermé pendant la pause du midi', () => {
    expect(estOuvert(horaires, 'lundi', 13 * 60)).toBe(false);
  });

  it('dit fermé un jour sans créneau', () => {
    expect(estOuvert(horaires, 'dimanche', 10 * 60)).toBe(false);
  });

  it('ouvre à l’heure pile et ferme à l’heure pile', () => {
    // Une borne mal choisie fait dire « ouvert » à 18 h à une entreprise qui ferme à 18 h.
    expect(estOuvert(horaires, 'lundi', 8 * 60)).toBe(true);
    expect(estOuvert(horaires, 'lundi', 12 * 60)).toBe(false);
  });
});

describe('fermetureEnCours', () => {
  it('rend l’heure de fermeture du créneau en cours', () => {
    expect(fermetureEnCours(semaineOrdinaire(), 'lundi', 10 * 60)).toBe(12 * 60);
  });

  it('rend null quand c’est fermé', () => {
    expect(fermetureEnCours(semaineOrdinaire(), 'lundi', 13 * 60)).toBeNull();
  });
});

describe('prochaineOuverture', () => {
  const horaires = semaineOrdinaire();

  it('trouve le créneau de l’après-midi depuis la pause', () => {
    expect(prochaineOuverture(horaires, 'lundi', 13 * 60)).toEqual({
      jour: 'lundi',
      minutes: 14 * 60,
      dansNJours: 0,
    });
  });

  it('passe au lendemain après la fermeture', () => {
    expect(prochaineOuverture(horaires, 'lundi', 20 * 60)).toEqual({
      jour: 'mardi',
      minutes: 8 * 60,
      dansNJours: 1,
    });
  });

  it('saute le dimanche fermé pour retomber sur le lundi', () => {
    expect(prochaineOuverture(horaires, 'dimanche', 10 * 60)).toEqual({
      jour: 'lundi',
      minutes: 8 * 60,
      dansNJours: 1,
    });
  });

  it('fait le tour complet depuis un samedi soir', () => {
    expect(prochaineOuverture(horaires, 'samedi', 20 * 60)?.jour).toBe('lundi');
    expect(prochaineOuverture(horaires, 'samedi', 20 * 60)?.dansNJours).toBe(2);
  });

  it('ne compte pas un créneau déjà commencé comme « prochain »', () => {
    expect(prochaineOuverture(horaires, 'lundi', 9 * 60)?.minutes).toBe(14 * 60);
  });

  it('rend null quand la semaine est fermée : mieux vaut se taire qu’annoncer rien', () => {
    expect(prochaineOuverture(semaineFermee(), 'lundi', 10 * 60)).toBeNull();
  });
});

describe('horairesRenseignes', () => {
  it('distingue une semaine remplie d’une semaine vide', () => {
    expect(horairesRenseignes(semaineOrdinaire())).toBe(true);
    expect(horairesRenseignes(semaineFermee())).toBe(false);
  });
});

describe('horairesDepuisJson', () => {
  it('relit ce qu’il a écrit', () => {
    const semaine = semaineOrdinaire();
    expect(horairesDepuisJson(JSON.parse(JSON.stringify(semaine)))).toEqual(semaine);
  });

  it('refuse ce qui n’est pas un objet', () => {
    expect(horairesDepuisJson(null)).toBeNull();
    expect(horairesDepuisJson('lundi')).toBeNull();
    expect(horairesDepuisJson([])).toBeNull();
  });

  it('refuse un créneau mal formé', () => {
    // La base garde un JSON libre : s'y fier sans vérifier reviendrait à faire confiance à une
    // version du code qui n'existe pas encore.
    expect(horairesDepuisJson({ lundi: [{ debut: '8h' }] })).toBeNull();
    expect(horairesDepuisJson({ lundi: 'toute la journée' })).toBeNull();
    expect(horairesDepuisJson({ lundi: [{ debut: 0, fin: Number.NaN }] })).toBeNull();
  });

  it('complète les jours absents par une fermeture', () => {
    const lues = horairesDepuisJson({ lundi: [{ debut: 540, fin: 1020 }] });
    expect(lues?.dimanche).toEqual([]);
    expect(lues?.lundi).toEqual([{ debut: 540, fin: 1020 }]);
  });

  it('ignore une clé qui n’est pas un jour', () => {
    const lues = horairesDepuisJson({ lundi: [{ debut: 540, fin: 1020 }], mardredi: 'x' });
    expect(lues).not.toBeNull();
    expect(Object.keys(lues ?? {}).toSorted()).toEqual([...JOURS].toSorted());
  });
});
