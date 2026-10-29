/**
 * Lighthouse mobile sur les pages publiques.
 *
 * La porte de validation de la phase 2 exige « Lighthouse mobile ≥ 90 ». Elle n'avait jamais
 * été franchie, faute d'être mesurée : une exigence qu'on ne mesure pas est un souhait.
 *
 * ## Deux pièges, appris en la mesurant la première fois
 *
 * **Le serveur doit tourner en `LERENOM_ENV=production`.** Hors production, `robots.ts`
 * interdit l'indexation de tout le site — à juste titre, une préproduction n'a rien à faire
 * dans un moteur de recherche. Mesuré en développement, le référencement tombe à 63 et le
 * seul grief est « page bloquée à l'indexation ». On mesurerait le réglage, pas la page.
 *
 * **Le contraste se juge contre le fond le plus foncé**, pas contre le blanc. Le site pose
 * ses textes sur quatre fonds clairs ; viser le blanc laisse passer des couleurs qui échouent
 * sur le crème des puces. C'est l'erreur commise ici une première fois.
 *
 * ## Ce que le rapport ne compte pas comme un défaut
 *
 * Un filigrane décoratif, `aria-hidden` et sans interaction possible, est signalé par axe pour
 * son contraste. Il est fait pour ne pas se lire — c'est une texture, pas un texte. Le score
 * d'accessibilité plafonne donc à 96 sur les pages qui en portent un, et ce n'est pas un
 * défaut à corriger : le ramener à 100 demanderait de déformer un élément dont le rôle est
 * d'être invisible.
 *
 * Usage :
 *   LERENOM_ENV=production pnpm --filter @lerenom/web start   # dans un autre terminal
 *   node scripts/lighthouse.mjs [adresse]
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3100';
const SEUIL = 90;
const SORTIE = path.resolve(import.meta.dirname, '../docs/lighthouse');

/**
 * Les pages mesurées : une de chaque forme, pas toutes les adresses.
 *
 * Mesurer 1 730 pages n'apprendrait rien de plus — les pages ville se ressemblent toutes. Ce
 * qu'il faut couvrir, ce sont les **gabarits** : chacun a sa composition, ses images et ses
 * scripts.
 */
const PAGES = [
  { nom: 'accueil', chemin: '/' },
  { nom: 'ile-de-france', chemin: '/ile-de-france' },
  { nom: 'departement', chemin: '/seine-saint-denis-93' },
  { nom: 'ville', chemin: '/paris-11' },
  { nom: 'metier', chemin: '/plombier' },
  { nom: 'resultats', chemin: '/plombier/paris-11' },
  { nom: 'fiche', chemin: '/entreprise/plomberie-martin-paris-11-80000000100017' },
  { nom: 'guide-des-prix', chemin: '/guide-des-prix' },
  { nom: 'pro', chemin: '/pro' },
  { nom: 'demande', chemin: '/demande' },
];

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

/** Les griefs d'une catégorie, hors ceux que ce projet a examinés et écartés. */
function griefs(resultat, categorie) {
  return resultat.categories[categorie].auditRefs
    .map((reference) => resultat.audits[reference.id])
    .filter((audit) => audit.score !== null && audit.score < 0.9)
    .map((audit) => audit.title);
}

await mkdir(SORTIE, { recursive: true });

const lignes = [];
let echec = false;

{
  for (const page of PAGES) {
    const adresse = `${BASE}${page.chemin}`;

    // Un navigateur neuf par page. Mesurer dix pages dans une même instance fait dériver les
    // scores : l'accueil rendait 94 seul et 87 en huitième position, sur la même
    // construction. Ce n'est pas la page qui change, c'est la machine qui se fatigue — et un
    // chiffre qui dépend de l'ordre de passage ne mesure rien.
    const navigateur = await launch({
      chromePath: process.env['CHROME_PATH'] ?? '/opt/pw-browsers/chromium',
      chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
    });

    let rapport;
    try {
      rapport = await lighthouse(adresse, {
        port: navigateur.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: CATEGORIES,
      });
    } finally {
      await navigateur.kill();
    }
    if (rapport === undefined) throw new Error(`aucun rapport pour ${adresse}`);

    const scores = Object.fromEntries(
      CATEGORIES.map((categorie) => [
        categorie,
        Math.round((rapport.lhr.categories[categorie]?.score ?? 0) * 100),
      ]),
    );
    const sousLeSeuil = CATEGORIES.filter((categorie) => scores[categorie] < SEUIL);
    if (sousLeSeuil.length > 0) echec = true;

    lignes.push({ ...page, scores, sousLeSeuil });
    await writeFile(path.join(SORTIE, `${page.nom}.json`), rapport.report, 'utf8');

    const colonnes = CATEGORIES.map((c) => String(scores[c]).padStart(3)).join('  ');
    const marque = sousLeSeuil.length === 0 ? '\u001b[0;32m✓\u001b[0m' : '\u001b[0;31m✗\u001b[0m';
    process.stdout.write(`${marque} ${colonnes}  ${page.nom}\n`);
    for (const categorie of sousLeSeuil) {
      for (const grief of griefs(rapport.lhr, categorie)) {
        process.stdout.write(`      · ${categorie} — ${grief}\n`);
      }
    }
  }
}

process.stdout.write(`\n  perf  a11y  bonnes  seo   (seuil ${String(SEUIL)})\n`);
if (echec) {
  process.stderr.write('\n\u001b[0;31mAu moins une page sous le seuil.\u001b[0m\n');
  process.exit(1);
}
process.stdout.write('\n\u001b[0;32mToutes les pages au-dessus du seuil.\u001b[0m\n');
