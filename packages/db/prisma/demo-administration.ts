/**
 * Prépare un compte de démonstration pour le back-office.
 *
 * Le back-office exige une double authentification, et c'est une bonne chose : un compte y
 * voit les coordonnées de tous les clients. La conséquence pratique est qu'on ne peut pas s'y
 * connecter sans une application d'authentification — ce qui rendrait les captures d'écran
 * impossibles si rien ne fournissait le secret en clair.
 *
 * Ce script le fournit : il crée le compte, **affiche son secret TOTP**, et écrit le secret
 * dans `.jeton-administration` pour que le script de captures fabrique les codes lui-même.
 *
 * Le hachage et le tirage du secret sont **importés** de `@lerenom/securite`, jamais recopiés.
 * La première version de ce script en avait refait une copie « pour ne pas dépendre du
 * paquet » : quatre segments au lieu de six, et aucun mot de passe ne passait. Une copie d'une
 * fonction de sécurité est une divergence à retardement, et celle-ci n'a même pas attendu.
 *
 * Il refuse de s'exécuter quand `LERENOM_ENV` vaut `production` : poser un compte dont le
 * secret est imprimé sur un terminal n'a de sens que sur une machine de développement.
 *
 * Usage : pnpm --filter @lerenom/db demo:administration
 */

import process from 'node:process';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { hacheMotDePasse, tireSecretTotp } from '@lerenom/securite';
import { PrismaClient } from '../src/genere/client.js';

const EMAIL = 'arcel@lerenom.exemple';
const MOT_DE_PASSE = 'le renom se construit lentement';
const NOM = 'Arcel (démonstration)';

const url = process.env['DATABASE_URL'];
if (url === undefined || url === '') {
  throw new Error('DATABASE_URL est absente.');
}
if (process.env['LERENOM_ENV'] === 'production') {
  throw new Error(
    'Refus : ce script imprime un secret de double authentification. Il n’a pas sa place en production.',
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

/**
 * Deux demandes de démonstration pour le centre de distribution.
 *
 * Sans elles, deux des trois files de l'écran sont vides : on ne peut ni les regarder ni les
 * éprouver. Elles sont **manifestement fictives** — référence préfixée, téléphone dans la
 * plage réservée 01 99, adresse en `.exemple` — comme le reste de la démonstration.
 *
 * Idempotent : relancé, il remet les mêmes demandes dans le même état.
 */
async function semeDesDemandes(): Promise<void> {
  const commune = await prisma.commune.findFirst({ select: { code: true } });
  if (commune === null) return;

  // La demande sans preneur a forcément été classée — c'est ce qui a permis de la distribuer
  // avant que personne ne l'accepte. Sans métier, elle apparaîtrait aussi dans la file « à
  // classer », ce qui n'a aucun sens et donnerait à l'écran un cas qui n'existe pas.
  const metier = await prisma.metier.findFirst({
    where: { masque: false },
    orderBy: { rang: 'asc' },
    select: { id: true },
  });
  const entreprises = await prisma.entreprise.findMany({
    where: { retireeLe: null },
    take: 3,
    select: { id: true },
  });

  const scenarios = [
    {
      reference: 'DEMO-BO-A-CLASSER',
      statut: 'en_distribution' as const,
      // En dessous de 0,70, le classement automatique passe la main. C'est le cas qu'on veut
      // voir : la machine hésite, et quelqu'un doit trancher. Sans métier, la cascade ne peut
      // choisir personne — la demande attend donc, et c'est exactement le cas réel.
      confianceClassement: 0.41,
      metierId: null,
      description:
        'Il y a un bruit dans le mur quand j’ouvre l’eau chaude, et une tache au plafond du dessous.',
      prenom: 'Camille',
      nom: 'Besson',
      telephone: '+33199000071',
      urgence: 'normale' as const,
    },
    {
      reference: 'DEMO-BO-SANS-PRENEUR',
      statut: 'sans_preneur' as const,
      confianceClassement: 0.93,
      metierId: metier?.id ?? null,
      description:
        'Volet roulant bloqué en position haute, moteur qui tourne dans le vide. Immeuble sans ascenseur.',
      prenom: 'Hakim',
      nom: 'Ferhat',
      telephone: '+33199000072',
      urgence: 'rapide' as const,
    },
  ];

  for (const scenario of scenarios) {
    const existante = await prisma.demande.findUnique({
      where: { reference: scenario.reference },
      select: { id: true },
    });
    if (existante !== null) {
      await prisma.demande.update({
        where: { id: existante.id },
        // Le métier est remis à chaque passage : une exécution précédente a pu classer la
        // demande à la main, et elle ne serait plus dans la file qu'elle sert à montrer.
        data: {
          statut: scenario.statut,
          confianceClassement: scenario.confianceClassement,
          classeeParAdmin: false,
          metierId: scenario.metierId,
        },
      });
      continue;
    }

    const demande = await prisma.demande.create({
      data: {
        reference: scenario.reference,
        type: 'partagee',
        statut: scenario.statut,
        confianceClassement: scenario.confianceClassement,
        communeId: commune.code,
        description: scenario.description,
        urgence: scenario.urgence,
        clientPrenom: scenario.prenom,
        clientNom: scenario.nom,
        clientEmail: `${scenario.prenom.toLowerCase()}.demo@exemple.test`,
        clientTelephone: scenario.telephone,
        telephoneVerifieLe: new Date(),
        consentementTexte: 'Consentement de démonstration.',
        consentementDonneLe: new Date(),
        deposeeLe: new Date(Date.now() - 30 * 3_600_000),
        objectifPros: 3,
        ...(scenario.metierId !== null ? { metierId: scenario.metierId } : {}),
      },
      select: { id: true },
    });

    // La demande sans preneur montre une cascade entière : trois professionnels sollicités,
    // aucun qui accepte. C'est le scénario que l'écran existe pour rendre visible, et une
    // liste vide ne l'aurait pas montré.
    if (scenario.statut === 'sans_preneur') {
      for (const [rang, entreprise] of entreprises.entries()) {
        await prisma.distribution.create({
          data: {
            demandeId: demande.id,
            entrepriseId: entreprise.id,
            rang: rang + 1,
            tour: 1,
            raisonRang: 'score_et_proximite',
            statut: rang === 0 ? 'refusee' : 'expiree',
            envoyeeLe: new Date(Date.now() - 29 * 3_600_000),
            echeanceLe: new Date(Date.now() - 27 * 3_600_000),
            ...(rang === 0
              ? {
                  ouverteLe: new Date(Date.now() - 28.5 * 3_600_000),
                  repondueLe: new Date(Date.now() - 28 * 3_600_000),
                  motifRefus: 'indisponible' as const,
                }
              : {}),
            distanceKm: 2.4 + rang * 3.1,
          },
        });
      }
    }
  }
}

async function main(): Promise<void> {
  const existant = await prisma.admin.findUnique({
    where: { email: EMAIL },
    select: { id: true, totpSecret: true },
  });

  // Idempotent : relancé, il remet le même compte dans le même état plutôt que d'en empiler.
  // Le secret, lui, est conservé s'il existe — le regénérer invaliderait l'application déjà
  // configurée sur le téléphone de celui qui s'en sert.
  const totpSecret = existant?.totpSecret ?? tireSecretTotp();

  const admin = await prisma.admin.upsert({
    where: { email: EMAIL },
    update: {
      nom: NOM,
      role: 'administrateur',
      actif: true,
      totpSecret,
      totpActiveLe: new Date(),
      tentativesConnexion: 0,
      derniereTentativeLe: null,
      // Le dernier pas est remis à zéro : sans cela, un secret conservé d'une exécution
      // précédente refuserait tous les codes antérieurs au dernier accepté.
      dernierPasTotp: null,
    },
    create: {
      email: EMAIL,
      nom: NOM,
      role: 'administrateur',
      motDePasseHash: await hacheMotDePasse(MOT_DE_PASSE),
      totpSecret,
      totpActiveLe: new Date(),
    },
    select: { id: true },
  });

  if (existant !== null) {
    await prisma.admin.update({
      where: { id: admin.id },
      data: { motDePasseHash: await hacheMotDePasse(MOT_DE_PASSE) },
    });
  }

  await semeDesDemandes();

  const racine = path.resolve(import.meta.dirname, '../../..');
  await writeFile(path.join(racine, '.jeton-administration'), `${totpSecret}\n`, 'utf8');

  process.stdout.write(
    `Compte de back-office prêt.\n  adresse      : ${EMAIL}\n  mot de passe : ${MOT_DE_PASSE}\n  secret TOTP  : ${totpSecret}\n`,
  );
}

await main();
await prisma.$disconnect();
