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

  const racine = path.resolve(import.meta.dirname, '../../..');
  await writeFile(path.join(racine, '.jeton-administration'), `${totpSecret}\n`, 'utf8');

  process.stdout.write(
    `Compte de back-office prêt.\n  adresse      : ${EMAIL}\n  mot de passe : ${MOT_DE_PASSE}\n  secret TOTP  : ${totpSecret}\n`,
  );
}

await main();
await prisma.$disconnect();
