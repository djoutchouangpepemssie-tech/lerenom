import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  canonique,
  jsonLdEntreprise,
  jsonLdListeResultats,
  partage,
  type EntrepriseStructuree,
} from './referencement.ts';

/**
 * Les briques de référencement, éprouvées sans base ni navigateur.
 *
 * Ce qui se vérifie ici n'est pas que le balisage « marche » — un moteur le dira mieux —
 * mais qu'il **refuse** dans les cas où publier serait une faute : une entreprise qui a
 * refusé la diffusion de ses données, une note affichée sans avis.
 */

const AVANT = process.env['LERENOM_URL'];

beforeEach(() => {
  process.env['LERENOM_URL'] = 'https://lerenom.test';
});
afterEach(() => {
  if (AVANT === undefined) delete process.env['LERENOM_URL'];
  else process.env['LERENOM_URL'] = AVANT;
});

const BASE: EntrepriseStructuree = {
  nom: 'Plomberie Martin',
  slug: 'plomberie-martin',
  description: 'Plombier depuis 1998.',
  telephone: '+33100000000',
  siteWeb: null,
  adresse: '1 rue de la Roquette',
  codePostal: '75011',
  commune: 'Paris 11e',
  latitude: 48.85,
  longitude: 2.37,
  metier: 'Plombier',
  noteMoyenne: 4.7,
  nombreAvis: 84,
  diffusible: true,
};

describe('canonique', () => {
  it('retire les paramètres de filtre : une page filtrée n’est pas une page à part', () => {
    expect(canonique('/plombier/paris-11?urgence=1&tri=note')).toBe(
      'https://lerenom.test/plombier/paris-11',
    );
  });

  it('retire l’ancre, qui ne désigne pas une autre page', () => {
    expect(canonique('/services#plomberie')).toBe('https://lerenom.test/services');
  });

  it('retire la barre finale, qui ferait deux adresses pour une page', () => {
    expect(canonique('/plombier/paris-11/')).toBe('https://lerenom.test/plombier/paris-11');
  });

  it('garde la barre de la racine, qui est son adresse', () => {
    expect(canonique('/')).toBe('https://lerenom.test/');
  });

  it('part de l’adresse de l’environnement, jamais d’une adresse écrite en dur', () => {
    process.env['LERENOM_URL'] = 'https://preprod.lerenom.test';
    expect(canonique('/plombier')).toBe('https://preprod.lerenom.test/plombier');
  });
});

describe('partage', () => {
  it('annonce la même adresse en canonique et en OpenGraph', () => {
    const meta = partage({ titre: 'T', description: 'D', chemin: '/plombier/paris-11?tri=note' });
    expect(meta.alternates.canonical).toBe('https://lerenom.test/plombier/paris-11');
    expect(meta.openGraph.url).toBe(meta.alternates.canonical);
  });
});

describe('jsonLdEntreprise', () => {
  it('décrit une entreprise diffusible avec son adresse et sa position', () => {
    const ld = jsonLdEntreprise(BASE) as Record<string, unknown>;
    expect(ld['@type']).toBe('LocalBusiness');
    expect(ld['address']).toMatchObject({ addressLocality: 'Paris 11e', postalCode: '75011' });
    expect(ld['geo']).toMatchObject({ latitude: 48.85 });
  });

  it('ne publie rien du tout pour une entreprise non diffusible', () => {
    // C'est une obligation, pas une préférence : baliser partiellement rendrait l'adresse
    // réutilisable par des tiers, ce que la non-diffusion interdit précisément.
    expect(jsonLdEntreprise({ ...BASE, diffusible: false })).toBeNull();
  });

  it('n’annonce aucune note quand aucun avis n’est publié', () => {
    const ld = jsonLdEntreprise({ ...BASE, nombreAvis: 0 }) as Record<string, unknown>;
    expect(ld['aggregateRating']).toBeUndefined();
  });

  it('n’annonce aucune note quand la note est absente, même avec des avis comptés', () => {
    const ld = jsonLdEntreprise({ ...BASE, noteMoyenne: null }) as Record<string, unknown>;
    expect(ld['aggregateRating']).toBeUndefined();
  });

  it('omet l’adresse plutôt que de l’inventer quand elle manque', () => {
    const ld = jsonLdEntreprise({ ...BASE, adresse: null }) as Record<string, unknown>;
    expect(ld['address']).toBeUndefined();
    expect(ld['name']).toBe('Plomberie Martin');
  });
});

describe('jsonLdListeResultats', () => {
  it('numérote les positions à partir de 1, dans l’ordre servi', () => {
    const ld = jsonLdListeResultats('Plombiers', [
      { nom: 'A', slug: 'a' },
      { nom: 'B', slug: 'b' },
    ]) as Record<string, unknown>;
    expect(ld['numberOfItems']).toBe(2);
    expect(ld['itemListElement']).toMatchObject([{ position: 1 }, { position: 2 }]);
  });

  it('ne publie pas de liste vide', () => {
    expect(jsonLdListeResultats('Plombiers', [])).toBeNull();
  });
});

describe('aucune adresse de production écrite en dur', () => {
  it('ne trouve `lerenom.fr` nulle part dans le code servi', async () => {
    // Ce contrôle existe parce que le défaut est revenu : la base du site avait été
    // centralisée dans `baseDuSite()`, et le fil d'Ariane publiait malgré tout un
    // `BreadcrumbList` pointant sur `https://lerenom.fr`. Sur une préproduction, cela
    // présente deux sites réclamant les mêmes pages — l'erreur dont on paie les
    // conséquences des mois plus tard, et qu'aucun test ne voyait.
    const racine = new URL('..', import.meta.url).pathname;
    const dossiers = ['app', 'composants', 'lib'];
    const fautifs: string[] = [];

    async function parcours(dossier: string): Promise<void> {
      for (const entree of await readdir(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entree.name);
        if (entree.isDirectory()) {
          await parcours(chemin);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entree.name)) continue;
        // `site.ts` cite l'adresse dans le commentaire qui explique précisément pourquoi
        // elle ne doit pas être écrite en dur. L'interdire là serait absurde.
        if (chemin.endsWith('lib/site.ts')) continue;
        if (chemin.endsWith('referencement-unitaire.test.ts')) continue;
        const contenu = await readFile(chemin, 'utf8');
        if (contenu.includes('lerenom.fr')) fautifs.push(chemin.replace(racine, ''));
      }
    }

    for (const dossier of dossiers) await parcours(join(racine, dossier));
    expect(fautifs).toEqual([]);
  });
});
