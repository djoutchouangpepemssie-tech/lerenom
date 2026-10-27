import { describe, expect, it } from 'vitest';
import {
  classePageResultats,
  droitEmplacementPaye,
  expliqueRang,
  partAffichage,
  rotationEquitable,
} from './classement.js';
import type { CandidatClassement } from './classement.js';
import { PARAMETRES_PAR_DEFAUT, avecParametres } from './parametres.js';

const P = PARAMETRES_PAR_DEFAUT;

/** Les 7 plombiers de référence de Paris 11e (cahier des charges §19). */
const PLOMBIERS_PARIS_11: readonly CandidatClassement[] = [
  {
    entrepriseId: 'plomberie-martin',
    formule: 'exclusif',
    score: 0.92,
    note: 4.9,
    titulaireExclusivite: true,
  },
  { entrepriseId: 'dupont-plomberie', formule: 'premium', score: 0.88, note: 4.8 },
  { entrepriseId: 'atelier-roche', formule: 'premium', score: 0.84, note: 4.7 },
  { entrepriseId: 'sos-fuite-11', formule: 'essentiel', score: 0.79, note: 4.6 },
  { entrepriseId: 'hydro-services', formule: 'essentiel', score: 0.71, note: 4.4 },
  { entrepriseId: 'plomb-art-11', formule: 'gratuit', score: 0.74, note: 4.5 },
  { entrepriseId: 'lefevre-sanitaire', formule: 'gratuit', score: 0.66, note: 4.3 },
];

describe('rotationEquitable', () => {
  it('rend tout le monde quand il y a assez de places', () => {
    expect(rotationEquitable(['a', 'b'], 2, 0)).toEqual(['a', 'b']);
    expect(rotationEquitable(['a'], 2, 0)).toEqual(['a']);
  });

  it('ne rend rien sans place ni sans candidat', () => {
    expect(rotationEquitable(['a', 'b'], 0, 0)).toEqual([]);
    expect(rotationEquitable([], 2, 0)).toEqual([]);
  });

  it('donne exactement 40 % des affichages à chacun : 5 Premium pour 2 places', () => {
    const premium = ['a', 'b', 'c', 'd', 'e'];
    const comptes = new Map<string, number>(premium.map((p) => [p, 0]));

    // Un cycle complet, puis vérification de l'égalité parfaite.
    for (let affichage = 0; affichage < 5; affichage += 1) {
      for (const gagnant of rotationEquitable(premium, 2, affichage)) {
        comptes.set(gagnant, (comptes.get(gagnant) ?? 0) + 1);
      }
    }

    for (const p of premium) {
      expect(comptes.get(p)).toBe(2); // 2 affichages sur 5 = 40 %
    }
  });

  it('reste équitable sur un grand nombre d’affichages avec 6 Premium', () => {
    const premium = ['a', 'b', 'c', 'd', 'e', 'f'];
    const comptes = new Map<string, number>(premium.map((p) => [p, 0]));

    for (let affichage = 0; affichage < 600; affichage += 1) {
      for (const gagnant of rotationEquitable(premium, 2, affichage)) {
        comptes.set(gagnant, (comptes.get(gagnant) ?? 0) + 1);
      }
    }

    // 6 Premium pour 2 places : un affichage sur trois chacun, soit 200 sur 600.
    for (const p of premium) {
      expect(comptes.get(p)).toBe(200);
    }
  });

  it('est déterministe : même compteur, même ordre', () => {
    const premium = ['a', 'b', 'c', 'd'];
    expect(rotationEquitable(premium, 2, 7)).toEqual(rotationEquitable(premium, 2, 7));
  });

  it('accepte un compteur négatif ou remis à zéro sans casser l’équité', () => {
    const premium = ['a', 'b', 'c'];
    expect(rotationEquitable(premium, 2, -1)).toHaveLength(2);
    expect(rotationEquitable(premium, 2, -1)).toEqual(rotationEquitable(premium, 2, 2));
  });
});

describe('partAffichage', () => {
  it('vaut 40 % pour 5 Premium sur 2 places', () => {
    expect(partAffichage(5, 2)).toBeCloseTo(0.4, 10);
  });

  it('plafonne à 100 % quand il y a plus de places que d’abonnés', () => {
    expect(partAffichage(1, 2)).toBe(1);
  });

  it('vaut 0 sans abonné ni place', () => {
    expect(partAffichage(0, 2)).toBe(0);
    expect(partAffichage(3, 0)).toBe(0);
  });
});

describe('droitEmplacementPaye', () => {
  it('retire l’emplacement payé sous la note minimale de 3,5', () => {
    expect(
      droitEmplacementPaye({ entrepriseId: 'x', formule: 'premium', score: 0.9, note: 3.4 }, P),
    ).toBe(false);
    expect(
      droitEmplacementPaye({ entrepriseId: 'x', formule: 'premium', score: 0.9, note: 3.5 }, P),
    ).toBe(true);
  });

  it('ne pénalise pas une entreprise qui n’a pas encore d’avis', () => {
    expect(
      droitEmplacementPaye({ entrepriseId: 'x', formule: 'premium', score: 0.5, note: null }, P),
    ).toBe(true);
  });
});

describe('classePageResultats', () => {
  it('place l’Exclusif premier, puis deux Premium, tous marqués Sponsorisé', () => {
    const page = classePageResultats(PLOMBIERS_PARIS_11, P, 0);
    const [un, deux, trois] = page.lignes;

    expect(un?.entrepriseId).toBe('plomberie-martin');
    expect(un?.raison).toBe('emplacement-exclusif');
    expect(deux?.raison).toBe('emplacement-premium');
    expect(trois?.raison).toBe('emplacement-premium');
    expect([un, deux, trois].every((l) => l?.sponsorise)).toBe(true);
    expect(page.dernierRangSponsorise).toBe(3);
  });

  it('ne dépasse jamais 3 emplacements payés', () => {
    const beaucoupDAbonnes: CandidatClassement[] = [
      ...PLOMBIERS_PARIS_11,
      { entrepriseId: 'premium-4', formule: 'premium', score: 0.83, note: 4.6 },
      { entrepriseId: 'premium-5', formule: 'premium', score: 0.82, note: 4.6 },
      { entrepriseId: 'premium-6', formule: 'premium', score: 0.81, note: 4.6 },
    ];
    const page = classePageResultats(beaucoupDAbonnes, P, 0);
    expect(page.lignes.filter((l) => l.sponsorise)).toHaveLength(3);
  });

  it('classe ensuite tout le monde par score, abonnés compris, sans doublon', () => {
    const page = classePageResultats(PLOMBIERS_PARIS_11, P, 0);
    const naturels = page.lignes.filter((l) => !l.sponsorise);

    // Aucune entreprise ne peut apparaître deux fois sur la page.
    const ids = page.lignes.map((l) => l.entrepriseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(PLOMBIERS_PARIS_11.length);

    // Le classement naturel est bien décroissant.
    const scores = naturels.map(
      (l) => PLOMBIERS_PARIS_11.find((c) => c.entrepriseId === l.entrepriseId)!.score,
    );
    expect([...scores]).toEqual([...scores].sort((a, b) => b - a));
  });

  it('retire de la liste naturelle le Premium déjà affiché en sponsorisé', () => {
    const page = classePageResultats(PLOMBIERS_PARIS_11, P, 0);
    const sponsorises = page.lignes.filter((l) => l.sponsorise).map((l) => l.entrepriseId);
    const naturels = page.lignes.filter((l) => !l.sponsorise).map((l) => l.entrepriseId);
    for (const id of sponsorises) {
      expect(naturels).not.toContain(id);
    }
  });

  it('fait remonter les Premium aux places 1 et 2 sans Exclusif (QUESTIONS.md Q2)', () => {
    const sansExclusif = PLOMBIERS_PARIS_11.filter((c) => c.formule !== 'exclusif');
    const page = classePageResultats(sansExclusif, P, 0);

    expect(page.lignes[0]?.raison).toBe('emplacement-premium');
    expect(page.lignes[1]?.raison).toBe('emplacement-premium');
    expect(page.dernierRangSponsorise).toBe(2);
  });

  it('laisse la place 1 vide si Arcel décide l’inverse', () => {
    const sansExclusif = PLOMBIERS_PARIS_11.filter((c) => c.formule !== 'exclusif');
    const page = classePageResultats(
      sansExclusif,
      avecParametres({ premiumRemontentSansExclusif: false }),
      0,
    );
    expect(page.lignes.filter((l) => l.sponsorise)).toHaveLength(0);
    expect(page.dernierRangSponsorise).toBe(0);
  });

  it('fait retomber un Premium mal noté dans le classement naturel, à son rang réel', () => {
    const malNote = PLOMBIERS_PARIS_11.map((c) =>
      c.entrepriseId === 'dupont-plomberie' ? { ...c, note: 3.1 } : c,
    );
    const page = classePageResultats(malNote, P, 0);
    const ligne = page.lignes.find((l) => l.entrepriseId === 'dupont-plomberie');

    expect(ligne?.sponsorise).toBe(false);
    expect(ligne?.raison).toBe('classement-naturel');
    // Sa place payée revient au Premium suivant.
    expect(page.lignes[1]?.entrepriseId).toBe('atelier-roche');
  });

  it('exclut un Exclusif mal noté de l’emplacement Exclusif', () => {
    const malNote = PLOMBIERS_PARIS_11.map((c) =>
      c.entrepriseId === 'plomberie-martin' ? { ...c, note: 2.9 } : c,
    );
    const page = classePageResultats(malNote, P, 0);
    expect(page.lignes[0]?.raison).toBe('emplacement-premium');
    const martin = page.lignes.find((l) => l.entrepriseId === 'plomberie-martin');
    expect(martin?.sponsorise).toBe(false);
  });

  it('n’attribue l’emplacement Exclusif qu’au titulaire de l’exclusivité de la zone', () => {
    // Un Exclusif hors de sa zone d'exclusivité est traité comme un Premium.
    const horsZone: CandidatClassement[] = [
      { entrepriseId: 'exclusif-ailleurs', formule: 'exclusif', score: 0.95, note: 4.9 },
      { entrepriseId: 'premium-local', formule: 'premium', score: 0.6, note: 4.5 },
    ];
    const page = classePageResultats(horsZone, P, 0);
    expect(page.lignes.find((l) => l.raison === 'emplacement-exclusif')).toBeUndefined();
    expect(page.lignes[0]?.entrepriseId).toBe('premium-local');
    expect(page.lignes[0]?.raison).toBe('emplacement-premium');
  });

  it('n’entre dans la rotation que les 6 premiers Premium : au-delà, liste d’attente', () => {
    const neufPremium: CandidatClassement[] = Array.from({ length: 9 }, (_, i) => ({
      entrepriseId: `premium-${String(i).padStart(2, '0')}`,
      formule: 'premium' as const,
      score: 0.9 - i * 0.01,
      note: 4.5,
    }));

    const vus = new Set<string>();
    for (let affichage = 0; affichage < 60; affichage += 1) {
      for (const ligne of classePageResultats(neufPremium, P, affichage).lignes) {
        if (ligne.sponsorise) vus.add(ligne.entrepriseId);
      }
    }
    expect(vus.size).toBe(P.premiumMaxParMetierVille);
  });

  it('annonce la part d’affichage de chaque emplacement, pour le rapport mensuel', () => {
    const cinqPremium: CandidatClassement[] = Array.from({ length: 5 }, (_, i) => ({
      entrepriseId: `premium-${i}`,
      formule: 'premium' as const,
      score: 0.8,
      note: 4.5,
    }));
    const page = classePageResultats(cinqPremium, P, 0);
    expect(page.lignes[0]?.partAffichage).toBeCloseTo(0.4, 10);
  });

  it('donne à l’Exclusif 100 % de son emplacement', () => {
    const page = classePageResultats(PLOMBIERS_PARIS_11, P, 0);
    expect(page.lignes[0]?.partAffichage).toBe(1);
  });

  it('numérote les rangs sans trou, de 1 à N', () => {
    const page = classePageResultats(PLOMBIERS_PARIS_11, P, 3);
    expect(page.lignes.map((l) => l.rang)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('reste stable à score égal : l’ordre ne change pas d’un affichage à l’autre', () => {
    const exAequo: CandidatClassement[] = [
      { entrepriseId: 'bbb', formule: 'gratuit', score: 0.5, note: 4 },
      { entrepriseId: 'aaa', formule: 'gratuit', score: 0.5, note: 4 },
    ];
    const premier = classePageResultats(exAequo, P, 0).lignes.map((l) => l.entrepriseId);
    const second = classePageResultats(exAequo, P, 99).lignes.map((l) => l.entrepriseId);
    expect(premier).toEqual(['aaa', 'bbb']);
    expect(premier).toEqual(second);
  });

  it('ne rend aucune ligne sur une page sans entreprise', () => {
    const page = classePageResultats([], P, 0);
    expect(page.lignes).toEqual([]);
    expect(page.dernierRangSponsorise).toBe(0);
  });
});

describe('expliqueRang', () => {
  it('dit qu’un emplacement payé ne dit rien de la qualité', () => {
    const texte = expliqueRang({
      entrepriseId: 'x',
      rang: 1,
      sponsorise: true,
      raison: 'emplacement-exclusif',
    });
    expect(texte.toLowerCase()).toContain('sponsorisé');
    expect(texte.toLowerCase()).toContain('qualité');
  });

  it('n’emploie jamais un mot qui promette la qualité d’un abonné', () => {
    const interdits = ['recommandé', 'meilleur', 'certifié'];
    for (const raison of ['emplacement-exclusif', 'emplacement-premium'] as const) {
      const texte = expliqueRang({
        entrepriseId: 'x',
        rang: 1,
        sponsorise: true,
        raison,
      }).toLowerCase();
      for (const mot of interdits) {
        expect(texte).not.toContain(mot);
      }
    }
  });

  it('explique le classement naturel par le score, sans le paiement', () => {
    const texte = expliqueRang({
      entrepriseId: 'x',
      rang: 4,
      sponsorise: false,
      raison: 'classement-naturel',
    });
    expect(texte).toContain('score de qualité');
    expect(texte).toContain('paiement');
  });
});
