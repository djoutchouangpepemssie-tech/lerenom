#!/usr/bin/env node
/**
 * Quelles routes personne n'appelle, et quels appels ne mènent nulle part ?
 *
 * Le pendant de `tables-orphelines.mjs`, appliqué à l'autre bout de la chaîne. L'audit des
 * tables a trouvé des règles écrites et jamais exécutées ; celui-ci cherche les deux
 * symétries côté interface :
 *
 * - **une route que rien n'appelle** est du code qu'on maintient, qu'on déploie et qu'on
 *   expose sans que personne s'en serve. Exposée, elle reste une porte : elle mérite au moins
 *   qu'on sache qu'elle est là ;
 * - **un appel vers une route absente** est un bouton qui échoue en silence chez le visiteur.
 *   C'est le plus grave des deux, et le plus difficile à voir : tout compile, tout se
 *   construit, et l'erreur n'apparaît qu'au clic.
 *
 * Le contrôle ne tranche pas, il liste — certaines routes sont appelées par un service
 * extérieur, par un courriel ou à la main, et c'est légitime. Un fichier d'attendus les porte
 * avec leur raison.
 *
 * Usage : node outils/routes-orphelines.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const RACINE = new URL('..', import.meta.url).pathname;
const APP = join(RACINE, 'apps/web/app');

/** Les routes légitimement appelées autrement que par un écran. */
const ATTENDUS = {
  '/api/mesure/clic':
    'Appelée par `sendBeacon` depuis la liste de résultats, invisible à une recherche de `fetch`.',
};

/** Les segments dynamiques deviennent un joker : `[id]` peut valoir n'importe quoi. */
function motifDeRoute(chemin) {
  return new RegExp(
    `^${chemin
      .split('/')
      .map((segment) =>
        /^\[\.\.\..+\]$/.test(segment)
          ? '.+'
          : /^\[.+\]$/.test(segment)
            ? '[^/]+'
            : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('/')}$`,
  );
}

async function parcours(dossier, prefixe, routes) {
  let entrees;
  try {
    entrees = await readdir(dossier, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entree of entrees) {
    if (entree.isDirectory()) {
      // Un groupe de routes — `(public)` — n'apparaît pas dans l'adresse.
      const segment = /^\(.+\)$/.test(entree.name) ? '' : `/${entree.name}`;
      await parcours(join(dossier, entree.name), `${prefixe}${segment}`, routes);
    } else if (entree.name === 'route.ts') {
      const contenu = await readFile(join(dossier, entree.name), 'utf8');
      const methodes = [...contenu.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)]
        .map((m) => m[1])
        .sort();
      routes.push({ chemin: prefixe === '' ? '/' : prefixe, methodes });
    }
  }
}

async function fichiersSource() {
  const trouves = [];
  async function marche(dossier) {
    let entrees;
    try {
      entrees = await readdir(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entree of entrees) {
      const chemin = join(dossier, entree.name);
      if (chemin.includes('/node_modules/') || chemin.includes('/.next/')) continue;
      if (entree.isDirectory()) await marche(chemin);
      else if (/\.(ts|tsx|mjs)$/.test(entree.name)) trouves.push(chemin);
    }
  }
  for (const dossier of [
    'apps/web/app',
    'apps/web/composants',
    'apps/web/lib',
    'apps/web/scripts',
  ]) {
    await marche(join(RACINE, dossier));
  }
  return trouves;
}

async function principal() {
  const routes = [];
  await parcours(join(APP, 'api'), '/api', routes);
  routes.sort((a, b) => a.chemin.localeCompare(b.chemin));

  const chemins = await fichiersSource();
  const contenus = await Promise.all(
    chemins.map(async (chemin) => ({ chemin, texte: await readFile(chemin, 'utf8') })),
  );

  // Toutes les adresses citées dans le code, quelle que soit la façon de les appeler.
  //
  // **Les gabarits d'abord.** La première version excluait l'accolade fermante du jeu de
  // caractères admis, si bien que `` `/api/pro/factures/${id}/pdf` `` n'était pas reconnu du
  // tout : l'outil déclarait « jamais appelées » seize routes dont la plupart le sont par un
  // bouton, avec un identifiant interpolé. Une adresse d'interface sans partie variable est
  // l'exception, pas la règle.
  const citees = new Set();
  for (const { chemin, texte } of contenus) {
    if (chemin.endsWith('route.ts')) continue;
    // La capture va jusqu'au guillemet **de même nature**, au lieu d'exclure une liste de
    // caractères. L'exclusion s'arrêtait à la parenthèse de `encodeURIComponent(texte)` à
    // l'intérieur du gabarit, et tronquait l'adresse avant sa fin.
    for (const occurrence of texte.matchAll(/(['"`])(\/api\/[^'"`\s]*?)\1/g)) {
      // La chaîne de requête et l'ancre ne font pas partie du chemin. Sans ce retrait,
      // `/api/recherche?genre=…&q=…` ne correspondait à aucune route, et la barre de
      // recherche de l'accueil passait pour du code mort.
      const adresse = occurrence[2]
        .replace(/\$\{[^}]*\}/g, '*')
        .split('?')[0]
        .split('#')[0];
      // `'/api/'` tout court n'est pas un appel : c'est le préfixe que le fichier robots
      // interdit aux moteurs. Le compter ferait croire à un bouton vers nulle part.
      if (adresse === '/api/' || adresse === '/api') continue;
      citees.add(adresse);
    }
  }

  const jamaisAppelees = routes.filter(
    (route) =>
      ![...citees].some((citee) => motifDeRoute(route.chemin).test(citee.replace(/\*/g, 'x'))),
  );

  const versLeVide = [...citees].filter(
    (citee) => !routes.some((route) => motifDeRoute(route.chemin).test(citee.replace(/\*/g, 'x'))),
  );

  console.log(`Routes déclarées — ${routes.length}`);
  for (const route of routes) console.log(`  ${route.methodes.join(' ')} ${route.chemin}`);

  console.log(`\nJamais appelées par un écran — ${jamaisAppelees.length}`);
  console.log('  Du code déployé et exposé dont personne ne se sert.');
  for (const route of jamaisAppelees) {
    const raison = ATTENDUS[route.chemin];
    console.log(
      `  ${raison === undefined ? '•' : '◦'} ${route.chemin}${raison === undefined ? '' : `\n      attendu : ${raison}`}`,
    );
  }

  console.log(`\nAppels vers une route absente — ${versLeVide.length}`);
  console.log('  Un bouton qui échoue en silence chez le visiteur. Tout compile pourtant.');
  for (const citee of versLeVide) console.log(`  • ${citee}`);

  const inattendues = jamaisAppelees.filter((r) => ATTENDUS[r.chemin] === undefined);
  console.log(
    `\n${inattendues.length === 0 && versLeVide.length === 0 ? 'Rien d’inattendu.' : `${inattendues.length + versLeVide.length} point(s) à regarder.`}`,
  );
  console.log('◦ = absence connue et consignée · • = à regarder');

  // Sortie non nulle, pour les mêmes raisons que l'audit des tables. Un appel vers une route
  // absente est un bouton qui échoue chez le visiteur sans que rien ne compile de travers :
  // c'est précisément ce qu'une porte de validation doit attraper.
  if (inattendues.length > 0 || versLeVide.length > 0) process.exitCode = 1;
}

await principal();
