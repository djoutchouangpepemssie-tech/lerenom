/**
 * Renseigne les coordonnées des 1 285 communes d'Île-de-France.
 *
 * Pourquoi ce script existe. Le classement des professionnels tient compte de la distance
 * entre le client et l'artisan ; sans coordonnées, ce critère valait zéro pour tout le monde,
 * et le classement se faisait sans lui — un défaut consigné en `docs/QUESTIONS.md` Q26, et
 * resté bloquant parce que `geo.api.gouv.fr` est refusé par la politique réseau de la
 * machine de construction.
 *
 * ## La source, et ce qu'elle vaut
 *
 * La base officielle des codes postaux de La Poste, publiée en données ouvertes et
 * redistribuée sur GitHub. Chaque commune y porte un **point de référence**, pas un
 * centroïde calculé sur son contour : c'est une approximation de l'ordre du kilomètre.
 *
 * C'est assez. Les communes franciliennes sont distantes de plusieurs kilomètres, et ce
 * qu'on en fait est un **classement** — « ce plombier est plus près que celui-là » — et non
 * un calcul d'itinéraire. Pour l'adresse exacte d'un client, il faudra un géocodage adresse
 * par adresse ; ce point-là ne le remplace pas et ne prétend pas le faire.
 *
 * ## Ce que le script refuse d'écrire
 *
 * Une source distante qu'on recopie sans la juger est une source qu'on ne connaît pas. Quatre
 * contrôles doivent passer, sinon rien n'est écrit :
 *
 *   1. **couverture complète** — les 1 285 communes, sans exception. Une commune sans
 *      coordonnées serait silencieusement reléguée au fond du classement ;
 *   2. **cadre francilien** — chaque point tombe dans les bornes de la région. Un code INSEE
 *      mal apparié mettrait un artisan de Meaux dans les Vosges, et rien ne le signalerait ;
 *   3. **arrondissements distincts** — les vingt arrondissements de Paris doivent avoir vingt
 *      points différents. S'ils partageaient celui de la commune de Paris, la proximité
 *      intra-parisienne ne voudrait plus rien dire, ce qui est précisément le cas où elle
 *      compte le plus ;
 *   4. **témoins** — sept communes dont les coordonnées sont connues par ailleurs, qui
 *      doivent tomber à moins de cinq kilomètres. C'est la seule façon de vérifier qu'on a
 *      bien les bonnes communes et pas un décalage systématique.
 *
 * Usage :
 *   node scripts/coordonnees-communes.mjs                # télécharge la source
 *   node scripts/coordonnees-communes.mjs chemin.json    # part d'un fichier déjà téléchargé
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SOURCE = 'https://raw.githubusercontent.com/high54/Communes-France-JSON/master/france.json';
const PROVENANCE = 'laposte-codes-postaux';

const RACINE = path.resolve(import.meta.dirname, '..');
const FICHIER = path.join(RACINE, 'donnees', 'communes-ile-de-france.json');

/** Les bornes de l'Île-de-France, élargies : il s'agit d'attraper une erreur, pas de découper. */
const CADRE = { latMin: 48.0, latMax: 49.3, lonMin: 1.3, lonMax: 3.6 };

/** Communes dont les coordonnées sont connues par ailleurs, pour éprouver la source. */
const TEMOINS = [
  { code: '78646', nom: 'Versailles', latitude: 48.804, longitude: 2.13 },
  { code: '77284', nom: 'Meaux', latitude: 48.96, longitude: 2.878 },
  { code: '93048', nom: 'Montreuil', latitude: 48.863, longitude: 2.443 },
  { code: '92050', nom: 'Nanterre', latitude: 48.892, longitude: 2.207 },
  { code: '95127', nom: 'Cergy', latitude: 49.035, longitude: 2.063 },
  { code: '91228', nom: 'Évry-Courcouronnes', latitude: 48.629, longitude: 2.441 },
  { code: '94028', nom: 'Créteil', latitude: 48.79, longitude: 2.455 },
];

const ECART_TEMOIN_MAXIMAL_KM = 5;

/** Distance orthodromique, en kilomètres. */
function distanceKm(latA, lonA, latB, lonB) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(latB - latA);
  const dLon = rad(lonB - lonA);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function charge(chemin) {
  if (chemin !== undefined) return JSON.parse(readFileSync(chemin, 'utf8'));

  process.stdout.write(`Téléchargement de ${SOURCE}\n`);
  const reponse = await fetch(SOURCE);
  if (!reponse.ok) {
    throw new Error(`La source répond ${String(reponse.status)}. Téléchargez-la à la main.`);
  }
  return reponse.json();
}

/**
 * Indexe la source par code INSEE sur cinq caractères.
 *
 * Le code y est un **nombre**, donc les zéros de tête ont été perdus à la publication. Sans
 * conséquence ici — l'Île-de-France n'a que des départements à deux chiffres — mais le
 * remplissage est fait quand même : réutiliser ce script ailleurs sans lui vaudrait des
 * appariements faux et silencieux.
 */
function indexe(brut) {
  const parCode = new Map();
  for (const ligne of brut) {
    const code = String(ligne.Code_commune_INSEE).padStart(5, '0');
    const gps = ligne.coordonnees_gps;
    if (typeof gps !== 'string' || gps.trim() === '') continue;
    if (parCode.has(code)) continue;

    const [latitude, longitude] = gps.split(',').map((valeur) => Number(valeur.trim()));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    parCode.set(code, { latitude, longitude });
  }
  return parCode;
}

function controle(communes, parCode) {
  const griefs = [];

  const manquantes = communes.filter((commune) => !parCode.has(commune.code));
  if (manquantes.length > 0) {
    const exemples = manquantes
      .slice(0, 5)
      .map((c) => `${c.code} ${c.nom}`)
      .join(', ');
    griefs.push(`${String(manquantes.length)} commune(s) sans coordonnées : ${exemples}`);
  }

  const horsCadre = communes.filter((commune) => {
    const point = parCode.get(commune.code);
    if (point === undefined) return false;
    return (
      point.latitude < CADRE.latMin ||
      point.latitude > CADRE.latMax ||
      point.longitude < CADRE.lonMin ||
      point.longitude > CADRE.lonMax
    );
  });
  if (horsCadre.length > 0) {
    const exemples = horsCadre
      .slice(0, 5)
      .map((c) => `${c.code} ${c.nom}`)
      .join(', ');
    griefs.push(`${String(horsCadre.length)} commune(s) hors du cadre francilien : ${exemples}`);
  }

  const parisiens = communes.filter((commune) => commune.arrondissementDeParis);
  const points = new Set(
    parisiens
      .map((commune) => parCode.get(commune.code))
      .filter((point) => point !== undefined)
      .map((point) => `${String(point.latitude)},${String(point.longitude)}`),
  );
  if (parisiens.length > 0 && points.size !== parisiens.length) {
    griefs.push(
      `les ${String(parisiens.length)} arrondissements de Paris n'ont que ${String(points.size)} point(s) distinct(s)`,
    );
  }

  for (const temoin of TEMOINS) {
    const point = parCode.get(temoin.code);
    if (point === undefined) {
      griefs.push(`témoin absent : ${temoin.nom}`);
      continue;
    }
    const ecart = distanceKm(temoin.latitude, temoin.longitude, point.latitude, point.longitude);
    if (ecart > ECART_TEMOIN_MAXIMAL_KM) {
      griefs.push(`témoin ${temoin.nom} à ${ecart.toFixed(1)} km de sa position connue`);
    }
  }

  return griefs;
}

const brut = await charge(process.argv[2]);
const fichier = JSON.parse(readFileSync(FICHIER, 'utf8'));
const parCode = indexe(brut);

const griefs = controle(fichier.communes, parCode);
if (griefs.length > 0) {
  process.stderr.write('La source ne passe pas les contrôles, rien n’a été écrit :\n');
  for (const grief of griefs) process.stderr.write(`  · ${grief}\n`);
  process.exit(1);
}

for (const commune of fichier.communes) {
  const point = parCode.get(commune.code);
  if (point === undefined) continue;
  // Cinq décimales : le mètre. Au-delà, on afficherait une précision que la source n'a pas.
  commune.latitude = Math.round(point.latitude * 1e5) / 1e5;
  commune.longitude = Math.round(point.longitude * 1e5) / 1e5;
  commune.sourceCoordonnees = PROVENANCE;
}

writeFileSync(FICHIER, `${JSON.stringify(fichier, null, 2)}\n`, 'utf8');
process.stdout.write(
  `${String(fichier.communes.length)} communes renseignées, quatre contrôles passés.\n`,
);
