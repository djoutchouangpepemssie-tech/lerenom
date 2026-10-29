#!/usr/bin/env node
/**
 * Quelles tables personne ne lit, et lesquelles personne n'écrit ?
 *
 * Ce contrôle existe parce que la même question, posée à la main, a trouvé sept défauts de
 * suite : une entreprise non vérifiée recevait des demandes, aucun avis n'était jamais
 * publié, la note moyenne ne se recalculait pas, un Premium occupait une place partout au
 * lieu de là où il l'avait achetée, aucun réglage ne pouvait changer, rien ne comptait les
 * affichages, aucune liste d'attente ne recueillait la demande.
 *
 * À chaque fois, le même motif : **le modèle prévoyait la règle, un commentaire la décrivait,
 * et rien ne l'exécutait.** Une table jamais lue est une intention ; une table jamais écrite
 * est une promesse. Les deux se repèrent mécaniquement, et le faire à la main ne tient pas
 * sur la durée — on cherche là où l'on travaille, pas là où l'on a oublié.
 *
 * Le contrôle ne tranche pas : il **liste**. Certaines tables sont légitimement en attente
 * d'un raccordement externe, et le dire est le travail de `docs/QUESTIONS.md`, pas d'un
 * script. Un fichier d'attendus les porte, chacune avec sa raison.
 *
 * Usage : node outils/tables-orphelines.mjs [--json]
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const RACINE = new URL('..', import.meta.url).pathname;

/**
 * Les tables dont l'absence de lecture ou d'écriture est connue et assumée.
 *
 * Chaque entrée porte sa raison et le numéro de la question ouverte qui en dépend. Une
 * entrée sans raison serait pire que pas d'entrée du tout : elle ferait taire le contrôle
 * sans que personne sache pourquoi.
 */
const ATTENDUS = {
  Appel: 'Q43 — demande des numéros de suivi, donc un opérateur téléphonique non raccordé.',
  FactureLeRenom: 'Q44 — Le Renom ne facture personne tant que rien n’encaisse.',
  Recredit: 'Q37 — trancher une contestation engage un recrédit, et rien ne verse encore.',
  SignalementAvis: 'Q38 — rien ne permet encore de signaler un avis publié.',
  CampagnePub: 'Phase ultérieure : la régie publicitaire n’est pas ouverte.',
  DemandeRgpd: 'Les demandes RGPD arrivent par courriel et se traitent à la main.',
};

/** Les répertoires où du code applicatif lit et écrit. */
const SOURCES = ['apps/web/app', 'apps/web/lib', 'apps/worker/src', 'packages'];

/** Ce qui n'est pas du code applicatif : client généré, tests, semis, scripts jetables. */
function aIgnorer(chemin) {
  return (
    chemin.includes('/src/genere/') ||
    chemin.includes('/node_modules/') ||
    chemin.includes('/.next/') ||
    /\.test\.tsx?$/.test(chemin)
  );
}

/** Les semis et scripts de démonstration : ils écrivent, mais ce n'est pas le produit. */
function estSemis(chemin) {
  return chemin.includes('/prisma/') && /seed|demo|applique-sql/.test(chemin);
}

async function fichiers(dossier) {
  const trouves = [];
  async function parcours(courant) {
    let entrees;
    try {
      entrees = await readdir(courant, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entree of entrees) {
      const chemin = join(courant, entree.name);
      if (aIgnorer(chemin)) continue;
      if (entree.isDirectory()) await parcours(chemin);
      else if (/\.tsx?$/.test(entree.name)) trouves.push(chemin);
    }
  }
  await parcours(join(RACINE, dossier));
  return trouves;
}

/**
 * Les modèles du schéma, et par quels noms on peut les atteindre.
 *
 * Deux façons d'accéder à une table, et la première version de ce script n'en voyait qu'une.
 *
 * - **L'accesseur direct** : `prisma.commune.findMany`.
 * - **Les relations** : `include: { commune: true }` depuis une autre table. Ce sont de
 *   vraies lectures, et les ignorer faisait passer `Commune` et `Departement` pour des
 *   tables que personne ne lit — alors que chaque page de résultats les lit.
 *
 * Les noms de relation sont tirés du schéma lui-même : chaque champ dont le type est un
 * modèle est un chemin d'accès vers lui.
 */
async function modeles() {
  const schema = await readFile(join(RACINE, 'packages/db/prisma/schema.prisma'), 'utf8');
  const noms = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  const connus = new Set(noms);

  /** Pour chaque modèle, les noms de champ par lesquels d'autres modèles le désignent. */
  const relations = new Map(noms.map((nom) => [nom, new Set()]));
  for (const bloc of schema.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm)) {
    for (const ligne of bloc[1].split('\n')) {
      const champ = /^\s*(\w+)\s+(\w+)(\[\])?\s*\??/.exec(ligne);
      if (champ === null) continue;
      const [, nomChamp, type] = champ;
      if (!connus.has(type)) continue;
      relations.get(type).add(nomChamp);
    }
  }

  return { noms, relations };
}

/** `Entreprise` → `entreprise`, `FactureLeRenom` → `factureLeRenom`. */
function accesseur(modele) {
  return modele.charAt(0).toLowerCase() + modele.slice(1);
}

const LECTURES = [
  'findMany',
  'findFirst',
  'findUnique',
  'findUniqueOrThrow',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
];
const ECRITURES = [
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
];

async function principal() {
  const { noms, relations } = await modeles();
  const chemins = (await Promise.all(SOURCES.map(fichiers))).flat();
  const contenus = await Promise.all(
    chemins.map(async (chemin) => ({ chemin, texte: await readFile(chemin, 'utf8') })),
  );

  const rapport = noms.map((modele) => {
    const cle = accesseur(modele);
    // `prisma.x.` et `tx.x.` : la seconde forme est celle des transactions, et l'oublier
    // avait failli me faire conclure que les quotas n'étaient jamais incrémentés.
    const motif = new RegExp(`\\b(?:prisma|tx|transaction)\\.${cle}\\.(\\w+)`, 'g');
    const lu = new Set();
    const ecrit = new Set();
    // Le référentiel — communes, départements, catalogue, prix — est écrit par le semis et
    // par lui seul, à dessein. Le confondre avec une table que le produit devrait écrire
    // noyait les vrais défauts sous une douzaine de faux.
    const parLeSemis = new Set();

    // Une lecture par relation : `commune: { select: … }` ou `commune: true` dans un
    // `include`. Le motif est volontairement large — on cherche à savoir si la table est
    // atteinte, pas à compter précisément les appels.
    const parRelation =
      [...relations.get(modele)].length === 0
        ? null
        : new RegExp(`\\b(?:${[...relations.get(modele)].join('|')})\\s*:\\s*(?:true|\\{)`);

    // Le SQL brut échappe à tout accesseur. `Affichage` est écrite par un `INSERT … ON
    // CONFLICT` groupé, et le script la déclarait « jamais écrite ».
    const nomTable = new RegExp(
      `(?:INSERT INTO|UPDATE|DELETE FROM)\\s+${modele.toLowerCase()}s?\\b`,
      'i',
    );

    // L'écriture imbriquée : `lignes: { create: … }` posé à l'intérieur d'un
    // `facture.create`. C'est la façon idiomatique d'écrire les lignes filles avec Prisma,
    // et le script déclarait `FactureLigne` « jamais écrite » sur un produit de
    // facturation — le genre de conclusion qui fait perdre une heure, puis la confiance
    // qu'on accorde à l'outil.
    const imbriquee =
      [...relations.get(modele)].length === 0
        ? null
        : new RegExp(
            `\\b(?:${[...relations.get(modele)].join('|')})\\s*:\\s*\\{\\s*(?:create|connectOrCreate|createMany|updateMany|deleteMany|set|upsert)\\b`,
          );

    for (const { chemin, texte } of contenus) {
      const ou = chemin.replace(RACINE, '');
      for (const occurrence of texte.matchAll(motif)) {
        const methode = occurrence[1];
        if (LECTURES.includes(methode)) lu.add(ou);
        else if (ECRITURES.includes(methode)) {
          if (estSemis(chemin)) parLeSemis.add(ou);
          else ecrit.add(ou);
        }
      }
      if (parRelation !== null && parRelation.test(texte)) lu.add(`${ou} (relation)`);
      if (nomTable.test(texte) && !estSemis(chemin)) ecrit.add(`${ou} (SQL)`);
      if (imbriquee !== null && imbriquee.test(texte)) {
        if (estSemis(chemin)) parLeSemis.add(`${ou} (imbriquée)`);
        else ecrit.add(`${ou} (imbriquée)`);
      }
    }

    return { modele, lu: [...lu], ecrit: [...ecrit], parLeSemis: [...parLeSemis] };
  });

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rapport, null, 2));
    return;
  }

  const muettes = rapport.filter(
    (r) => r.lu.length === 0 && r.ecrit.length === 0 && r.parLeSemis.length === 0,
  );
  const jamaisLues = rapport.filter((r) => r.lu.length === 0 && r.ecrit.length > 0);
  const jamaisEcrites = rapport.filter(
    (r) => r.ecrit.length === 0 && r.parLeSemis.length === 0 && r.lu.length > 0,
  );
  const referentiel = rapport.filter(
    (r) => r.ecrit.length === 0 && r.parLeSemis.length > 0 && r.lu.length > 0,
  );

  const montre = (titre, explication, lignes) => {
    console.log(`\n${titre} — ${lignes.length}`);
    console.log(`  ${explication}`);
    for (const { modele } of lignes) {
      const raison = ATTENDUS[modele];
      console.log(
        `  ${raison === undefined ? '•' : '◦'} ${modele}${raison === undefined ? '' : `\n      attendu : ${raison}`}`,
      );
    }
  };

  montre('Ni lues ni écrites', 'Le modèle existe, le produit l’ignore entièrement.', muettes);
  montre(
    'Écrites mais jamais lues',
    'On enregistre une donnée que personne ne consulte : du travail et du stockage pour rien.',
    jamaisLues,
  );
  montre(
    'Lues mais jamais écrites',
    'Le code s’attend à y trouver quelque chose que rien n’y met : la règle est une intention.',
    jamaisEcrites,
  );

  console.log(`\nRéférentiel — ${referentiel.length}`);
  console.log('  Lues par le produit, écrites par le seul semis. C’est leur rôle.');
  console.log(`  ${referentiel.map((r) => r.modele).join(', ')}`);

  const inattendues = [...muettes, ...jamaisLues, ...jamaisEcrites].filter(
    (r) => ATTENDUS[r.modele] === undefined,
  );
  console.log(
    `\n${inattendues.length === 0 ? 'Aucune table orpheline inattendue.' : `${inattendues.length} table(s) orpheline(s) sans explication : ${inattendues.map((r) => r.modele).join(', ')}`}`,
  );
  console.log('\n◦ = absence connue et consignée · • = à regarder');
}

await principal();
