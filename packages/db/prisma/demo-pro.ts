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
import { createHmac, randomBytes, scrypt } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  calculeTotaux,
  prepareFactureAcompte,
  prepareFactureSolde,
  prochainNumero,
  type TauxTva,
} from '@lerenom/core';
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

/** Le secret qui signe les liens : le même que celui du serveur, sinon le lien n'ouvre rien. */
function secretVerification(): string {
  const valeur = process.env['SECRET_VERIFICATION'];
  if (valeur === undefined || valeur.length < 32) {
    throw new Error('SECRET_VERIFICATION est absent ou trop court. Voir .env.exemple.');
  }
  return valeur;
}
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
      telephone: '+33199000092',
    },
    create: {
      entrepriseId: entreprise.id,
      email: EMAIL,
      nom: 'Julien Martin',
      roleDansEntreprise: 'Gérant',
      // Un numéro de la plage réservée à la fiction : c'est à lui que partirait le code de
      // confirmation d'un changement de compte bancaire.
      telephone: '+33199000092',
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
  await semeFacturesDeDemonstration(entreprise.id);
  await semeDevisEnvoyeAuClient(entreprise.id);

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

/**
 * Un devis signé et ses deux factures, pour que les écrans de facturation montrent quelque
 * chose de réaliste : un acompte déjà émis, un solde encore à émettre.
 *
 * Les montants passent par les mêmes fonctions que l'application. Un jeu d'essai qui
 * calculerait de son côté finirait par illustrer autre chose que le produit.
 */
async function semeFacturesDeDemonstration(entrepriseId: string): Promise<string> {
  // Les documents déjà émis ne se refont pas.
  //
  // Ce script était rejouable en effaçant tout. Il ne peut plus l'être pour les factures
  // émises et leurs avoirs : la base les retient, comme elle le ferait en production. Ce
  // n'est pas une gêne à contourner — un jeu d'essai qui peut effacer ce que la production
  // ne peut pas effacer n'éprouve plus les mêmes règles que le produit.
  //
  // Le script se contente donc de constater ce qui existe. Pour repartir de zéro, il faut
  // refaire la base : `pnpm --filter @lerenom/db semer` après l'avoir vidée.
  const dejaEmise = await prisma.facture.findFirst({
    where: { entrepriseId, statut: { in: ['emise', 'payee', 'annulee_par_avoir'] } },
    select: { id: true },
  });
  if (dejaEmise !== null) {
    const solde = await prisma.facture.findFirstOrThrow({
      where: { entrepriseId, statut: 'prete' },
      select: { id: true },
      orderBy: { creeLe: 'desc' },
    });
    const racineExistante = path.resolve(import.meta.dirname, '../../..');
    await writeFile(path.join(racineExistante, '.jeton-facture'), `${solde.id}\n`, 'utf8');
    await writeFile(
      path.join(racineExistante, '.jeton-facture-emise'),
      `${dejaEmise.id}\n`,
      'utf8',
    );
    return solde.id;
  }

  await prisma.facture.deleteMany({ where: { entrepriseId } });
  await prisma.devis.deleteMany({ where: { entrepriseId, statut: 'signe' } });
  // Les RIB non plus : des factures émises les désignent. On ne garde que l'absence d'actif.
  await prisma.rib.deleteMany({ where: { entrepriseId, factures: { none: {} } } });

  const client = await prisma.clientPro.findFirstOrThrow({ where: { entrepriseId } });

  await prisma.rib.create({
    data: {
      entrepriseId,
      titulaire: 'Plomberie Martin',
      // IBAN de test, jamais attribué : la clé de contrôle est juste, le compte n'existe pas.
      iban: 'FR7630001007941234567890185',
      bic: 'BDFEFRPPXXX',
      banque: 'Banque fictive des artisans',
      actif: true,
      confirmeParSmsLe: new Date(),
    },
  });

  const lignes = [
    {
      id: 'l1',
      type: 'prestation' as const,
      designation: 'Remplacement du chauffe-eau',
      detail: 'Cumulus 200 L, dépose de l’ancien comprise',
      unite: 'forfait' as const,
      quantite: 1,
      prixUnitaireHT: 890,
      tauxTva: 10 as const,
    },
    {
      id: 'l2',
      type: 'prestation' as const,
      designation: 'Main-d’œuvre',
      unite: 'heure' as const,
      quantite: 4,
      prixUnitaireHT: 58,
      tauxTva: 10 as const,
    },
  ];
  const document = { lignes, remisePourcent: 0, acomptePourcent: 30 as const };
  const totaux = calculeTotaux(document);
  const annee = new Date().getFullYear();

  const devis = await prisma.devis.create({
    data: {
      entrepriseId,
      clientId: client.id,
      numero: prochainNumero('DV', annee, null),
      statut: 'signe',
      type: 'definitif',
      acomptePourcent: 30,
      validiteJours: 30,
      fraisDeplacementTTC: 0,
      piecesRemplaceesGardees: true,
      totalHT: totaux.totalHT,
      totalTVA: totaux.totalTVA,
      totalTTC: totaux.totalTTC,
      envoyeLe: new Date(Date.now() - 6 * 86_400_000),
      signeLe: new Date(Date.now() - 4 * 86_400_000),
      lignes: {
        create: lignes.map((ligne, rang) => ({
          rang,
          type: ligne.type,
          designation: ligne.designation,
          detail: ligne.detail ?? null,
          unite: ligne.unite,
          quantite: ligne.quantite,
          prixUnitaireHT: ligne.prixUnitaireHT,
          tauxTva: ligne.tauxTva,
        })),
      },
    },
    select: { id: true },
  });

  const acompte = prepareFactureAcompte(document);
  const solde = prepareFactureSolde(document, acompte?.montantAPayerTTC ?? 0);
  const rib = await prisma.rib.findFirstOrThrow({ where: { entrepriseId, actif: true } });

  let acompteId: string | null = null;
  if (acompte !== null) {
    const emiseLe = new Date(Date.now() - 4 * 86_400_000);
    const echeance = new Date(emiseLe);
    echeance.setDate(echeance.getDate() + 30);
    const enregistre = await prisma.facture.create({
      select: { id: true },
      data: {
        entrepriseId,
        clientId: client.id,
        devisId: devis.id,
        type: 'acompte',
        statut: 'emise',
        numero: prochainNumero('FA', annee, null),
        acompteDejaFactureTTC: 0,
        totalHT: acompte.totaux.totalHT,
        totalTVA: acompte.totaux.totalTVA,
        totalTTC: acompte.totaux.totalTTC,
        montantAPayerTTC: acompte.montantAPayerTTC,
        ribId: rib.id,
        emiseLe,
        echeanceLe: echeance,
        lignes: {
          create: acompte.lignes.map((ligne, rang) => ({
            rang,
            type: ligne.type,
            designation: ligne.designation,
            detail: ligne.detail ?? null,
            unite: ligne.unite ?? null,
            quantite: ligne.quantite ?? null,
            prixUnitaireHT: ligne.prixUnitaireHT ?? null,
            tauxTva: ligne.tauxTva ?? null,
          })),
        },
      },
    });
    acompteId = enregistre.id;

    // Un avoir partiel sur cette facture émise : l'écran de correction n'a de sens que s'il
    // montre à la fois ce qui a déjà été crédité et ce qu'il reste.
    await prisma.avoir.create({
      data: {
        entrepriseId,
        factureId: enregistre.id,
        numero: prochainNumero('AV', annee, null),
        motif: 'Déplacement facturé en double : la seconde visite était couverte par la garantie.',
        montantTTC: 45,
        emisLe: new Date(Date.now() - 2 * 86_400_000),
      },
    });
  }

  const soldeEnregistre = await prisma.facture.create({
    data: {
      entrepriseId,
      clientId: client.id,
      devisId: devis.id,
      type: 'solde',
      statut: 'prete',
      acompteDejaFactureTTC: solde.acompteDejaFactureTTC,
      totalHT: solde.totaux.totalHT,
      totalTVA: solde.totaux.totalTVA,
      totalTTC: solde.totaux.totalTTC,
      montantAPayerTTC: solde.montantAPayerTTC,
      lignes: {
        create: solde.lignes.map((ligne, rang) => ({
          rang,
          type: ligne.type,
          designation: ligne.designation,
          detail: ligne.detail ?? null,
          unite: ligne.unite ?? null,
          quantite: ligne.quantite ?? null,
          prixUnitaireHT: ligne.prixUnitaireHT ?? null,
          tauxTva: ligne.tauxTva ?? null,
        })),
      },
    },
    select: { id: true },
  });

  const racine = path.resolve(import.meta.dirname, '../../..');
  await writeFile(path.join(racine, '.jeton-facture'), `${soldeEnregistre.id}\n`, 'utf8');
  if (acompteId !== null) {
    await writeFile(path.join(racine, '.jeton-facture-emise'), `${acompteId}\n`, 'utf8');
  }

  return soldeEnregistre.id;
}

await main();
await prisma.$disconnect();

/**
 * Un devis envoyé, et le lien tel que le client l'a reçu.
 *
 * C'est la seule façon de photographier la page du client : elle n'est accessible que par un
 * jeton, et ce jeton n'existe en clair qu'au moment où on le fabrique.
 */
async function semeDevisEnvoyeAuClient(entrepriseId: string): Promise<void> {
  const client = await prisma.clientPro.findFirstOrThrow({ where: { entrepriseId } });
  const annee = new Date().getFullYear();

  await prisma.lienAction.deleteMany({ where: { action: 'signer_devis', cibleId: { not: null } } });

  const existant = await prisma.devis.findFirst({
    where: { entrepriseId, statut: 'envoye' },
    select: { id: true },
  });

  const lignes = [
    {
      rang: 0,
      type: 'prestation' as const,
      designation: 'Remplacement du mitigeur thermostatique',
      detail: 'Fourniture et pose, modèle à cartouche céramique',
      unite: 'forfait' as const,
      quantite: 1,
      prixUnitaireHT: 240,
      tauxTva: 10 as TauxTva,
    },
    {
      rang: 1,
      type: 'prestation' as const,
      designation: 'Main-d’œuvre',
      detail: null,
      unite: 'heure' as const,
      quantite: 2,
      prixUnitaireHT: 58,
      tauxTva: 10 as TauxTva,
    },
  ];

  const totaux = calculeTotaux({
    lignes: lignes.map((ligne) => ({
      id: String(ligne.rang),
      type: ligne.type,
      designation: ligne.designation,
      unite: ligne.unite,
      quantite: ligne.quantite,
      prixUnitaireHT: ligne.prixUnitaireHT,
      tauxTva: ligne.tauxTva,
    })),
    remisePourcent: 0,
  });

  const devisId =
    existant?.id ??
    (
      await prisma.devis.create({
        data: {
          entrepriseId,
          clientId: client.id,
          type: 'estimatif',
          statut: 'envoye',
          numero: prochainNumero('DV', annee, 'DV-' + String(annee) + '-0001'),
          envoyeLe: new Date(Date.now() - 2 * 86_400_000),
          remisePourcent: 0,
          acomptePourcent: 30,
          validiteJours: 30,
          fraisDeplacementTTC: 0,
          devisPayant: false,
          piecesRemplaceesGardees: true,
          mentionRetractation: false,
          totalHT: totaux.totalHT,
          totalTVA: totaux.totalTVA,
          totalTTC: totaux.totalTTC,
          lignes: { create: lignes },
        },
        select: { id: true },
      })
    ).id;

  const jeton = randomBytes(32).toString('base64url');
  await prisma.lienAction.create({
    data: {
      jeton: createHmac('sha256', secretVerification()).update(`lien:${jeton}`).digest('hex'),
      action: 'signer_devis',
      cibleId: devisId,
      expireLe: new Date(Date.now() + 30 * 86_400_000),
    },
  });

  const racine = path.resolve(import.meta.dirname, '../../..');
  await writeFile(path.join(racine, '.jeton-devis-client'), `${jeton}\n`, 'utf8');
}
