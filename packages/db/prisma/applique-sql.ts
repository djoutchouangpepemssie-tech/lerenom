/**
 * Applique les garde-fous SQL que Prisma ne sait pas déclarer.
 *
 * Index GIST sur les colonnes géographiques, unicité partielle des exclusivités actives,
 * immuabilité des factures émises, journal d'audit en écriture seule. Prisma ne modélise rien
 * de tout cela : ce sont des règles du moteur, pas du schéma.
 *
 * Pourquoi un script plutôt que `psql -f` : `psql` n'existe pas dans les images d'exécution
 * de l'hébergeur. Le faire passer par le pilote PostgreSQL rend l'opération possible partout —
 * sur un poste de développement, dans l'intégration continue, et en pré-déploiement.
 *
 * Le fichier est rejouable : chaque instruction est en `IF NOT EXISTS` ou en `OR REPLACE`.
 *
 * Usage : pnpm --filter @lerenom/db sql
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';

const connectionString = process.env['DATABASE_URL'];
if (connectionString === undefined || connectionString === '') {
  throw new Error('DATABASE_URL est requis.');
}

const fichier = path.resolve(import.meta.dirname, 'sql/postgis.sql');
const sql = readFileSync(fichier, 'utf8');

const client = new Client({ connectionString });
await client.connect();

try {
  // Une seule requête : le protocole simple accepte plusieurs instructions, y compris les
  // corps de fonction délimités par `$$` que le protocole étendu refuserait.
  await client.query(sql);
  process.stdout.write('Garde-fous SQL appliqués.\n');
} finally {
  await client.end();
}
