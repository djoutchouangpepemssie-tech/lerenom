/**
 * Le référencement technique : ce qui est publié, et surtout ce qui ne l'est pas.
 *
 * Le test qui compte le plus ici n'est pas celui du plan du site : c'est celui qui vérifie que
 * **`/suivi/` est refusé aux moteurs**. Ces adresses portent un jeton secret ; une seule
 * indexée serait une fuite de données personnelles.
 *
 * Vient ensuite la préproduction. Un environnement de test indexé vole son référencement à la
 * production, et cette erreur-là ne se voit que lorsqu'elle a produit ses effets.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@lerenom/db';
import robots from './robots';
import plan from './sitemap';

const ENV_INITIAL = { ...process.env };

beforeEach(() => {
  process.env['LERENOM_URL'] = 'https://lerenom.test';
  process.env['LERENOM_ENV'] = 'production';
});

afterEach(() => {
  process.env = { ...ENV_INITIAL };
});

describe('robots', () => {
  it('refuse les adresses de suivi, qui portent un jeton secret', () => {
    const regle = robots().rules;
    const premiere = Array.isArray(regle) ? regle[0] : regle;
    const refuses = premiere?.disallow;
    expect(Array.isArray(refuses) ? refuses : [refuses]).toContain('/suivi/');
  });

  it('refuse l’espace professionnel et les routes d’interface', () => {
    const regle = robots().rules;
    const premiere = Array.isArray(regle) ? regle[0] : regle;
    const refuses = (
      Array.isArray(premiere?.disallow) ? premiere.disallow : [premiere?.disallow]
    ) as string[];
    expect(refuses).toContain('/pro/espace/');
    expect(refuses).toContain('/api/');
  });

  it('autorise le reste du site et annonce le plan', () => {
    const resultat = robots();
    const premiere = Array.isArray(resultat.rules) ? resultat.rules[0] : resultat.rules;
    expect(premiere?.allow).toBe('/');
    expect(resultat.sitemap).toBe('https://lerenom.test/sitemap.xml');
  });

  it('refuse tout hors production', () => {
    // Une préproduction indexée vole son référencement à la production.
    process.env['LERENOM_ENV'] = 'preproduction';
    const resultat = robots();
    const premiere = Array.isArray(resultat.rules) ? resultat.rules[0] : resultat.rules;
    expect(premiere?.disallow).toBe('/');
    expect(premiere?.allow).toBeUndefined();
  });

  it('refuse tout quand l’environnement n’est pas déclaré', () => {
    // Se tromper dans ce sens-là se répare ; dans l'autre, beaucoup moins.
    delete process.env['LERENOM_ENV'];
    const resultat = robots();
    const premiere = Array.isArray(resultat.rules) ? resultat.rules[0] : resultat.rules;
    expect(premiere?.disallow).toBe('/');
  });
});

describe('plan du site', () => {
  it('ne publie rien hors production', async () => {
    process.env['LERENOM_ENV'] = 'preproduction';
    expect(await plan()).toEqual([]);
  });

  it('part de l’adresse de l’environnement, jamais d’une adresse écrite en dur', async () => {
    const pages = await plan();
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) expect(page.url.startsWith('https://lerenom.test')).toBe(true);
  });

  it('contient l’accueil, le catalogue et la géographie', async () => {
    const adresses = new Set((await plan()).map((page) => page.url));
    expect(adresses).toContain('https://lerenom.test');
    expect(adresses).toContain('https://lerenom.test/services');
    expect(adresses).toContain('https://lerenom.test/ile-de-france');
  });

  it('liste chaque métier et chaque ville', async () => {
    const [metiers, communes] = await Promise.all([
      prisma.metier.count({ where: { masque: false } }),
      prisma.commune.count(),
    ]);
    const adresses = (await plan()).map((page) => page.url);

    const metier = await prisma.metier.findFirstOrThrow({ where: { masque: false } });
    const commune = await prisma.commune.findFirstOrThrow();
    expect(adresses).toContain(`https://lerenom.test/${metier.slug}`);
    expect(adresses).toContain(`https://lerenom.test/${commune.slug}`);
    expect(metiers).toBeGreaterThan(0);
    expect(communes).toBeGreaterThan(0);
  });

  it('ne croise les métiers qu’avec les villes ouvertes', async () => {
    // Le produit cartésien complet ferait près de 89 000 adresses, dont la plupart sans
    // professionnel à montrer. Un plan du site n'est pas un inventaire.
    const [ouvertes, metiers] = await Promise.all([
      prisma.commune.findMany({ where: { statut: 'ouvert' }, select: { slug: true } }),
      prisma.metier.count({ where: { masque: false } }),
    ]);
    const fermee = await prisma.commune.findFirst({
      where: { statut: 'annuaire' },
      select: { slug: true },
    });
    const metier = await prisma.metier.findFirstOrThrow({ where: { masque: false } });

    const adresses = new Set((await plan()).map((page) => page.url));
    // Une page croisée est celle dont le premier segment est un slug de métier : `/entreprise/`
    // et `/pro/inscription` ont deux segments eux aussi, et ne sont pas des croisements.
    const slugsMetier = new Set(
      (await prisma.metier.findMany({ where: { masque: false }, select: { slug: true } })).map(
        (m) => m.slug,
      ),
    );
    const croisees = [...adresses].filter((url) => {
      const segments = url.replace('https://lerenom.test/', '').split('/');
      return segments.length === 2 && slugsMetier.has(segments[0] ?? '');
    });

    expect(croisees).toHaveLength(ouvertes.length * metiers);
    if (fermee !== null) {
      expect(adresses.has(`https://lerenom.test/${metier.slug}/${fermee.slug}`)).toBe(false);
    }
  });

  it('n’annonce aucune adresse de suivi ni d’espace professionnel', async () => {
    // La même exigence que le fichier robots, vérifiée de l'autre côté : un plan du site qui
    // listerait un jeton de suivi le livrerait aux moteurs par la grande porte.
    for (const page of await plan()) {
      expect(page.url).not.toContain('/suivi/');
      expect(page.url).not.toContain('/pro/espace');
      expect(page.url).not.toContain('/api/');
    }
  });

  it('n’a aucune adresse en double', async () => {
    const adresses = (await plan()).map((page) => page.url);
    expect(new Set(adresses).size).toBe(adresses.length);
  });

  it('écarte les entreprises retirées', async () => {
    const retiree = await prisma.entreprise.findFirst({ where: { retireeLe: { not: null } } });
    if (retiree === null) return;
    const adresses = (await plan()).map((page) => page.url);
    expect(adresses).not.toContain(`https://lerenom.test/entreprise/${retiree.slug}`);
  });
});
