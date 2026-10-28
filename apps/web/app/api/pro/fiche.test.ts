/**
 * L'enregistrement de la fiche professionnelle.
 *
 * Deux choses sont gardées ici, et ce ne sont pas les mêmes :
 *
 *   * **la frontière** — l'entreprise visée est celle de la session, jamais celle que le corps
 *     de la requête désigne. Sans ce test, un champ ajouté un jour au formulaire pourrait
 *     ouvrir la fiche d'un confrère à la réécriture ;
 *   * **la complétude** — elle est recalculée à chaque enregistrement, et elle alimente le
 *     classement naturel. Un écran qui affiche un pourcentage sans que la base le stocke
 *     donnerait un chiffre qui ne classe rien.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { PUT as enregistre } from './fiche/route';
import { ficheDuPro } from '@/lib/fiche-pro';

const MARQUE = 'test-fiche-pro';

let entrepriseId = '';
let autreEntrepriseId = '';

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
  return new Request('http://localhost/api/pro/fiche', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });
}

function saisie(modifications: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    description:
      'Entreprise familiale installée dans le 11e depuis 1998. Recherche de fuite, dépannage d’urgence et rénovation complète de salle de bain.',
    slogan: 'Le dépannage sans mauvaise surprise',
    telephone: '01 99 00 00 12',
    email: 'contact@exemple.test',
    siteWeb: '',
    atouts: ['Devis gratuit', 'Intervention sous 2 h', 'Chantier laissé propre'],
    decennaleNumero: '',
    decennaleAssureur: '',
    decennaleExpireLe: '',
    ...modifications,
  };
}

beforeAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
});

beforeEach(async () => {
  await nettoieLesDonneesDeTest(MARQUE);

  const mienne = await prisma.entreprise.create({
    data: { nom: `${MARQUE} Mienne`, slug: `${MARQUE}-mienne`, source: 'inscription' },
  });
  const autre = await prisma.entreprise.create({
    data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
  });
  entrepriseId = mienne.id;
  autreEntrepriseId = autre.id;
  session.courante = { entrepriseId };
});

afterAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

describe('enregistrement', () => {
  it('crée la fiche d’une entreprise qui n’en avait pas', async () => {
    // Une entreprise reprise de la base SIRENE peut n'avoir jamais eu de fiche : le premier
    // enregistrement doit la créer plutôt qu'échouer.
    expect(await prisma.fiche.findUnique({ where: { entrepriseId } })).toBeNull();

    const reponse = await enregistre(requete(saisie()));
    expect(reponse.status).toBe(200);

    const fiche = await prisma.fiche.findUniqueOrThrow({ where: { entrepriseId } });
    expect(fiche.description).toContain('Entreprise familiale');
    expect(fiche.atouts).toHaveLength(3);
  });

  it('met à jour une fiche existante sans la dupliquer', async () => {
    await enregistre(requete(saisie()));
    await enregistre(requete(saisie({ slogan: 'Un autre slogan' })));

    const fiches = await prisma.fiche.findMany({ where: { entrepriseId } });
    expect(fiches).toHaveLength(1);
    expect(fiches[0]?.slogan).toBe('Un autre slogan');
  });

  it('enregistre la complétude en base, pas seulement à l’écran', async () => {
    const reponse = await enregistre(requete(saisie()));
    const corps = (await reponse.json()) as { completude: number };

    const fiche = await prisma.fiche.findUniqueOrThrow({ where: { entrepriseId } });
    expect(fiche.completude).toBeCloseTo(corps.completude, 5);
    expect(fiche.completude).toBeGreaterThan(0);
  });

  it('fait monter la complétude quand on ajoute une décennale valide', async () => {
    const avant = (await (await enregistre(requete(saisie()))).json()) as { completude: number };

    const dansUnAn = new Date();
    dansUnAn.setFullYear(dansUnAn.getFullYear() + 1);
    const apres = (await (
      await enregistre(
        requete(
          saisie({
            decennaleAssureur: 'Assureur fictif',
            decennaleNumero: 'DEC-1',
            decennaleExpireLe: dansUnAn.toISOString().slice(0, 10),
          }),
        ),
      )
    ).json()) as { completude: number };

    expect(apres.completude).toBeGreaterThan(avant.completude);
  });

  it('ne compte pas une décennale expirée', async () => {
    const sans = (await (await enregistre(requete(saisie()))).json()) as { completude: number };
    const expiree = (await (
      await enregistre(
        requete(
          saisie({
            decennaleAssureur: 'Assureur fictif',
            decennaleNumero: 'DEC-1',
            decennaleExpireLe: '2020-01-01',
          }),
        ),
      )
    ).json()) as { completude: number };

    expect(expiree.completude).toBe(sans.completude);
  });

  it('range une chaîne vide comme « non renseigné », pas comme une valeur', async () => {
    await enregistre(requete(saisie({ slogan: '   ' })));
    const fiche = await prisma.fiche.findUniqueOrThrow({ where: { entrepriseId } });
    expect(fiche.slogan).toBeNull();
  });

  it('écarte les atouts vides', async () => {
    await enregistre(requete(saisie({ atouts: ['Devis gratuit', '', '   ', 'Propreté'] })));
    const fiche = await prisma.fiche.findUniqueOrThrow({ where: { entrepriseId } });
    expect(fiche.atouts).toEqual(['Devis gratuit', 'Propreté']);
  });
});

describe('frontière', () => {
  it('refuse une requête sans session', async () => {
    session.courante = null;
    const reponse = await enregistre(requete(saisie()));
    expect(reponse.status).toBe(401);
  });

  it('n’écrit que sur l’entreprise de la session, même si le corps en nomme une autre', async () => {
    await enregistre(requete(saisie({ entrepriseId: autreEntrepriseId })));

    expect(
      await prisma.fiche.findUnique({ where: { entrepriseId: autreEntrepriseId } }),
    ).toBeNull();
    expect(await prisma.fiche.findUnique({ where: { entrepriseId } })).not.toBeNull();
  });
});

describe('refus de saisie', () => {
  it('refuse une présentation entamée mais trop courte', async () => {
    const reponse = await enregistre(requete(saisie({ description: 'Plombier dans le 11e.' })));
    expect(reponse.status).toBe(422);
    const corps = (await reponse.json()) as { problemes: { champ: string }[] };
    expect(corps.problemes.map((p) => p.champ)).toContain('description');
  });

  it('accepte une présentation entièrement vide', async () => {
    // Une fiche à moitié remplie est permise : elle est seulement moins bien classée. On ne
    // refuse que ce qui serait faux.
    const reponse = await enregistre(requete(saisie({ description: '' })));
    expect(reponse.status).toBe(200);
  });

  it('refuse une adresse de site sans protocole', async () => {
    const reponse = await enregistre(requete(saisie({ siteWeb: 'exemple.test' })));
    expect(reponse.status).toBe(422);
    const corps = (await reponse.json()) as { problemes: { champ: string }[] };
    expect(corps.problemes.map((p) => p.champ)).toContain('siteWeb');
  });

  it('refuse une adresse électronique invalide', async () => {
    const reponse = await enregistre(requete(saisie({ email: 'contact@exemple' })));
    expect(reponse.status).toBe(422);
  });

  it('refuse plus de six atouts', async () => {
    const reponse = await enregistre(
      requete(saisie({ atouts: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })),
    );
    expect(reponse.status).toBe(422);
  });

  it('n’écrit rien quand la saisie est refusée', async () => {
    await enregistre(requete(saisie({ siteWeb: 'exemple.test' })));
    expect(await prisma.fiche.findUnique({ where: { entrepriseId } })).toBeNull();
  });

  it('refuse un corps illisible', async () => {
    const mauvaise = new Request('http://localhost/api/pro/fiche', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: 'pas du json',
    });
    expect((await enregistre(mauvaise)).status).toBe(400);
  });
});

describe('lecture', () => {
  it('rend la complétude et ce qui manque, du plus utile au moins utile', async () => {
    await enregistre(requete(saisie()));

    const fiche = await ficheDuPro(entrepriseId);
    expect(fiche).not.toBeNull();
    expect(fiche?.completude).toBeGreaterThan(0);
    expect(fiche?.manques.map((m) => m.cle)).toContain('photos');

    const poids = fiche?.manques.map((m) => m.poids) ?? [];
    expect(poids).toEqual([...poids].sort((a, b) => b - a));
  });

  it('rend null pour une entreprise qui n’existe pas', async () => {
    expect(await ficheDuPro('inexistante')).toBeNull();
  });
});
