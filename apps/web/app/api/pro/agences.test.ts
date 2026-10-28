/**
 * Les agences d'un professionnel.
 *
 * Une agence est un point et un rayon : c'est elle qui décide si une demande est à portée.
 * Trois garanties sont tenues ici, et aucune ne se voit à l'écran :
 *
 *   * **exactement une agence principale**, toujours. C'est son adresse qui figure sur la
 *     fiche publique ; zéro ou deux laisseraient la fiche sans adresse ou avec deux ;
 *   * **des coordonnées, toujours**. Une agence sans position n'est éligible à rien : elle
 *     serait enregistrée et ne recevrait jamais une demande ;
 *   * **une agence reste dans le périmètre**. Posée dans une ville que l'entreprise a exclue,
 *     elle recevrait des demandes que le professionnel a lui-même écartées.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { PUT as enregistre } from './agences/route';
import { agencesDuPro } from '@/lib/agences-pro';

const MARQUE = 'test-agences';

let entrepriseId = '';
let villes: readonly { code: string; latitude: number | null; longitude: number | null }[] = [];

const session = vi.hoisted(() => ({ courante: null as null | { entrepriseId: string } }));

vi.mock('@/lib/session-pro', () => ({
  proConnecte: () =>
    Promise.resolve(
      session.courante === null
        ? null
        : {
            utilisateurId: 'u',
            entrepriseId: session.courante.entrepriseId,
            nom: 'Test',
            email: 'test@exemple.test',
            entreprise: 'Test',
            sessionId: 's',
          },
    ),
  ouvreSession: () => Promise.resolve(),
  fermeSession: () => Promise.resolve(),
}));

function requete(agences: unknown): Request {
  return new Request('http://localhost/api/pro/agences', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agences }),
  });
}

function agence(modifications: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nom: 'Agence principale',
    adresse: '12 rue de la Roquette',
    codePostal: '75011',
    communeId: villes[0]?.code ?? '',
    rayonKm: 10,
    contactNom: 'Julien',
    contactTelephone: '01 99 00 00 12',
    contactEmail: 'contact@exemple.test',
    notifierParSms: true,
    notifierParEmail: true,
    principale: true,
    ...modifications,
  };
}

/**
 * Aucune commune du jeu de données n'a de coordonnées — le géocodage n'a jamais tourné, et
 * c'est consigné en Q26. Le test en pose donc lui-même sur trois communes, pour éprouver le
 * chemin qui existera quand la donnée sera là, puis les remet à `null`.
 */
beforeAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  const communes = await prisma.commune.findMany({
    select: { code: true },
    orderBy: { code: 'asc' },
    take: 3,
  });
  expect(communes.length).toBe(3);

  villes = communes.map((commune, rang) => ({
    code: commune.code,
    latitude: 48.85 + rang / 100,
    longitude: 2.35 + rang / 100,
  }));
  for (const ville of villes) {
    await prisma.commune.update({
      where: { code: ville.code },
      data: { latitude: ville.latitude, longitude: ville.longitude },
    });
  }
});

beforeEach(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} Entreprise`,
      slug: `${MARQUE}-entreprise`,
      source: 'inscription',
      zones: { create: villes.slice(0, 2).map((ville) => ({ communeId: ville.code })) },
    },
  });
  entrepriseId = entreprise.id;
  session.courante = { entrepriseId };
});

afterAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  // Les coordonnées posées plus haut sont retirées : un test ne laisse pas de données
  // derrière lui, pas même des données justes.
  for (const ville of villes) {
    await prisma.commune.update({
      where: { code: ville.code },
      data: { latitude: null, longitude: null },
    });
  }
  await prisma.$disconnect();
});

describe('enregistrement', () => {
  it('crée une agence', async () => {
    const reponse = await enregistre(requete([agence()]));
    expect(reponse.status).toBe(200);

    const agences = await prisma.agence.findMany({ where: { entrepriseId } });
    expect(agences).toHaveLength(1);
    expect(agences[0]?.adresse).toBe('12 rue de la Roquette');
    expect(agences[0]?.rayonKm).toBe(10);
  });

  it('donne à l’agence les coordonnées de sa commune', async () => {
    // Sans position, une agence n'est éligible à rien : elle serait enregistrée et ne
    // recevrait jamais une demande.
    await enregistre(requete([agence()]));
    const enregistree = await prisma.agence.findFirstOrThrow({ where: { entrepriseId } });
    expect(enregistree.latitude).toBe(villes[0]?.latitude);
    expect(enregistree.longitude).toBe(villes[0]?.longitude);
  });

  it('modifie une agence existante sans la dupliquer', async () => {
    await enregistre(requete([agence()]));
    const existante = await prisma.agence.findFirstOrThrow({ where: { entrepriseId } });

    await enregistre(requete([agence({ id: existante.id, rayonKm: 25 })]));

    const agences = await prisma.agence.findMany({ where: { entrepriseId } });
    expect(agences).toHaveLength(1);
    expect(agences[0]?.rayonKm).toBe(25);
    expect(agences[0]?.id).toBe(existante.id);
  });

  it('ajoute une seconde agence', async () => {
    await enregistre(requete([agence()]));
    const premiere = await prisma.agence.findFirstOrThrow({ where: { entrepriseId } });

    const reponse = await enregistre(
      requete([
        agence({ id: premiere.id }),
        agence({ nom: 'Agence de Montreuil', communeId: villes[1]?.code, principale: false }),
      ]),
    );
    expect(reponse.status).toBe(200);
    expect(await prisma.agence.count({ where: { entrepriseId } })).toBe(2);
  });

  it('supprime une agence absente de la liste envoyée', async () => {
    await enregistre(
      requete([agence(), agence({ communeId: villes[1]?.code, principale: false })]),
    );
    const principale = await prisma.agence.findFirstOrThrow({
      where: { entrepriseId, principale: true },
    });

    await enregistre(requete([agence({ id: principale.id })]));
    expect(await prisma.agence.count({ where: { entrepriseId } })).toBe(1);
  });

  it('range une chaîne vide comme « non renseigné »', async () => {
    await enregistre(requete([agence({ nom: '  ', contactNom: '' })]));
    const enregistree = await prisma.agence.findFirstOrThrow({ where: { entrepriseId } });
    expect(enregistree.nom).toBeNull();
    expect(enregistree.contactNom).toBeNull();
  });
});

describe('agence principale', () => {
  it('refuse une liste sans agence principale', async () => {
    const reponse = await enregistre(requete([agence({ principale: false })]));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { erreur: string }).erreur).toContain('principale');
  });

  it('refuse deux agences principales', async () => {
    const reponse = await enregistre(requete([agence(), agence({ communeId: villes[1]?.code })]));
    expect(reponse.status).toBe(422);
  });

  it('déplace la principale sans en laisser deux', async () => {
    await enregistre(
      requete([agence(), agence({ communeId: villes[1]?.code, principale: false })]),
    );
    const agences = await prisma.agence.findMany({
      where: { entrepriseId },
      orderBy: { creeLe: 'asc' },
    });

    await enregistre(
      requete([
        agence({ id: agences[0]?.id, principale: false }),
        agence({ id: agences[1]?.id, communeId: villes[1]?.code, principale: true }),
      ]),
    );

    expect(await prisma.agence.count({ where: { entrepriseId, principale: true } })).toBe(1);
  });
});

describe('refus', () => {
  it('refuse une liste vide', async () => {
    expect((await enregistre(requete([]))).status).toBe(400);
  });

  it('refuse une agence hors du périmètre', async () => {
    // Posée dans une ville exclue, elle recevrait des demandes que le professionnel a
    // lui-même écartées de son périmètre.
    const reponse = await enregistre(requete([agence({ communeId: villes[2]?.code })]));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { erreur: string }).erreur).toContain('périmètre');
  });

  it('refuse un rayon hors bornes', async () => {
    expect((await enregistre(requete([agence({ rayonKm: 0 })]))).status).toBe(400);
    expect((await enregistre(requete([agence({ rayonKm: 500 })]))).status).toBe(400);
  });

  it('refuse une adresse vide', async () => {
    const reponse = await enregistre(requete([agence({ adresse: '   ' })]));
    expect(reponse.status).toBe(422);
  });

  it('refuse de modifier une agence qui n’existe pas', async () => {
    const reponse = await enregistre(requete([agence({ id: 'inexistante' })]));
    expect(reponse.status).toBe(422);
  });

  it('n’écrit rien quand la liste est refusée', async () => {
    await enregistre(requete([agence()]));
    await enregistre(requete([agence({ principale: false })]));
    // L'agence posée plus haut est intacte : un refus ne modifie pas l'existant.
    expect(await prisma.agence.count({ where: { entrepriseId, principale: true } })).toBe(1);
  });

  it('refuse une requête sans session', async () => {
    session.courante = null;
    expect((await enregistre(requete([agence()]))).status).toBe(401);
  });
});

describe('lecture', () => {
  it('rend les agences, la principale en tête', async () => {
    await enregistre(
      requete([agence({ communeId: villes[1]?.code, principale: false }), agence()]),
    );
    const donnees = await agencesDuPro(entrepriseId);
    expect(donnees?.agences[0]?.principale).toBe(true);
    expect(donnees?.agences).toHaveLength(2);
  });

  it('ne propose que les villes du périmètre', async () => {
    const donnees = await agencesDuPro(entrepriseId);
    expect(donnees?.communes).toHaveLength(2);
    expect(donnees?.communes.map((c) => c.code).toSorted()).toEqual(
      villes
        .slice(0, 2)
        .map((v) => v.code)
        .toSorted(),
    );
  });

  it('signale qu’une agence est positionnée', async () => {
    await enregistre(requete([agence()]));
    const donnees = await agencesDuPro(entrepriseId);
    expect(donnees?.agences[0]?.positionnee).toBe(true);
  });

  it('rend null pour une entreprise qui n’existe pas', async () => {
    expect(await agencesDuPro('inexistante')).toBeNull();
  });
});
