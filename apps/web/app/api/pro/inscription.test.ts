/**
 * L'inscription d'un professionnel, de bout en bout.
 *
 * Ce que ce test protège, c'est ce qui manquait : **« Valider mon inscription » écrit en base**.
 * L'écran affichait un compteur et des félicitations ; aucun compte n'était créé.
 *
 * Il garde trois promesses qui ne se voient pas à l'écran :
 *
 *   * une fiche déjà présente dans l'annuaire est **reprise**, pas dupliquée. C'est le sens du
 *     titre de la page, « Créer ou revendiquer ma fiche » — et un doublon priverait
 *     l'entreprise de son ancienneté et de ses avis ;
 *   * rien n'est écrit **à moitié**. Une inscription refusée ne doit pas laisser derrière elle
 *     un SIRET pris sans compte pour l'ouvrir ;
 *   * les villes enregistrées sont celles que la formule autorise, **et ce sont celles que le
 *     professionnel a vues** avant de valider.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { verifieMotDePasse } from '@lerenom/securite';
import { POST as inscrit } from './inscription/route';

const MARQUE = 'test-inscription';
const MOT_DE_PASSE = 'la pluie tombe sur les toits';

/** Deux SIRET dont la clé de Luhn est juste : la validation porte sur le reste. */
const SIRET = '73282932000074';
const SIRET_DEJA_LA = '55208131766522';

let metiers: readonly { id: string; slug: string }[] = [];
let villes: readonly string[] = [];

const sessions = vi.hoisted(() => ({ ouvertes: [] as string[] }));

vi.mock('@/lib/session-pro', () => ({
  ouvreSession: (utilisateurId: string) => {
    sessions.ouvertes.push(utilisateurId);
    return Promise.resolve();
  },
  proConnecte: () => Promise.resolve(null),
  fermeSession: () => Promise.resolve(),
}));

function requete(corps: unknown): Request {
  return new Request('http://localhost/api/pro/inscription', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });
}

function saisie(modifications: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    siret: SIRET,
    nomEntreprise: `${MARQUE} Dupont Plomberie`,
    email: `gerant@${MARQUE}.test`,
    telephone: '01 99 00 00 12',
    motDePasse: MOT_DE_PASSE,
    motDePasseConfirme: MOT_DE_PASSE,
    metiers: metiers.map((m) => m.slug),
    metierPrincipal: metiers[0]?.slug ?? null,
    villes: [...villes],
    communeSiege: villes[0] ?? null,
    description:
      'Entreprise familiale installée en Île-de-France depuis 1998. Recherche de fuite, dépannage d’urgence et rénovation complète de salle de bain.',
    formule: 'premium',
    annuel: false,
    ...modifications,
  };
}

beforeAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);

  metiers = await prisma.metier.findMany({
    where: { slug: { in: ['plombier', 'chauffagiste'] } },
    select: { id: true, slug: true },
    orderBy: { slug: 'asc' },
  });
  expect(metiers.length).toBe(2);

  const communes = await prisma.commune.findMany({
    where: { statut: 'ouvert' },
    select: { code: true },
    orderBy: { code: 'asc' },
    take: 4,
  });
  villes = communes.map((c) => c.code);
  expect(villes.length).toBe(4);
});

beforeEach(async () => {
  sessions.ouvertes = [];
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.entreprise.deleteMany({ where: { siret: { in: [SIRET, SIRET_DEJA_LA] } } });
});

afterAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.entreprise.deleteMany({ where: { siret: { in: [SIRET, SIRET_DEJA_LA] } } });
  await prisma.$disconnect();
});

describe('création', () => {
  it('crée l’entreprise, le compte, la fiche, l’agence, les métiers, les zones et l’abonnement', async () => {
    const reponse = await inscrit(requete(saisie()));
    expect(reponse.status).toBe(201);

    const corps = (await reponse.json()) as { slug: string; revendiquee: boolean };
    expect(corps.revendiquee).toBe(false);

    const entreprise = await prisma.entreprise.findUniqueOrThrow({
      where: { siret: SIRET },
      include: {
        fiche: true,
        agences: true,
        metiers: true,
        zones: true,
        abonnements: true,
        utilisateurs: true,
      },
    });

    expect(entreprise.slug).toBe(corps.slug);
    expect(entreprise.revendiquee).toBe(true);
    // La vérification du numéro n'a pas eu lieu : la fiche existe, elle ne reçoit rien.
    expect(entreprise.verifiee).toBe(false);
    expect(entreprise.source).toBe('inscription');
    expect(entreprise.siren).toBe(SIRET.slice(0, 9));

    expect(entreprise.fiche?.description).toContain('Entreprise familiale');
    expect(entreprise.metiers).toHaveLength(2);
    expect(entreprise.metiers.filter((m) => m.principal)).toHaveLength(1);
    expect(entreprise.zones).toHaveLength(4);
    expect(entreprise.utilisateurs).toHaveLength(1);
    expect(entreprise.abonnements).toHaveLength(1);
  });

  it('donne à l’agence principale les coordonnées de sa commune', async () => {
    // Une coordonnée connue est posée sur la commune pour que l'assertion porte sur des
    // valeurs choisies, et non sur celles du référentiel qui peuvent changer. Ce que la
    // commune portait est relu d'abord et lui est rendu ensuite : remettre `null` était
    // exact quand aucune commune n'avait de coordonnées, et destructeur depuis.
    const cible = villes[0];
    if (cible === undefined) throw new Error('ville manquante');
    const avant = await prisma.commune.findUniqueOrThrow({
      where: { code: cible },
      select: { latitude: true, longitude: true },
    });
    await prisma.commune.update({
      where: { code: cible },
      data: { latitude: 48.8566, longitude: 2.3522 },
    });

    try {
      await inscrit(requete(saisie({ communeSiege: cible })));

      const agence = await prisma.agence.findFirstOrThrow({
        where: { entreprise: { siret: SIRET } },
      });
      expect(agence.principale).toBe(true);
      expect(agence.communeId).toBe(cible);
      expect(agence.latitude).toBe(48.8566);
      expect(agence.longitude).toBe(2.3522);
    } finally {
      await prisma.commune.update({ where: { code: cible }, data: avant });
    }
  });

  it('enregistre le mot de passe haché, jamais en clair', async () => {
    await inscrit(requete(saisie()));

    const utilisateur = await prisma.utilisateurPro.findUniqueOrThrow({
      where: { email: `gerant@${MARQUE}.test` },
    });

    expect(utilisateur.motDePasseHash).not.toBeNull();
    expect(utilisateur.motDePasseHash).not.toContain(MOT_DE_PASSE);
    expect(await verifieMotDePasse(MOT_DE_PASSE, utilisateur.motDePasseHash ?? '')).toBe(true);
  });

  it('ouvre la session : on ne se reconnecte pas pour voir ce qu’on vient de créer', async () => {
    await inscrit(requete(saisie()));
    expect(sessions.ouvertes).toHaveLength(1);
  });

  it('marque l’abonnement payant comme impayé tant que rien n’est réglé', async () => {
    await inscrit(requete(saisie({ formule: 'premium' })));

    const abonnement = await prisma.abonnement.findFirstOrThrow({
      where: { entreprise: { siret: SIRET } },
    });
    expect(abonnement.formule).toBe('premium');
    // Rien dans le classement ni la distribution ne regarde un abonnement non « actif » : la
    // formule est enregistrée sans offrir de visibilité non réglée.
    expect(abonnement.statut).toBe('impaye');
  });

  it('active tout de suite l’abonnement gratuit, qui n’exige aucun paiement', async () => {
    await inscrit(requete(saisie({ formule: 'gratuit', villes: villes.slice(0, 2) })));

    const abonnement = await prisma.abonnement.findFirstOrThrow({
      where: { entreprise: { siret: SIRET } },
    });
    expect(abonnement.statut).toBe('actif');
    expect(abonnement.engageJusquA).toBeNull();
  });

  it('porte l’engagement de douze mois de la formule exclusive', async () => {
    await inscrit(requete(saisie({ formule: 'exclusif' })));

    const abonnement = await prisma.abonnement.findFirstOrThrow({
      where: { entreprise: { siret: SIRET } },
    });
    expect(abonnement.engageJusquA).not.toBeNull();
  });
});

describe('villes et formule', () => {
  it('n’enregistre que les villes que la formule autorise', async () => {
    // Quatre villes demandées, deux permises par la formule gratuite. Ce sont exactement les
    // villes que l'écran a annoncé garder à l'étape 6.
    const reponse = await inscrit(requete(saisie({ formule: 'gratuit' })));
    expect(reponse.status).toBe(201);

    const corps = (await reponse.json()) as {
      villesConservees: string[];
      villesRetirees: string[];
    };
    expect(corps.villesConservees).toHaveLength(2);
    expect(corps.villesRetirees).toHaveLength(2);

    const zones = await prisma.zonePro.findMany({ where: { entreprise: { siret: SIRET } } });
    expect(zones.map((z) => z.communeId).sort()).toEqual([...corps.villesConservees].sort());
  });

  it('garde la ville du siège quand la formule en retire', async () => {
    const siege = villes[3];
    const reponse = await inscrit(requete(saisie({ formule: 'gratuit', communeSiege: siege })));
    const corps = (await reponse.json()) as { villesConservees: string[] };

    expect(corps.villesConservees).toContain(siege);
  });

  it('installe l’agence dans la ville du siège', async () => {
    const siege = villes[2];
    await inscrit(requete(saisie({ communeSiege: siege })));

    const agence = await prisma.agence.findFirstOrThrow({
      where: { entreprise: { siret: SIRET } },
    });
    expect(agence.communeId).toBe(siege);
  });
});

describe('revendication', () => {
  it('reprend une fiche existante au lieu d’en créer une seconde', async () => {
    const existante = await prisma.entreprise.create({
      data: {
        siret: SIRET_DEJA_LA,
        nom: `${MARQUE} Fiche Sirene`,
        slug: `${MARQUE}-fiche-sirene`,
        source: 'sirene',
        revendiquee: false,
      },
    });

    const reponse = await inscrit(
      requete(saisie({ siret: SIRET_DEJA_LA, nomEntreprise: `${MARQUE} Nom Corrigé` })),
    );
    expect(reponse.status).toBe(201);

    const corps = (await reponse.json()) as { revendiquee: boolean; slug: string };
    expect(corps.revendiquee).toBe(true);

    const toutes = await prisma.entreprise.findMany({ where: { siret: SIRET_DEJA_LA } });
    expect(toutes).toHaveLength(1);
    expect(toutes[0]?.id).toBe(existante.id);
    expect(toutes[0]?.revendiquee).toBe(true);
    // Le slug ne change pas : il est peut-être déjà indexé et partagé.
    expect(corps.slug).toBe(existante.slug);
    expect(toutes[0]?.nom).toBe(`${MARQUE} Nom Corrigé`);
  });

  it('refuse une fiche déjà revendiquée et renvoie vers la connexion', async () => {
    await prisma.entreprise.create({
      data: {
        siret: SIRET_DEJA_LA,
        nom: `${MARQUE} Déjà Tenue`,
        slug: `${MARQUE}-deja-tenue`,
        source: 'inscription',
        revendiquee: true,
      },
    });

    const reponse = await inscrit(requete(saisie({ siret: SIRET_DEJA_LA })));
    expect(reponse.status).toBe(409);

    const corps = (await reponse.json()) as { genre: string };
    expect(corps.genre).toBe('fiche-deja-revendiquee');
    expect(sessions.ouvertes).toHaveLength(0);
  });
});

describe('refus', () => {
  it('refuse une adresse électronique déjà rattachée à un compte', async () => {
    await inscrit(requete(saisie()));

    const reponse = await inscrit(requete(saisie({ siret: SIRET_DEJA_LA })));
    expect(reponse.status).toBe(409);
    expect(((await reponse.json()) as { genre: string }).genre).toBe('adresse-deja-utilisee');
  });

  it('n’écrit rien quand la saisie est refusée', async () => {
    // Le point important : un refus ne doit pas laisser le SIRET pris sans compte pour l'ouvrir.
    const reponse = await inscrit(requete(saisie({ description: 'Trop court.' })));
    expect(reponse.status).toBe(422);

    expect(await prisma.entreprise.findUnique({ where: { siret: SIRET } })).toBeNull();
  });

  it('rend tous les problèmes d’un coup, chacun avec son étape', async () => {
    const reponse = await inscrit(
      requete(saisie({ siret: '00000000000000', description: 'Court.' })),
    );
    expect(reponse.status).toBe(422);

    const corps = (await reponse.json()) as {
      problemes: { champ: string; etape: number }[];
    };
    expect(corps.problemes.map((p) => p.champ)).toContain('siret');
    expect(corps.problemes.map((p) => p.champ)).toContain('description');
    expect(corps.problemes.find((p) => p.champ === 'siret')?.etape).toBe(0);
  });

  it('refuse un métier qui n’existe pas, plutôt que de l’ignorer', async () => {
    const reponse = await inscrit(
      requete(
        saisie({ metiers: ['plombier', 'dresseur-de-licornes'], metierPrincipal: 'plombier' }),
      ),
    );
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { genre: string }).genre).toBe('reference-inconnue');
    expect(await prisma.entreprise.findUnique({ where: { siret: SIRET } })).toBeNull();
  });

  it('refuse une ville qui n’existe pas', async () => {
    const reponse = await inscrit(requete(saisie({ villes: [...villes, '99999'] })));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { genre: string }).genre).toBe('reference-inconnue');
  });

  it('refuse un corps illisible', async () => {
    const mauvaise = new Request('http://localhost/api/pro/inscription', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'pas du json',
    });
    expect((await inscrit(mauvaise)).status).toBe(400);
  });

  it('refuse un corps dont la forme ne correspond pas', async () => {
    const reponse = await inscrit(requete({ siret: SIRET }));
    expect(reponse.status).toBe(400);
  });
});
