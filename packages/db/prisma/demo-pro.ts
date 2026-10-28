/**
 * Prépare la démonstration de l'espace professionnel.
 *
 * Crée un compte sur l'un des plombiers de démonstration, et lui propose deux demandes : une
 * qui attend sa réponse, une déjà acceptée avec ses coordonnées. C'est ce qu'il faut pour
 * photographier les écrans, et c'est aussi un bac à sable utilisable à la main.
 *
 * Usage : pnpm --filter @lerenom/db demo:pro
 */

import process from 'node:process';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { randomBytes, scrypt } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { calculeTotaux } from '@lerenom/core';
import { PrismaClient } from '../src/genere/client.js';

const connectionString = process.env['DATABASE_URL'];
if (connectionString === undefined || connectionString === '') {
  throw new Error('DATABASE_URL est requis.');
}
if (process.env['NODE_ENV'] === 'production') {
  throw new Error('Ce script crée un compte de démonstration : il ne tourne pas en production.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SLUG_PRO = 'plomberie-martin-paris-11-80000000100017';
const EMAIL = 'demo@lerenom.exemple';
const MOT_DE_PASSE = 'le chat dort sur le toit';

/** Le même format que `@lerenom/securite` : `scrypt$N$r$p$sel$empreinte`. */
function hache(motDePasse: string): Promise<string> {
  const sel = randomBytes(16);
  const cout = 2 ** 16;
  return new Promise((resoud, rejette) => {
    scrypt(
      motDePasse.normalize('NFKC'),
      sel,
      32,
      { N: cout, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
      (erreur, empreinte) => {
        if (erreur !== null) rejette(erreur);
        else {
          resoud(
            [
              'scrypt',
              String(cout),
              '8',
              '1',
              sel.toString('base64url'),
              empreinte.toString('base64url'),
            ].join('$'),
          );
        }
      },
    );
  });
}

async function main(): Promise<void> {
  const entreprise = await prisma.entreprise.findUnique({
    where: { slug: SLUG_PRO },
    select: { id: true, nom: true, metiers: { select: { metierId: true }, take: 1 } },
  });
  if (entreprise === null) {
    throw new Error(`Entreprise ${SLUG_PRO} introuvable : lancer le semis d’abord.`);
  }

  const metierId = entreprise.metiers[0]?.metierId;
  if (metierId === undefined) {
    throw new Error('Cette entreprise n’a aucun métier : le semis est incomplet.');
  }

  // Une demande réelle porte presque toujours une prestation précise : la démonstration doit
  // en montrer une, sinon l'écran affiche « Plombier » là où le pro lit « Fuite sous l'évier ».
  const prestations = await prisma.prestation.findMany({
    where: { metierId },
    select: { id: true, nom: true, slug: true },
    orderBy: { nom: 'asc' },
  });
  const prestationChauffeEau =
    prestations.find((p) => p.slug.includes('chauffe-eau')) ?? prestations[0];
  const prestationFuite = prestations.find((p) => p.slug.includes('fuite')) ?? prestations[0];

  await prisma.utilisateurPro.upsert({
    where: { email: EMAIL },
    update: {
      motDePasseHash: await hache(MOT_DE_PASSE),
      tentativesConnexion: 0,
      derniereTentativeLe: null,
    },
    create: {
      entrepriseId: entreprise.id,
      email: EMAIL,
      nom: 'Julien Martin',
      roleDansEntreprise: 'Gérant',
      motDePasseHash: await hache(MOT_DE_PASSE),
      emailVerifieLe: new Date(),
    },
  });

  // Le quota du mois, pour que le tableau de bord ait des chiffres à montrer.
  const mois = new Date().toISOString().slice(0, 7);
  await prisma.quotaMensuel.upsert({
    where: { entrepriseId_mois: { entrepriseId: entreprise.id, mois } },
    update: { demandesAcceptees: 3, depenseHT: 24 },
    create: {
      entrepriseId: entreprise.id,
      mois,
      formule: 'exclusif',
      demandesIncluses: 15,
      demandesAcceptees: 3,
      depenseHT: 24,
    },
  });

  // Deux demandes de démonstration, repérables à leur référence.
  await prisma.demande.deleteMany({ where: { reference: { startsWith: 'DEMO-PRO-' } } });

  const scenarios = [
    {
      reference: 'DEMO-PRO-ATTENTE',
      description:
        'Chauffe-eau en panne depuis hier soir, plus d’eau chaude. Immeuble ancien, ' +
        'chaudière au gaz dans la cuisine.',
      urgence: 'rapide' as const,
      prenom: 'Léa',
      telephone: '+33199000090',
      email: 'lea.demo@exemple.fr',
      accepte: false,
      prestationId: prestationChauffeEau?.id,
    },
    {
      reference: 'DEMO-PRO-ACCEPTEE',
      description:
        'Fuite sous l’évier de la cuisine, le placard est trempé. J’ai coupé l’arrivée d’eau.',
      urgence: 'normale' as const,
      prenom: 'Thomas',
      telephone: '+33199000091',
      email: 'thomas.demo@exemple.fr',
      accepte: true,
      prestationId: prestationFuite?.id,
    },
  ];

  for (const scenario of scenarios) {
    const demande = await prisma.demande.create({
      data: {
        reference: scenario.reference,
        type: 'partagee',
        statut: scenario.accepte ? 'en_distribution' : 'en_distribution',
        metierId,
        ...(scenario.prestationId !== undefined ? { prestationId: scenario.prestationId } : {}),
        communeId: '75111',
        adresse: scenario.accepte ? '34 rue Saint-Maur' : null,
        description: scenario.description,
        urgence: scenario.urgence,
        budgetMin: scenario.accepte ? null : 150,
        budgetMax: scenario.accepte ? null : 400,
        clientPrenom: scenario.prenom,
        clientEmail: scenario.email,
        clientTelephone: scenario.telephone,
        telephoneVerifieLe: new Date(),
        consentementTexte: 'Consentement de démonstration.',
        consentementDonneLe: new Date(),
        objectifPros: 3,
      },
      select: { id: true },
    });

    await prisma.distribution.create({
      data: {
        demandeId: demande.id,
        entrepriseId: entreprise.id,
        rang: 1,
        tour: 1,
        raisonRang: 'exclusif_de_la_zone',
        statut: scenario.accepte ? 'acceptee' : 'envoyee',
        envoyeeLe: new Date(Date.now() - (scenario.accepte ? 3 : 0.3) * 3_600_000),
        echeanceLe: new Date(Date.now() + (scenario.accepte ? -1 : 1.7) * 3_600_000),
        ...(scenario.accepte
          ? { repondueLe: new Date(Date.now() - 2.5 * 3_600_000), consommeForfait: true }
          : {}),
        distanceKm: scenario.accepte ? 1.2 : 2.4,
      },
    });
  }

  const devisId = await semeDevisDeDemonstration(entreprise.id);

  process.stdout.write(
    `Compte de démonstration prêt.\n  adresse     : ${EMAIL}\n  mot de passe : ${MOT_DE_PASSE}\n  devis       : ${devisId}\n`,
  );
}

/**
 * Un brouillon de devis, pour que l'éditeur ait quelque chose à montrer.
 *
 * Idempotent : relancé, il remet le même devis dans le même état plutôt que d'en empiler.
 * Son identifiant est écrit dans `.jeton-devis`, comme les jetons de suivi, parce que
 * l'adresse de l'éditeur le contient et que les captures doivent savoir où aller.
 */
async function semeDevisDeDemonstration(entrepriseId: string): Promise<string> {
  const client = await prisma.clientPro.upsert({
    where: { id: (await prisma.clientPro.findFirst({ where: { entrepriseId } }))?.id ?? 'aucun' },
    update: {},
    create: {
      entrepriseId,
      nom: 'Madame Dupuis',
      telephone: '01 99 00 00 21',
      adresse: '18 rue Keller',
      codePostal: '75011',
      ville: 'Paris 11e',
    },
  });

  await prisma.devis.deleteMany({ where: { entrepriseId, statut: 'brouillon' } });

  const devis = await prisma.devis.create({
    data: {
      entrepriseId,
      clientId: client.id,
      type: 'estimatif',
      validiteJours: 30,
      acomptePourcent: 30,
      fraisDeplacementTTC: 0,
      devisPayant: false,
      piecesRemplaceesGardees: true,
      lignes: {
        create: [
          {
            rang: 0,
            type: 'section',
            designation: 'Recherche et réparation de la fuite',
          },
          {
            rang: 1,
            type: 'prestation',
            designation: 'Recherche de fuite par caméra thermique',
            detail: 'Mur de la salle de bain, sans destruction',
            unite: 'forfait',
            quantite: 1,
            prixUnitaireHT: 180,
            tauxTva: 10,
          },
          {
            rang: 2,
            type: 'prestation',
            designation: 'Remplacement du flexible et du raccord',
            detail: 'Pièces fournies',
            unite: 'unite',
            quantite: 2,
            prixUnitaireHT: 24,
            tauxTva: 10,
          },
          {
            rang: 3,
            type: 'prestation',
            designation: 'Main-d’œuvre',
            unite: 'heure',
            quantite: 2.5,
            prixUnitaireHT: 58,
            tauxTva: 10,
          },
          {
            rang: 4,
            type: 'texte',
            designation:
              'Intervention sous 48 h après acceptation. Les pièces remplacées restent à votre disposition.',
          },
        ],
      },
    },
    select: { id: true },
  });

  // Les totaux ne se devinent pas des lignes : ils sont stockés pour que la liste et la
  // comptabilité n'aient pas à recalculer. Tout chemin qui écrit des lignes doit donc les
  // écrire aussi — le semis compris, sinon la liste affiche 0 € pour un devis à 410 €.
  const lignes = await prisma.devisLigne.findMany({
    where: { devisId: devis.id },
    orderBy: { rang: 'asc' },
  });
  const totaux = calculeTotaux({
    lignes: lignes.map((ligne) => ({
      id: ligne.id,
      type: ligne.type,
      designation: ligne.designation,
      ...(ligne.unite !== null ? { unite: ligne.unite } : {}),
      ...(ligne.quantite !== null ? { quantite: Number(ligne.quantite) } : {}),
      ...(ligne.prixUnitaireHT !== null ? { prixUnitaireHT: Number(ligne.prixUnitaireHT) } : {}),
      ...(ligne.tauxTva !== null ? { tauxTva: Number(ligne.tauxTva) as 5.5 | 10 | 20 } : {}),
    })),
    acomptePourcent: 30,
  });
  await prisma.devis.update({
    where: { id: devis.id },
    data: { totalHT: totaux.totalHT, totalTVA: totaux.totalTVA, totalTTC: totaux.totalTTC },
  });

  const racine = path.resolve(import.meta.dirname, '../../..');
  await writeFile(path.join(racine, '.jeton-devis'), `${devis.id}\n`, 'utf8');

  return devis.id;
}

await main();
await prisma.$disconnect();
