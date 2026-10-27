/**
 * Captures d'écran de chaque page, à 390 px (téléphone) et 1440 px (ordinateur).
 *
 * Le script ne se contente pas de photographier : il vérifie, à chaque largeur, qu'aucune page
 * ne déborde horizontalement et qu'aucun élément ne sort du cadre. Une capture jolie dont la
 * page défile latéralement n'est pas un écran fini.
 *
 * Usage : pnpm --filter @lerenom/web captures [adresse]
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3100';
const SORTIE = path.resolve(import.meta.dirname, '../../../docs/captures');

/** Les pages à capturer. `nom` sert de nom de fichier. */
const PAGES = [
  { nom: 'accueil', chemin: '/', titre: 'Accueil' },
  { nom: 'ile-de-france', chemin: '/ile-de-france', titre: 'Île-de-France' },
  { nom: 'departement', chemin: '/seine-saint-denis-93', titre: 'Département' },
  { nom: 'ville', chemin: '/paris-11', titre: 'Ville' },
  { nom: 'metier', chemin: '/plombier', titre: 'Métier' },
  { nom: 'resultats', chemin: '/plombier/paris-11', titre: 'Résultats métier × ville' },
  {
    nom: 'fiche-exclusif',
    chemin: '/entreprise/plomberie-martin-paris-11-80000000100017',
    titre: 'Fiche Exclusif',
  },
  {
    nom: 'fiche-gratuite',
    chemin: '/entreprise/lefevre-sanitaire-paris-11-80000000700011',
    titre: 'Fiche gratuite',
  },
  { nom: 'guide-des-prix', chemin: '/guide-des-prix', titre: 'Guide des prix' },
  { nom: 'pro', chemin: '/pro', titre: 'Professionnels et tarifs' },
  {
    nom: 'comment-nous-classons',
    chemin: '/comment-nous-classons',
    titre: 'Comment nous classons',
  },
  { nom: 'design-system', chemin: '/design', titre: 'Design system' },
];

const LARGEURS = [
  { nom: 'telephone', largeur: 390, hauteur: 844, mobile: true },
  { nom: 'ordinateur', largeur: 1440, hauteur: 900, mobile: false },
];

async function main() {
  await mkdir(SORTIE, { recursive: true });

  // Le conteneur fournit un Chromium à cet emplacement ; ailleurs, Playwright trouve le sien.
  const chemineChromium = '/opt/pw-browsers/chromium';
  const navigateur = await chromium.launch({
    args: ['--no-sandbox', '--headless'],
    ...(existsSync(chemineChromium) ? { executablePath: chemineChromium } : {}),
  });
  const rapport = [];
  let defauts = 0;

  for (const vue of LARGEURS) {
    const contexte = await navigateur.newContext({
      viewport: { width: vue.largeur, height: vue.hauteur },
      deviceScaleFactor: 2,
      isMobile: vue.mobile,
      hasTouch: vue.mobile,
      locale: 'fr-FR',
      // Les animations sont capturées à leur état final : une capture ne doit pas dépendre
      // du moment où l'obturateur se déclenche.
      reducedMotion: 'reduce',
    });

    for (const page of PAGES) {
      const onglet = await contexte.newPage();
      const erreurs = [];
      onglet.on('pageerror', (erreur) => erreurs.push(erreur.message));
      onglet.on('console', (message) => {
        if (message.type() === 'error') erreurs.push(message.text());
      });

      // `networkidle` ne se produit jamais sur une page riche en liens : Next en précharge le
      // rendu dès qu'ils entrent dans le cadre, et la capture pleine page les y fait tous entrer.
      await onglet.goto(`${BASE}${page.chemin}`, { waitUntil: 'load' });
      await onglet.evaluate(() => document.fonts.ready);
      // Le temps que les apparitions échelonnées se posent. Sous `reducedMotion: reduce` elles
      // sont immédiates, mais la mise en page, elle, a besoin d'un souffle.
      await onglet.waitForTimeout(600);

      const controle = await onglet.evaluate(() => {
        const racine = document.documentElement;
        const debordements = [];

        /**
         * Un élément n'est un défaut que s'il dépasse la fenêtre **et** qu'aucun ancêtre ne le
         * rogne. Une illustration volontairement recadrée par `overflow: hidden`, un bandeau
         * défilant ou un filigrane ne sont pas des débordements : ils sont coupés, pas visibles
         * hors cadre. On ignore aussi l'intérieur des SVG, dont le cadrage est géré par
         * `viewBox` et `preserveAspectRatio`.
         */
        const estRogne = (element) => {
          for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (style.overflowX !== 'visible' || style.overflowY !== 'visible') return true;
            if (style.clipPath !== 'none' || style.maskImage !== 'none') return true;
          }
          return false;
        };

        for (const element of document.querySelectorAll('body *')) {
          if (element.closest('svg') !== null) continue;
          const style = getComputedStyle(element);
          if (
            style.position === 'fixed' ||
            style.display === 'none' ||
            style.visibility === 'hidden'
          )
            continue;
          if (style.pointerEvents === 'none') continue;

          const rectangle = element.getBoundingClientRect();
          if (rectangle.width === 0 || rectangle.height === 0) continue;
          if (rectangle.right <= window.innerWidth + 1 && rectangle.left >= -1) continue;
          if (estRogne(element)) continue;

          const nom = element.getAttribute('class') ?? '';
          debordements.push(
            `${element.tagName.toLowerCase()}${nom === '' ? '' : `.${nom.slice(0, 60)}`} → ${Math.round(rectangle.left)}…${Math.round(rectangle.right)}`,
          );
        }

        return {
          // On mesure les deux : `overflow-x: hidden` sur <html> masque le débordement à
          // scrollWidth de la racine, mais pas à celui du corps. C'est le corps qui dit la vérité.
          largeurDocument: Math.max(racine.scrollWidth, document.body.scrollWidth),
          largeurFenetre: window.innerWidth,
          debordements: debordements.slice(0, 8),
          nombreDebordements: debordements.length,
        };
      });

      const fichier = path.join(SORTIE, `${page.nom}-${vue.largeur}.png`);
      await onglet.screenshot({ path: fichier, fullPage: true });

      const defilementHorizontal = controle.largeurDocument > controle.largeurFenetre + 1;
      const probleme =
        defilementHorizontal || controle.nombreDebordements > 0 || erreurs.length > 0;
      if (probleme) defauts += 1;

      rapport.push({
        page: page.titre,
        largeur: vue.largeur,
        fichier: path.basename(fichier),
        defilementHorizontal,
        largeurDocument: controle.largeurDocument,
        largeurFenetre: controle.largeurFenetre,
        debordements: controle.debordements,
        erreursConsole: erreurs,
      });

      const etat = probleme ? '✗' : '✓';
      console.log(`${etat} ${page.titre} — ${vue.largeur} px → ${path.basename(fichier)}`);
      if (defilementHorizontal) {
        console.log(
          `    défilement horizontal : document ${controle.largeurDocument} px pour une fenêtre de ${controle.largeurFenetre} px`,
        );
      }
      for (const debordement of controle.debordements)
        console.log(`    débordement : ${debordement}`);
      for (const erreur of erreurs) console.log(`    erreur console : ${erreur}`);

      await onglet.close();
    }

    await contexte.close();
  }

  await navigateur.close();
  await writeFile(
    path.join(SORTIE, 'rapport.json'),
    `${JSON.stringify(rapport, null, 2)}\n`,
    'utf8',
  );

  if (defauts > 0) {
    console.error(`\n${defauts} capture(s) à corriger.`);
    process.exitCode = 1;
  } else {
    console.log(`\n${rapport.length} captures vérifiées, aucun débordement.`);
  }
}

await main();
