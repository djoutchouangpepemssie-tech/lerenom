/**
 * Prépare la démonstration de la page de suivi client, et imprime son lien.
 *
 * La page de suivi n'a pas d'adresse devinable : elle s'ouvre avec un jeton qui n'existe en
 * clair qu'une fois, au moment où on le met dans le SMS. Pour la relire — et pour la
 * photographier — il faut donc en fabriquer un. Ce script le fait sur la demande de
 * démonstration, avec deux professionnels fictifs qui ont accepté et un qui n'a pas répondu.
 *
 * Il est idempotent : relancé, il remet la demande dans cet état et tire un nouveau jeton.
 *
 * Usage : pnpm --filter @lerenom/db demo:suivi
 */

import process from 'node:process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/genere/client.js';

const connectionString = process.env['DATABASE_URL'];
if (connectionString === undefined || connectionString === '') {
  throw new Error('DATABASE_URL est requis.');
}
if (process.env['NODE_ENV'] === 'production') {
  throw new Error('Ce script fabrique un lien de démonstration : il ne tourne pas en production.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const REFERENCE = 'DEM-2026-000001';
/** Les deux pros de démonstration qui acceptent, et celui qui laisse filer. */
const ACCEPTENT = [
  'plomberie-martin-paris-11-80000000100017',
  'dupont-plomberie-paris-11-80000000200016',
];
const NE_REPOND_PAS = 'atelier-roche-paris-11-80000000300015';

function secret(): string {
  const valeur = process.env['SECRET_VERIFICATION'];
  if (valeur === undefined || valeur.length < 32) {
    throw new Error('SECRET_VERIFICATION est absent ou trop court. Voir .env.exemple.');
  }
  return valeur;
}

async function main(): Promise<void> {
  const demande = await prisma.demande.findUnique({
    where: { reference: REFERENCE },
    select: { id: true },
  });
  if (demande === null) {
    throw new Error(`Demande ${REFERENCE} introuvable : lancer le semis d'abord.`);
  }

  const slugs = [...ACCEPTENT, NE_REPOND_PAS];
  const pros = await prisma.entreprise.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, agences: { select: { id: true }, take: 1 } },
  });
  if (pros.length !== slugs.length) {
    throw new Error('Professionnels de démonstration introuvables : lancer le semis d’abord.');
  }

  // On repart d'une table nette pour cette demande : le script doit pouvoir être relancé.
  await prisma.distribution.deleteMany({ where: { demandeId: demande.id } });
  await prisma.lienAction.deleteMany({ where: { demandeId: demande.id } });
  await prisma.demande.update({
    where: { id: demande.id },
    data: { statut: 'en_distribution', annuleeLe: null, motifAnnulation: null, clotureeLe: null },
  });

  const echeance = new Date(Date.now() + 2 * 3_600_000);
  let rang = 0;
  for (const slug of slugs) {
    rang += 1;
    const pro = pros.find((p) => p.slug === slug);
    if (pro === undefined) continue;
    const accepte = ACCEPTENT.includes(slug);
    await prisma.distribution.create({
      data: {
        demandeId: demande.id,
        entrepriseId: pro.id,
        ...(pro.agences[0] !== undefined ? { agenceId: pro.agences[0].id } : {}),
        rang,
        tour: 1,
        raisonRang: rang === 1 ? 'exclusif_de_la_zone' : 'score_et_proximite',
        statut: accepte ? 'acceptee' : 'envoyee',
        echeanceLe: echeance,
        ...(accepte ? { repondueLe: new Date(Date.now() - rang * 1_800_000) } : {}),
      },
    });
  }

  const jeton = randomBytes(32).toString('base64url');
  await prisma.lienAction.create({
    data: {
      demandeId: demande.id,
      jeton: createHmac('sha256', secret()).update(`lien:${jeton}`).digest('hex'),
      action: 'voir_pros',
      expireLe: new Date(Date.now() + 90 * 24 * 3_600_000),
    },
  });

  // Le jeton est aussi écrit sur disque, pour que le script de captures le retrouve seul.
  const fichier = path.resolve(import.meta.dirname, '../../../.jeton-suivi');
  await writeFile(fichier, `${jeton}\n`, 'utf8');

  process.stdout.write(`${jeton}\n`);
}

await main();
await prisma.$disconnect();
