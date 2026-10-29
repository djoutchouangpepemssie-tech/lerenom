/**
 * Prépare la démonstration des pages client, et imprime leurs liens.
 *
 * La page de suivi n'a pas d'adresse devinable : elle s'ouvre avec un jeton qui n'existe en
 * clair qu'une fois, au moment où on le met dans le SMS. Pour la relire — et pour la
 * photographier — il faut donc en fabriquer un. Ce script le fait sur la demande de
 * démonstration, avec deux professionnels fictifs qui ont accepté et un qui n'a pas répondu.
 * Il en fabrique deux : la page de suivi, et l'invitation à déposer un avis.
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

/**
 * Les demandes déposées par le script de captures, dans la plage 06 12 99 xx xx que l'Arcel
 * réserve à la fiction. Chaque passage en crée deux ; sans ce ménage, elles s'accumulent et
 * finissent par polluer le jeu de démonstration.
 */
async function purgeLesDemandesDeCapture(): Promise<number> {
  const demandes = await prisma.demande.findMany({
    where: { clientTelephone: { startsWith: '+336129' } },
    select: { id: true, clientTelephone: true },
  });
  const ids = demandes.map((demande) => demande.id);
  if (ids.length === 0) return 0;

  await prisma.lienAction.deleteMany({ where: { demandeId: { in: ids } } });
  await prisma.messageSortant.deleteMany({ where: { demandeId: { in: ids } } });
  await prisma.suiviDemande.deleteMany({ where: { demandeId: { in: ids } } });
  await prisma.distribution.deleteMany({ where: { demandeId: { in: ids } } });
  await prisma.demande.deleteMany({ where: { id: { in: ids } } });

  const numeros = demandes.map((demande) => demande.clientTelephone);
  await prisma.messageSortant.deleteMany({ where: { destinataire: { in: numeros } } });

  return ids.length;
}

async function main(): Promise<void> {
  const purgees = await purgeLesDemandesDeCapture();
  if (purgees > 0) {
    process.stdout.write(`${String(purgees)} demandes de capture nettoyées\n`);
  }

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

  // Lié dans une constante : la fermeture ci-dessous perdrait le rétrécissement de type.
  const demandeId = demande.id;

  /** Crée un lien et rend son jeton en clair — qui n'existe qu'ici. */
  async function lien(
    action: 'voir_pros' | 'deposer_avis' | 'confirmer_intervention',
    cibleId?: string,
  ): Promise<string> {
    const jeton = randomBytes(32).toString('base64url');
    await prisma.lienAction.create({
      data: {
        demandeId,
        jeton: createHmac('sha256', secret()).update(`lien:${jeton}`).digest('hex'),
        action,
        ...(cibleId !== undefined ? { cibleId } : {}),
        expireLe: new Date(Date.now() + 90 * 24 * 3_600_000),
      },
    });
    return jeton;
  }

  const jetonSuivi = await lien('voir_pros');

  // Pour l'invitation à l'avis, il faut des travaux déclarés réalisés : sans eux, le
  // formulaire refuse de s'ouvrir, et c'est précisément la règle qu'il protège.
  const premier = pros.find((p) => p.slug === ACCEPTENT[0]);
  let jetonAvis = '';
  if (premier !== undefined) {
    await prisma.suiviDemande.deleteMany({ where: { demandeId: demande.id } });
    await prisma.suiviDemande.createMany({
      data: [
        { demandeId: demande.id, entrepriseId: premier.id, etape: 'acceptee' },
        { demandeId: demande.id, entrepriseId: premier.id, etape: 'travaux_realises' },
      ],
    });
    // La tâche de modération part avec l'avis. Sans cette ligne, chaque passage laissait
    // derrière lui une tâche `avis_a_moderer` pointant vers un avis supprimé : cinquante-quatre
    // orphelines s'étaient accumulées avant qu'on s'en aperçoive, et elles auraient gonflé la
    // file de modération avec des objets qui n'existent plus.
    const avisEffaces = await prisma.avis.findMany({
      where: { demandeId: demande.id },
      select: { id: true },
    });
    await prisma.tacheAValider.deleteMany({
      where: { type: 'avis_a_moderer', objetId: { in: avisEffaces.map((a) => a.id) } },
    });
    await prisma.avis.deleteMany({ where: { demandeId: demande.id } });
    jetonAvis = await lien('deposer_avis', premier.id);
  }

  // La question « l'intervention a-t-elle eu lieu ? » vise un second professionnel, pour que
  // l'écran reste affichable alors même que le premier a déjà ses travaux déclarés.
  const second = pros.find((p) => p.slug === ACCEPTENT[1]);
  const jetonConfirmation =
    second === undefined ? '' : await lien('confirmer_intervention', second.id);

  // Les jetons sont aussi écrits sur disque, pour que le script de captures les retrouve seuls.
  const racine = path.resolve(import.meta.dirname, '../../..');
  await writeFile(path.join(racine, '.jeton-suivi'), `${jetonSuivi}\n`, 'utf8');
  await writeFile(path.join(racine, '.jeton-avis'), `${jetonAvis}\n`, 'utf8');
  await writeFile(path.join(racine, '.jeton-confirmation'), `${jetonConfirmation}\n`, 'utf8');

  process.stdout.write(
    `suivi        : ${jetonSuivi}\navis         : ${jetonAvis}\nconfirmation : ${jetonConfirmation}\n`,
  );
}

await main();
await prisma.$disconnect();
