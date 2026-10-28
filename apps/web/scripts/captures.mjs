/**
 * Captures d'écran de chaque page, à 390 px (téléphone) et 1440 px (ordinateur).
 *
 * Le script ne se contente pas de photographier : il vérifie, à chaque largeur, qu'aucune page
 * ne déborde horizontalement et qu'aucun élément ne sort du cadre. Une capture jolie dont la
 * page défile latéralement n'est pas un écran fini.
 *
 * Usage : pnpm --filter @lerenom/web captures [adresse]
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3100';
/**
 * Un filtre facultatif sur le nom des captures.
 *
 * Reprendre les cinquante-quatre captures pour vérifier un seul écran coûte un quart d'heure,
 * et ce coût décourage exactement ce qu'il faudrait faire souvent : regarder.
 *
 *   node scripts/captures.mjs http://127.0.0.1:3100 inscription
 */
const FILTRE = process.argv[3] ?? '';
const SORTIE = path.resolve(import.meta.dirname, '../../../docs/captures');

/**
 * Les jetons des pages client de démonstration.
 *
 * Ces pages n'ont pas d'adresse devinable : elles s'ouvrent avec un jeton qui n'existe en clair
 * qu'une fois. `pnpm --filter @lerenom/db demo:suivi` en fabrique et les écrit à la racine ;
 * sans eux, ces pages ne peuvent pas être photographiées, et le script le dit au lieu de
 * l'ignorer.
 */
function jeton(nom) {
  const variable = process.env[`JETON_${nom.toUpperCase()}`];
  if (variable !== undefined && variable !== '') return variable.trim();

  const fichier = path.resolve(import.meta.dirname, `../../../.jeton-${nom}`);
  if (!existsSync(fichier)) return null;
  const contenu = readFileSync(fichier, 'utf8').trim();
  return contenu === '' ? null : contenu;
}

function cheminDeSuivi() {
  const valeur = jeton('suivi');
  return valeur === null ? null : `/suivi/${valeur}`;
}

function cheminDAvis() {
  const valeur = jeton('avis');
  return valeur === null ? null : `/suivi/${valeur}`;
}

/**
 * Les identifiants du compte de démonstration professionnel.
 *
 * `pnpm --filter @lerenom/db demo:pro` le crée. Les captures de l'espace pro passent par une
 * vraie connexion : photographier un écran protégé sans s'y connecter reviendrait à
 * photographier autre chose que ce que verra l'artisan.
 */
const COMPTE_PRO = {
  email: process.env.PRO_EMAIL ?? 'demo@lerenom.exemple',
  motDePasse: process.env.PRO_MOT_DE_PASSE ?? 'le chat dort sur le toit',
};

/** Se connecte à l'espace professionnel, une fois par contexte de navigation. */
async function connecteLEspacePro(onglet) {
  await onglet.goto(`${BASE}/pro/connexion`, { waitUntil: 'load' });
  await onglet.getByLabel('Adresse électronique').fill(COMPTE_PRO.email);
  await onglet.getByLabel('Mot de passe').fill(COMPTE_PRO.motDePasse);
  await onglet.getByRole('button', { name: 'Se connecter' }).click();
  await onglet.waitForURL('**/pro/espace', { timeout: 15_000 });
}

function cheminDeConfirmation() {
  const valeur = jeton('confirmation');
  return valeur === null ? null : `/suivi/${valeur}`;
}

/**
 * Mène le tunnel de demande jusqu'à l'écran de vérification du mobile.
 *
 * Cet écran n'a pas d'adresse propre : on n'y arrive qu'en remplissant les quatre étapes. Le
 * capturer suppose donc de les jouer, et c'est tant mieux — le tunnel est vérifié de bout en
 * bout par la même occasion.
 *
 * Chaque passage tire un numéro différent dans la plage réservée 06 12 99 xx xx : le garde
 * anti-doublon de l'API refuse la même prestation, dans la même ville, depuis le même mobile
 * sur sept jours — et il a raison. Rejouer les captures ne doit pas buter sur cette règle.
 */
function mobileDeCapture() {
  const quatre = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, '0');
  return `06 12 99 ${quatre.slice(0, 2)} ${quatre.slice(2)}`;
}

async function jusquALaVerification(onglet) {
  const suivant = async () => {
    await onglet.getByRole('button', { name: 'Continuer' }).click();
    await onglet.waitForTimeout(250);
  };

  // 1. Service : on cherche une prestation et on prend la première proposition.
  await onglet.getByLabel('Rechercher une prestation').fill('serrure');
  await onglet.waitForTimeout(350);
  await onglet.locator('ul li button').first().click();
  await suivant();

  // 2. Détails : la description suffit, les questions sont facultatives.
  await onglet
    .getByRole('textbox')
    .last()
    .fill(
      'La serrure de la porte d’entrée tourne dans le vide depuis hier soir, ' +
        'la porte ne se verrouille plus.',
    );
  await suivant();

  // 3. Où et quand : la recherche de ville passe par l'API, il faut la laisser répondre.
  await onglet.getByLabel('Ville').fill('Paris 11');
  await onglet.waitForTimeout(900);
  await onglet.locator('ul li button').first().click();
  await suivant();

  // 4. Coordonnées.
  await onglet.getByLabel('Prénom').fill('Camille');
  await onglet.getByLabel('Mobile').fill(mobileDeCapture());
  await onglet.getByLabel('Adresse électronique').fill('camille.captures@exemple.fr');
  await onglet.locator('input[type=checkbox]').check();
  await onglet.getByRole('button', { name: 'Envoyer ma demande' }).click();

  // 5. L'écran attendu : le champ du code.
  await onglet.getByLabel('Code de vérification à 6 chiffres').waitFor({ timeout: 15_000 });
  // Un code complet : la capture doit montrer le bouton dans son état actif.
  await onglet.getByLabel('Code de vérification à 6 chiffres').fill('123456');
  await onglet.waitForTimeout(200);
}

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
  {
    nom: 'resultats-filtres',
    chemin: '/plombier/paris-11?partenaires=1&tri=note',
    titre: 'Résultats filtrés',
  },
  { nom: 'demande', chemin: '/demande', titre: 'Demande de devis' },
  {
    nom: 'demande-verification',
    chemin: '/demande',
    titre: 'Demande — vérification du mobile',
    scenario: jusquALaVerification,
  },
  {
    nom: 'suivi',
    titre: 'Suivi de la demande',
    chemin: cheminDeSuivi,
  },
  {
    nom: 'confirmation-intervention',
    titre: 'L’intervention a-t-elle eu lieu ?',
    chemin: cheminDeConfirmation,
  },
  {
    nom: 'confirmation-non',
    titre: 'Intervention non réalisée',
    chemin: cheminDeConfirmation,
    // On ouvre le volet « non » sans valider : la démonstration doit rester rejouable.
    scenario: async (onglet) => {
      await onglet.getByRole('button', { name: /Non, et ce n’est plus prévu/ }).click();
      await onglet.getByLabel(/Que s’est-il passé/).waitFor();
      await onglet
        .getByLabel(/Que s’est-il passé/)
        .fill('Il n’est jamais venu malgré deux rendez-vous fixés.');
      await onglet.waitForTimeout(200);
    },
  },
  {
    nom: 'avis',
    titre: 'Dépôt d’un avis',
    chemin: cheminDAvis,
  },
  {
    nom: 'avis-rempli',
    titre: 'Dépôt d’un avis — rempli',
    chemin: cheminDAvis,
    // Noté et commenté, sans envoyer : la démonstration doit rester rejouable.
    scenario: async (onglet) => {
      await onglet.getByRole('radio', { name: '4 sur 5' }).first().click();
      const criteres = onglet.getByRole('radiogroup');
      await criteres.nth(1).getByRole('radio', { name: '5 sur 5' }).click();
      await criteres.nth(2).getByRole('radio', { name: '3 sur 5' }).click();
      await criteres.nth(3).getByRole('radio', { name: '4 sur 5' }).click();
      await criteres.nth(4).getByRole('radio', { name: '4 sur 5' }).click();
      await onglet
        .getByLabel('Votre commentaire (facultatif)')
        .fill(
          'Intervention le jour même, travail soigné et chantier laissé propre. ' +
            'Un peu de retard le matin, prévenu par SMS.',
        );
      await onglet.waitForTimeout(200);
    },
  },
  {
    nom: 'suivi-annulation',
    titre: 'Suivi — annulation',
    chemin: cheminDeSuivi,
    // On ouvre le volet de confirmation sans confirmer : la demande de démonstration doit
    // rester vivante pour la capture suivante.
    scenario: async (onglet) => {
      await onglet.getByRole('button', { name: 'Annuler ma demande' }).click();
      await onglet.getByText('Annuler définitivement cette demande ?').waitFor();
      await onglet.waitForTimeout(200);
    },
  },
  { nom: 'pro-inscription', chemin: '/pro/inscription', titre: 'Inscription professionnelle' },
  {
    nom: 'pro-inscription-verification',
    chemin: '/pro/inscription',
    titre: 'Inscription — identité et mot de passe',
    // On s'arrête avant d'envoyer : la capture doit rester rejouable, et rien ne doit être
    // écrit en base par une prise de vue.
    scenario: async (onglet) => {
      await remplitIdentite(onglet);
      await onglet.waitForTimeout(200);
    },
  },
  {
    nom: 'pro-inscription-recapitulatif',
    chemin: '/pro/inscription',
    titre: 'Inscription — récapitulatif avant validation',
    scenario: async (onglet) => {
      await remplitIdentite(onglet);
      await onglet.getByRole('button', { name: 'Continuer' }).click();

      // Métiers : les deux premiers de l'univers affiché. Le premier coché devient le métier
      // principal, ce que l'écran annonce dès qu'un métier est choisi.
      const metiers = onglet.getByRole('group', { name: 'Métiers de l’univers choisi' });
      await metiers.getByRole('button').nth(0).click();
      await metiers.getByRole('button').nth(1).click();
      await onglet.getByRole('button', { name: 'Continuer' }).click();

      // Villes : les trois premières du département affiché, pour que la formule choisie en
      // retire une et que le récapitulatif montre l'ajustement.
      const villes = onglet.getByRole('list', { name: 'Villes du département choisi' });
      await villes.getByRole('button').nth(0).click();
      await villes.getByRole('button').nth(1).click();
      await villes.getByRole('button').nth(2).click();
      await onglet.getByRole('button', { name: 'Continuer' }).click();

      await onglet
        .getByLabel('Présentation de votre entreprise')
        .fill(
          'Entreprise familiale installée dans le 11e depuis 1998. Recherche de fuite, ' +
            'dépannage d’urgence et rénovation complète de salle de bain.',
        );
      await onglet.getByRole('button', { name: 'Continuer' }).click();
      await onglet.getByRole('button', { name: 'Continuer' }).click();
      await onglet.getByText('Vérifiez avant de valider').waitFor();
      await onglet.waitForTimeout(250);
    },
  },
  { nom: 'design-system', chemin: '/design', titre: 'Design system' },
  { nom: 'pro-connexion', chemin: '/pro/connexion', titre: 'Connexion professionnelle' },
  {
    nom: 'pro-tableau-de-bord',
    chemin: '/pro/espace',
    titre: 'Espace pro — tableau de bord',
    connexionPro: true,
  },
  {
    nom: 'pro-demandes',
    chemin: '/pro/espace/demandes',
    titre: 'Espace pro — demandes à répondre',
    connexionPro: true,
  },
  {
    nom: 'pro-demandes-acceptees',
    chemin: '/pro/espace/demandes',
    titre: 'Espace pro — demandes acceptées',
    connexionPro: true,
    scenario: async (onglet) => {
      await onglet.getByRole('tab', { name: /Acceptées/ }).click();
      await onglet.waitForTimeout(250);
    },
  },
  {
    nom: 'pro-refus',
    chemin: '/pro/espace/demandes',
    titre: 'Espace pro — motif de refus',
    connexionPro: true,
    scenario: async (onglet) => {
      await onglet.getByRole('button', { name: 'Refuser' }).first().click();
      await onglet.getByText('Pourquoi refusez-vous ?').waitFor();
      await onglet.waitForTimeout(200);
    },
  },
];

/**
 * Les deux premières étapes de l'inscription, remplies.
 *
 * Le SIRET est celui d'une société fictive dont la clé de Luhn est juste : le formulaire la
 * vérifie côté navigateur, une saisie fausse resterait bloquée à l'étape 1.
 */
async function remplitIdentite(onglet) {
  await onglet.getByLabel('Numéro SIRET').fill('73282932000074');
  await onglet.getByLabel('Nom de l’entreprise').fill('Dupont Plomberie');
  await onglet.getByRole('button', { name: 'Continuer' }).click();

  await onglet.getByLabel('Adresse électronique professionnelle').fill('gerant@exemple.test');
  await onglet.getByLabel('Téléphone').fill('01 99 00 00 12');
  await onglet.getByLabel('Mot de passe', { exact: true }).fill('la pluie tombe sur les toits');
  await onglet.getByLabel('Répétez le mot de passe').fill('la pluie tombe sur les toits');
}

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
  const manquantes = new Set();
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
      if (FILTRE !== '' && !page.nom.includes(FILTRE)) continue;
      const chemin = typeof page.chemin === 'function' ? page.chemin() : page.chemin;
      if (chemin === null) {
        manquantes.add(page.titre);
        continue;
      }

      const onglet = await contexte.newPage();

      // Les écrans protégés se photographient connecté. La session reste dans le contexte,
      // donc la connexion n'a lieu qu'une fois par largeur.
      if (page.connexionPro === true && !contexte.__proConnecte) {
        try {
          await connecteLEspacePro(onglet);
          contexte.__proConnecte = true;
        } catch (erreur) {
          console.error(`    connexion professionnelle impossible : ${erreur.message}`);
        }
      }
      const erreurs = [];
      onglet.on('pageerror', (erreur) => erreurs.push(erreur.message));
      onglet.on('console', (message) => {
        if (message.type() === 'error') erreurs.push(message.text());
      });

      // `networkidle` ne se produit jamais sur une page riche en liens : Next en précharge le
      // rendu dès qu'ils entrent dans le cadre, et la capture pleine page les y fait tous entrer.
      await onglet.goto(`${BASE}${chemin}`, { waitUntil: 'load' });
      await onglet.evaluate(() => document.fonts.ready);
      // Le temps que les apparitions échelonnées se posent. Sous `reducedMotion: reduce` elles
      // sont immédiates, mais la mise en page, elle, a besoin d'un souffle.
      await onglet.waitForTimeout(600);

      // Certains écrans ne s'atteignent qu'en agissant : on joue le scénario avant de mesurer.
      if (page.scenario !== undefined) {
        try {
          await page.scenario(onglet);
        } catch (erreur) {
          erreurs.push(`scénario interrompu : ${erreur.message}`);
        }
      }

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

  if (manquantes.size > 0) {
    console.error(
      `\n${manquantes.size} page(s) non capturée(s), faute de données : ${[...manquantes].join(', ')}.` +
        '\n    La page de suivi exige un lien : pnpm --filter @lerenom/db demo:suivi',
    );
    process.exitCode = 1;
  }

  if (defauts > 0) {
    console.error(`\n${defauts} capture(s) à corriger.`);
    process.exitCode = 1;
  } else if (manquantes.size === 0) {
    console.log(`\n${rapport.length} captures vérifiées, aucun débordement.`);
  }
}

await main();
