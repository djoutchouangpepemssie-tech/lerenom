#!/usr/bin/env node
/**
 * Quelles colonnes le produit n'utilise jamais ?
 *
 * Le même exercice que pour les tables, à l'échelle en dessous — et c'est l'échelle où le
 * défaut le plus coûteux de ce projet se cachait. `Entreprise.verifiee` était écrite à
 * l'inscription, décrite dans trois commentaires, et **aucune requête ne la lisait** : une
 * entreprise non vérifiée recevait des demandes. Une colonne morte ne se voit pas, parce
 * qu'elle a l'air d'une colonne.
 *
 * ## Ce que ce contrôle sait faire, et ce qu'il ne sait pas
 *
 * Il repère les colonnes dont le nom **n'apparaît nulle part** dans le code applicatif.
 * C'est un signal sûr : une colonne jamais nommée n'est ni lue ni écrite, sans ambiguïté
 * possible.
 *
 * Il ne sait **pas** dire si une colonne nommée est lue *et* écrite. Prisma permet trop de
 * formes — `select`, `include`, `data`, déstructuration, propagation d'objet — pour qu'une
 * recherche de texte tranche. Prétendre le contraire produirait exactement les faux positifs
 * qui ont rendu les deux premiers audits inutilisables avant correction.
 *
 * Autrement dit : ce qu'il signale mérite un regard, ce qu'il tait ne prouve rien.
 *
 * Usage : node outils/champs-orphelins.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const RACINE = new URL('..', import.meta.url).pathname;

/**
 * Les colonnes dont l'inutilisation est connue et assumée.
 *
 * Comme pour les tables : chaque entrée porte sa raison. Une entrée sans raison ferait taire
 * le contrôle sans que personne sache pourquoi.
 */
const ATTENDUS = {
  // Toutes les colonnes d'une table déjà consignée comme orpheline le sont aussi : les
  // répéter une à une noierait le rapport sans rien apprendre.
};

/** Les tables déjà connues comme orphelines : leurs colonnes n'ont pas à être listées. */
const TABLES_ORPHELINES = new Set([
  'Appel',
  'FactureLeRenom',
  'Recredit',
  'SignalementAvis',
  'CampagnePub',
  'DemandeRgpd',
  'Photo',
  'PhotoDemande',
  'ReponseAvis',
  'Verification',
  'Garantie',
  'Publication',
  'Paiement',
  'AlerteOuverture',
  'Quartier',
]);

/** Noms trop communs pour qu'une recherche de texte dise quoi que ce soit. */
const TROP_COMMUNS = new Set([
  'id',
  'nom',
  'type',
  'statut',
  'email',
  'telephone',
  'adresse',
  'ville',
  'slug',
  'rang',
  'note',
  'description',
  'titre',
  'contenu',
  'valeur',
  'montant',
  'quantite',
  'prix',
  'creeLe',
  'modifieLe',
  'actif',
  'code',
  'latitude',
  'longitude',
  'motif',
  'explication',
  'metierId',
  'communeId',
  'entrepriseId',
  'demandeId',
  'clientId',
  'formule',
  'mois',
]);

async function fichiers() {
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
      if (chemin.includes('/src/genere/')) continue;
      if (entree.isDirectory()) await marche(chemin);
      else if (/\.(ts|tsx|mjs|sql)$/.test(entree.name)) trouves.push(chemin);
    }
  }
  for (const dossier of ['apps', 'packages']) await marche(join(RACINE, dossier));
  return trouves;
}

/** Les champs scalaires de chaque modèle. Les relations sont écartées : elles ont leur audit. */
async function champs() {
  const schema = await readFile(join(RACINE, 'packages/db/prisma/schema.prisma'), 'utf8');
  const modeles = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  const connus = new Set(modeles);
  const resultat = [];

  for (const bloc of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const modele = bloc[1];
    for (const ligne of bloc[2].split('\n')) {
      const champ = /^\s*(\w+)\s+(\w+)(\[\])?\s*(\?)?/.exec(ligne);
      if (champ === null) continue;
      const [, nom, type] = champ;
      if (connus.has(type)) continue;
      if (type === 'Unsupported') continue;
      resultat.push({ modele, nom });
    }
  }
  return resultat;
}

async function principal() {
  const liste = await champs();
  const chemins = await fichiers();
  const contenus = await Promise.all(chemins.map((c) => readFile(c, 'utf8')));
  const tout = contenus.join('\n');

  const morts = liste.filter(({ modele, nom }) => {
    if (TABLES_ORPHELINES.has(modele)) return false;
    if (TROP_COMMUNS.has(nom)) return false;
    if (ATTENDUS[`${modele}.${nom}`] !== undefined) return false;
    return !new RegExp(`\\b${nom}\\b`).test(tout);
  });

  console.log(`Colonnes examinées — ${liste.length}`);
  console.log(`  Hors tables déjà consignées orphelines et noms trop communs pour trancher.`);
  console.log(`\nJamais nommées dans le code — ${morts.length}`);
  console.log('  Ni lues ni écrites : la colonne existe, le produit l’ignore.');
  const parModele = new Map();
  for (const { modele, nom } of morts) {
    parModele.set(modele, [...(parModele.get(modele) ?? []), nom]);
  }
  for (const [modele, noms] of [...parModele].sort()) {
    console.log(`  • ${modele} : ${noms.join(', ')}`);
  }

  console.log(
    `\n${morts.length === 0 ? 'Aucune colonne morte.' : `${morts.length} colonne(s) à regarder.`}`,
  );
  console.log(
    '\nCe contrôle ne dit rien des colonnes nommées : savoir si elles sont lues *et* écrites',
  );
  console.log('demande de lire le code, pas de le chercher.');
  if (morts.length > 0) process.exitCode = 1;
}

await principal();
