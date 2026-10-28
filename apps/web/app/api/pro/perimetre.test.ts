/**
 * Le périmètre d'un professionnel : ses métiers et ses villes.
 *
 * Les deux tests qui comptent portent sur des refus, et ils disent la même chose sous deux
 * formes : **on ne retire jamais une ville à la place du professionnel**.
 *
 *   * dépasser le plafond de sa formule est refusé avec le compte exact, pas corrigé
 *     d'autorité. À l'inscription, l'ajustement automatique était acceptable : les villes
 *     retirées s'affichaient avant la validation. Ici, personne ne regarde par-dessus son
 *     épaule ;
 *   * retirer une ville qui porte un emplacement payé est refusé tout court : supprimer la
 *     zone laisserait un emplacement vendu sans ville où l'honorer.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { REGLES_VALIDEES } from '@lerenom/core';
import { PUT as enregistre } from './perimetre/route';
import { perimetreDuPro } from '@/lib/zones-pro';

const MARQUE = 'test-perimetre';

let entrepriseId = '';
let metiers: readonly { id: string; slug: string }[] = [];
let villes: readonly string[] = [];

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

function requete(corps: unknown): Request {
  return new Request('http://localhost/api/pro/perimetre', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });
}

/** Met l'entreprise sous une formule donnée, pour éprouver les plafonds. */
async function donneLaFormule(formule: 'gratuit' | 'essentiel' | 'premium' | 'exclusif') {
  await prisma.abonnement.deleteMany({ where: { entrepriseId } });
  await prisma.abonnement.create({
    data: { entrepriseId, formule, statut: 'actif', debuteLe: new Date() },
  });
}

beforeAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);

  metiers = await prisma.metier.findMany({
    where: { masque: false },
    select: { id: true, slug: true },
    orderBy: { slug: 'asc' },
    take: 3,
  });
  const communes = await prisma.commune.findMany({
    select: { code: true },
    orderBy: { code: 'asc' },
    take: 8,
  });
  villes = communes.map((commune) => commune.code);
  expect(metiers.length).toBe(3);
  expect(villes.length).toBe(8);
});

beforeEach(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  const entreprise = await prisma.entreprise.create({
    data: { nom: `${MARQUE} Entreprise`, slug: `${MARQUE}-entreprise`, source: 'inscription' },
  });
  entrepriseId = entreprise.id;
  session.courante = { entrepriseId };
  await donneLaFormule('premium');
});

afterAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

function saisie(modifications: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    metiers: metiers.slice(0, 2).map((m) => m.slug),
    metierPrincipal: metiers[0]?.slug ?? null,
    villes: villes.slice(0, 3),
    ...modifications,
  };
}

describe('enregistrement', () => {
  it('pose les métiers et les villes', async () => {
    const reponse = await enregistre(requete(saisie()));
    expect(reponse.status).toBe(200);

    const [metiersPro, zones] = await Promise.all([
      prisma.metierPro.findMany({ where: { entrepriseId } }),
      prisma.zonePro.findMany({ where: { entrepriseId } }),
    ]);
    expect(metiersPro).toHaveLength(2);
    expect(zones).toHaveLength(3);
    expect(metiersPro.filter((m) => m.principal)).toHaveLength(1);
  });

  it('rend le nombre de pages produites', async () => {
    const corps = (await (await enregistre(requete(saisie()))).json()) as {
      nombreDePages: number;
    };
    expect(corps.nombreDePages).toBe(6);
  });

  it('remplace le périmètre au lieu de l’additionner', async () => {
    // Le périmètre est un ensemble : deux enregistrements successifs ne cumulent pas.
    await enregistre(requete(saisie()));
    await enregistre(requete(saisie({ metiers: [metiers[0]?.slug], villes: villes.slice(0, 1) })));

    expect(await prisma.metierPro.count({ where: { entrepriseId } })).toBe(1);
    expect(await prisma.zonePro.count({ where: { entrepriseId } })).toBe(1);
  });

  it('déplace le métier principal quand l’ancien est retiré', async () => {
    await enregistre(requete(saisie()));
    await enregistre(
      requete({
        metiers: [metiers[1]?.slug],
        metierPrincipal: metiers[1]?.slug,
        villes: villes.slice(0, 2),
      }),
    );

    const principaux = await prisma.metierPro.findMany({
      where: { entrepriseId, principal: true },
    });
    expect(principaux).toHaveLength(1);
  });
});

describe('plafond de la formule', () => {
  it('refuse de dépasser le plafond, avec le compte exact', async () => {
    await donneLaFormule('gratuit');
    const plafond = REGLES_VALIDEES.villesMax.gratuit ?? 0;

    const reponse = await enregistre(requete(saisie({ villes: villes.slice(0, plafond + 2) })));
    expect(reponse.status).toBe(422);

    const corps = (await reponse.json()) as { erreur: string };
    expect(corps.erreur).toContain(String(plafond));
    expect(corps.erreur).toContain(String(plafond + 2));
  });

  it('n’écrit rien quand le plafond est dépassé', async () => {
    await enregistre(requete(saisie()));
    await donneLaFormule('gratuit');
    const plafond = REGLES_VALIDEES.villesMax.gratuit ?? 0;

    await enregistre(requete(saisie({ villes: villes.slice(0, plafond + 2) })));
    // Les trois villes posées plus haut sont toujours là : rien n'a été retiré à la place du
    // professionnel, et rien n'a été ajouté non plus.
    expect(await prisma.zonePro.count({ where: { entrepriseId } })).toBe(3);
  });

  it('accepte exactement le plafond', async () => {
    await donneLaFormule('gratuit');
    const plafond = REGLES_VALIDEES.villesMax.gratuit ?? 0;
    const reponse = await enregistre(requete(saisie({ villes: villes.slice(0, plafond) })));
    expect(reponse.status).toBe(200);
  });

  it('n’impose aucun plafond en Exclusif', async () => {
    await donneLaFormule('exclusif');
    const reponse = await enregistre(requete(saisie({ villes: [...villes] })));
    expect(reponse.status).toBe(200);
  });
});

describe('villes verrouillées', () => {
  async function poseUnEmplacement(codeCommune: string) {
    const metier = metiers[0];
    if (metier === undefined) throw new Error('métier manquant');
    await prisma.emplacement.create({
      data: {
        entrepriseId,
        metierId: metier.id,
        communeId: codeCommune,
        formule: 'premium',
        debuteLe: new Date(),
      },
    });
  }

  it('refuse de retirer une ville qui porte un emplacement payé', async () => {
    await enregistre(requete(saisie()));
    const gardee = villes[0];
    if (gardee === undefined) throw new Error('ville manquante');
    await poseUnEmplacement(gardee);

    const reponse = await enregistre(requete(saisie({ villes: villes.slice(1, 3) })));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { erreur: string }).erreur).toContain('emplacement');
  });

  it('laisse enregistrer tant que la ville verrouillée est gardée', async () => {
    await enregistre(requete(saisie()));
    const gardee = villes[0];
    if (gardee === undefined) throw new Error('ville manquante');
    await poseUnEmplacement(gardee);

    const reponse = await enregistre(requete(saisie({ villes: villes.slice(0, 2) })));
    expect(reponse.status).toBe(200);
  });

  it('signale la ville verrouillée à la lecture, pour qu’on ne la décoche pas', async () => {
    await enregistre(requete(saisie()));
    const gardee = villes[0];
    if (gardee === undefined) throw new Error('ville manquante');
    await poseUnEmplacement(gardee);

    const perimetre = await perimetreDuPro(entrepriseId);
    expect(perimetre?.villes.find((v) => v.code === gardee)?.verrouillee).toBe(true);
    expect(perimetre?.villes.find((v) => v.code === villes[1])?.verrouillee).toBe(false);
  });

  it('ignore un emplacement terminé', async () => {
    await enregistre(requete(saisie()));
    const metier = metiers[0];
    const ancienne = villes[0];
    if (metier === undefined || ancienne === undefined) throw new Error('données manquantes');
    await prisma.emplacement.create({
      data: {
        entrepriseId,
        metierId: metier.id,
        communeId: ancienne,
        formule: 'premium',
        debuteLe: new Date('2020-01-01'),
        finitLe: new Date('2020-06-01'),
      },
    });

    const reponse = await enregistre(requete(saisie({ villes: villes.slice(1, 3) })));
    expect(reponse.status).toBe(200);
  });
});

describe('refus de saisie', () => {
  it('refuse un périmètre sans métier', async () => {
    const reponse = await enregistre(requete({ metiers: [], metierPrincipal: null, villes }));
    expect(reponse.status).toBe(400);
  });

  it('refuse un périmètre sans ville', async () => {
    const reponse = await enregistre(
      requete({ metiers: [metiers[0]?.slug], metierPrincipal: metiers[0]?.slug, villes: [] }),
    );
    expect(reponse.status).toBe(400);
  });

  it('refuse un métier principal hors de la sélection', async () => {
    const reponse = await enregistre(requete(saisie({ metierPrincipal: metiers[2]?.slug })));
    expect(reponse.status).toBe(422);
  });

  it('refuse un métier qui n’existe pas', async () => {
    const reponse = await enregistre(
      requete(
        saisie({ metiers: ['dresseur-de-licornes'], metierPrincipal: 'dresseur-de-licornes' }),
      ),
    );
    expect(reponse.status).toBe(422);
  });

  it('refuse une ville qui n’existe pas', async () => {
    const reponse = await enregistre(requete(saisie({ villes: ['99999'] })));
    expect(reponse.status).toBe(422);
  });

  it('refuse une requête sans session', async () => {
    session.courante = null;
    expect((await enregistre(requete(saisie()))).status).toBe(401);
  });
});

describe('lecture', () => {
  it('marque les métiers et villes déjà choisis', async () => {
    await enregistre(requete(saisie()));
    const perimetre = await perimetreDuPro(entrepriseId);

    expect(perimetre?.metiers.filter((m) => m.choisi)).toHaveLength(2);
    expect(perimetre?.villes.filter((v) => v.choisie)).toHaveLength(3);
    expect(perimetre?.metiers.filter((m) => m.principal)).toHaveLength(1);
  });

  it('rend le plafond de la formule en cours', async () => {
    await donneLaFormule('essentiel');
    const perimetre = await perimetreDuPro(entrepriseId);
    expect(perimetre?.formule).toBe('essentiel');
    expect(perimetre?.villesMax).toBe(REGLES_VALIDEES.villesMax.essentiel);
  });

  it('retombe sur la formule gratuite sans abonnement actif', async () => {
    await prisma.abonnement.deleteMany({ where: { entrepriseId } });
    const perimetre = await perimetreDuPro(entrepriseId);
    expect(perimetre?.formule).toBe('gratuit');
  });

  it('rend null pour une entreprise qui n’existe pas', async () => {
    expect(await perimetreDuPro('inexistante')).toBeNull();
  });
});
