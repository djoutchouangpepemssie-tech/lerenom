import { describe, expect, it } from 'vitest';
import {
  ETAPE,
  LONGUEUR_DESCRIPTION_MAXIMALE,
  LONGUEUR_DESCRIPTION_MINIMALE,
  engagementInscription,
  slugEntreprise,
  slugifie,
  valideInscription,
  type SaisieInscription,
} from './inscription.ts';

/** Un SIRET dont la clé de Luhn est juste, pour que les tests portent sur le reste. */
const SIRET = '73282932000074';

const VALIDE: SaisieInscription = {
  siret: SIRET,
  nomEntreprise: 'Dupont Plomberie',
  email: 'contact@dupont-plomberie.fr',
  telephone: '01 99 00 00 12',
  motDePasse: 'le chat dort sur le toit',
  motDePasseConfirme: 'le chat dort sur le toit',
  metiers: ['plombier', 'chauffagiste'],
  metierPrincipal: 'plombier',
  villes: ['75111', '75112'],
  communeSiege: '75111',
  description:
    'Entreprise familiale installée dans le 11e depuis 1998. Recherche de fuite, dépannage d’urgence et rénovation de salle de bain.',
  formule: 'essentiel',
  annuel: false,
};

function avec(modifications: Partial<SaisieInscription>): SaisieInscription {
  return { ...VALIDE, ...modifications };
}

function champs(saisie: SaisieInscription): readonly string[] {
  return valideInscription(saisie).map((probleme) => probleme.champ);
}

describe('slugifie', () => {
  it('retire les accents et met en minuscules', () => {
    expect(slugifie('Électricité Générale')).toBe('electricite-generale');
  });

  it('traite l’apostrophe comme une coupure, pas comme un caractère à supprimer', () => {
    // « L'Atelier » doit donner « l-atelier » et non « latelier » : la seconde forme est
    // illisible dans une URL et imprévisible pour quelqu'un qui la tape.
    expect(slugifie('L’Atelier du Bois')).toBe('l-atelier-du-bois');
  });

  it('ne laisse jamais de tiret en tête ni en queue', () => {
    expect(slugifie('  — Plomberie ! — ')).toBe('plomberie');
  });

  it('rend une chaîne vide quand il ne reste rien de slugifiable', () => {
    expect(slugifie('!!!')).toBe('');
  });
});

describe('slugEntreprise', () => {
  it('accole le suffixe au nom', () => {
    expect(slugEntreprise('Dupont Plomberie', SIRET)).toBe(`dupont-plomberie-${SIRET}`);
  });

  it('distingue deux entreprises de même nom', () => {
    // C'est la raison d'être du suffixe : « Dupont Plomberie » n'est pas un nom unique, et une
    // adresse de fiche ne doit jamais désigner deux sociétés.
    expect(slugEntreprise('Dupont Plomberie', '73282932000074')).not.toBe(
      slugEntreprise('Dupont Plomberie', '73282932000082'),
    );
  });

  it('tient debout quand le nom ne donne aucun slug', () => {
    expect(slugEntreprise('???', SIRET)).toBe(SIRET);
  });

  it('ne rend jamais une chaîne vide', () => {
    expect(slugEntreprise('???', '')).toBe('entreprise');
  });
});

describe('valideInscription', () => {
  it('accepte une inscription complète', () => {
    expect(valideInscription(VALIDE)).toEqual([]);
  });

  it('refuse un SIRET dont la clé est fausse', () => {
    expect(champs(avec({ siret: '73282932000075' }))).toContain('siret');
  });

  it('relève tous les problèmes d’un coup, pas le premier', () => {
    // C'est l'exigence qui justifie ce module : un formulaire de huit étapes qui refuse une
    // chose à la fois est une épreuve.
    const problemes = valideInscription(
      avec({
        siret: 'x',
        nomEntreprise: '',
        email: 'pas-une-adresse',
        villes: [],
        communeSiege: null,
      }),
    );
    expect(problemes.length).toBeGreaterThanOrEqual(4);
    expect(new Set(problemes.map((p) => p.champ))).toEqual(
      new Set(['siret', 'nomEntreprise', 'email', 'villes']),
    );
  });

  it('rattache chaque problème à l’étape où le corriger', () => {
    const problemes = valideInscription(avec({ siret: 'x', villes: [], communeSiege: null }));
    expect(problemes.find((p) => p.champ === 'siret')?.etape).toBe(ETAPE.entreprise);
    expect(problemes.find((p) => p.champ === 'villes')?.etape).toBe(ETAPE.villes);
  });

  describe('identité', () => {
    it('refuse une adresse sans domaine', () => {
      expect(champs(avec({ email: 'contact@dupont' }))).toContain('email');
    });

    it('accepte une adresse avec un sous-domaine', () => {
      expect(champs(avec({ email: 'devis@mail.dupont-plomberie.fr' }))).not.toContain('email');
    });

    it('refuse un téléphone trop court', () => {
      expect(champs(avec({ telephone: '01 99 00' }))).toContain('telephone');
    });

    it('accepte un téléphone écrit au format international', () => {
      expect(champs(avec({ telephone: '+33 1 99 00 00 12' }))).not.toContain('telephone');
    });
  });

  describe('mot de passe', () => {
    it('refuse un mot de passe trop court', () => {
      expect(champs(avec({ motDePasse: 'court', motDePasseConfirme: 'court' }))).toContain(
        'motDePasse',
      );
    });

    it('refuse deux saisies différentes', () => {
      expect(champs(avec({ motDePasseConfirme: 'le chien dort sur le toit' }))).toContain(
        'motDePasseConfirme',
      );
    });

    it('refuse un mot de passe qui contient l’adresse électronique', () => {
      expect(
        champs(
          avec({
            email: 'dupontplomberie@exemple.fr',
            motDePasse: 'dupontplomberie2026',
            motDePasseConfirme: 'dupontplomberie2026',
          }),
        ),
      ).toContain('motDePasse');
    });

    it('accepte une phrase de passe longue sans chiffre ni majuscule', () => {
      // La longueur prime sur la complexité : c'est la recommandation CNIL, et elle est déjà
      // le parti pris de `mot-de-passe.ts`. Ce test garde l'inscription alignée dessus.
      const phrase = 'la pluie tombe sur les toits de zinc';
      expect(champs(avec({ motDePasse: phrase, motDePasseConfirme: phrase }))).not.toContain(
        'motDePasse',
      );
    });
  });

  describe('métiers', () => {
    it('exige au moins un métier', () => {
      expect(champs(avec({ metiers: [], metierPrincipal: null }))).toContain('metiers');
    });

    it('exige un métier principal', () => {
      expect(champs(avec({ metierPrincipal: null }))).toContain('metierPrincipal');
    });

    it('refuse un métier principal absent des métiers choisis', () => {
      expect(champs(avec({ metierPrincipal: 'serrurier' }))).toContain('metierPrincipal');
    });

    it('refuse un doublon', () => {
      expect(champs(avec({ metiers: ['plombier', 'plombier'] }))).toContain('metiers');
    });
  });

  describe('villes', () => {
    it('exige au moins une ville', () => {
      expect(champs(avec({ villes: [], communeSiege: null }))).toContain('villes');
    });

    it('refuse un siège hors des villes d’intervention', () => {
      expect(champs(avec({ communeSiege: '92012' }))).toContain('communeSiege');
    });

    it('accepte l’absence de siège déclaré', () => {
      // Le siège sert à départager les villes retirées quand la formule en autorise moins. Ne
      // pas le déclarer est permis ; déclarer une ville où l'on n'intervient pas ne l'est pas.
      expect(champs(avec({ communeSiege: null }))).not.toContain('communeSiege');
    });

    it('n’impose aucun plafond de villes : la formule les ajuste, elle ne les refuse pas', () => {
      // Deux villes au-delà du plafond « gratuit » ne sont pas une erreur de saisie : elles
      // sont retirées par `ajusteZonesPourFormule`, et le professionnel l'a vu avant de valider.
      const villes = ['75111', '75112', '75113', '75114'];
      expect(champs(avec({ formule: 'gratuit', villes, communeSiege: '75111' }))).not.toContain(
        'villes',
      );
    });
  });

  describe('fiche', () => {
    it('refuse une présentation trop courte', () => {
      expect(champs(avec({ description: 'Plombier.' }))).toContain('description');
    });

    it('accepte une présentation juste à la limite', () => {
      expect(
        champs(avec({ description: 'a'.repeat(LONGUEUR_DESCRIPTION_MINIMALE) })),
      ).not.toContain('description');
    });

    it('refuse une présentation trop longue', () => {
      expect(
        champs(avec({ description: 'a'.repeat(LONGUEUR_DESCRIPTION_MAXIMALE + 1) })),
      ).toContain('description');
    });

    it('ne compte pas les espaces de bordure dans la longueur', () => {
      const description = `   ${'a'.repeat(LONGUEUR_DESCRIPTION_MINIMALE - 1)}   `;
      expect(champs(avec({ description }))).toContain('description');
    });
  });

  it('refuse une formule inexistante', () => {
    expect(
      champs(avec({ formule: 'platine' as unknown as SaisieInscription['formule'] })),
    ).toContain('formule');
  });
});

describe('engagementInscription', () => {
  it('n’exige aucun paiement pour la fiche gratuite', () => {
    const engagement = engagementInscription('gratuit', false);
    expect(engagement.prixHT).toBe(0);
    expect(engagement.paiementRequis).toBe(false);
  });

  it('facture dix mois sur un an', () => {
    const mensuel = engagementInscription('essentiel', false).prixHT;
    expect(engagementInscription('essentiel', true).prixHT).toBe(mensuel * 10);
  });

  it('porte l’engagement de douze mois de la formule exclusive', () => {
    expect(engagementInscription('exclusif', false).moisEngagement).toBe(12);
  });

  it('n’engage pas les formules sans durée', () => {
    expect(engagementInscription('premium', false).moisEngagement).toBe(0);
  });
});
