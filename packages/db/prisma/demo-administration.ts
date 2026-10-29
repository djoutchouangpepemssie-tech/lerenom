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

/**
 * Pose les trois cas que l'écran « Professionnels » existe pour traiter.
 *
 * Sans eux, la file « à vérifier » s'ouvre vide sur une base de développement où les sept
 * entreprises semées sont toutes déjà vérifiées — et un écran vide ne montre pas s'il
 * fonctionne. Les trois cas ne sont pas décoratifs : ce sont ceux qui se présentent vraiment.
 *
 * 1. Une fiche revendiquée, avec un métier : elle attend, et la vérifier la met au travail.
 * 2. Une fiche revendiquée **sans métier** : la vérifier ne lui apportera rien, parce que la
 *    cascade ne peut la rapprocher d'aucune demande. L'écran doit le dire avant le clic.
 * 3. Une fiche suspendue, avec son motif : la file « écartées » doit montrer qu'on peut
 *    revenir sur une décision.
 */
async function semeDesProfessionnels(): Promise<void> {
  const commune = await prisma.commune.findFirst({ select: { code: true } });
  if (commune === null) return;
  const metier = await prisma.metier.findFirst({
    where: { masque: false },
    orderBy: { rang: 'asc' },
    select: { id: true },
  });

  const scenarios = [
    {
      slug: 'demo-bo-a-verifier',
      nom: 'Atelier Vaugirard (démonstration)',
      siret: '09900000000071',
      avecMetier: true,
      verifiee: false,
      suspendue: false,
    },
    {
      slug: 'demo-bo-sans-metier',
      nom: 'Maison Belleville (démonstration)',
      siret: '09900000000072',
      avecMetier: false,
      verifiee: false,
      suspendue: false,
    },
    {
      slug: 'demo-bo-suspendue',
      nom: 'Comptoir Montreuil (démonstration)',
      siret: '09900000000073',
      avecMetier: true,
      verifiee: true,
      suspendue: true,
    },
  ];

  for (const scenario of scenarios) {
    // Les drapeaux sont réécrits à chaque passage : une exécution précédente a pu vérifier ou
    // réactiver la fiche depuis l'écran, et elle ne serait plus dans la file qu'elle sert à
    // montrer.
    const entreprise = await prisma.entreprise.upsert({
      where: { slug: scenario.slug },
      update: {
        verifiee: scenario.verifiee,
        suspendue: scenario.suspendue,
        revendiquee: true,
      },
      create: {
        slug: scenario.slug,
        nom: scenario.nom,
        siret: scenario.siret,
        source: 'inscription',
        revendiquee: true,
        verifiee: scenario.verifiee,
        suspendue: scenario.suspendue,
        creeLe: new Date(Date.now() - 5 * 86_400_000),
      },
      select: { id: true },
    });

    const agences = await prisma.agence.count({ where: { entrepriseId: entreprise.id } });
    if (agences === 0) {
      await prisma.agence.create({
        data: {
          entrepriseId: entreprise.id,
          adresse: '12 rue de la Démonstration',
          codePostal: '75000',
          communeId: commune.code,
          principale: true,
        },
      });
    }

    // Un compte rattaché, parce qu'une fiche revendiquée en a forcément un : c'est la
    // revendication qui le crée. Sans lui, la démonstration montrait une étiquette « aucun
    // compte » sur un état qui ne peut pas exister, et l'écran mentait sur ce qu'il sait voir.
    const comptes = await prisma.utilisateurPro.count({
      where: { entrepriseId: entreprise.id },
    });
    if (comptes === 0) {
      await prisma.utilisateurPro.create({
        data: {
          entrepriseId: entreprise.id,
          email: `${scenario.slug}@exemple.test`,
          nom: 'Gérant de démonstration',
          emailVerifieLe: new Date(),
        },
      });
    }

    if (scenario.avecMetier && metier !== null) {
      const lien = await prisma.metierPro.count({
        where: { entrepriseId: entreprise.id, metierId: metier.id },
      });
      if (lien === 0) {
        await prisma.metierPro.create({
          data: { entrepriseId: entreprise.id, metierId: metier.id },
        });
      }
    }
  }
}

/**
 * Pose la file de modération : trois avis, une contestation, un signalement.
 *
 * Les trois avis couvrent les trois lectures différentes que l'écran doit permettre.
 *
 * 1. Un avis contenant un **numéro de téléphone**. Il ne se refuse pas : il se publie
 *    caviardé, et l'écran doit montrer côte à côte ce que l'auteur a écrit et ce qui sortira.
 * 2. Un avis portant une **accusation grave** — « arnaque ». Rien à retirer, tout à lire : le
 *    signal appelle un humain, il ne tranche pas. C'est le cas où l'écran ne doit surtout pas
 *    pré-juger.
 * 3. Un avis **propre**, sans signal. C'est le cas général, et il doit se publier en un geste.
 *
 * Les avis sont posés sur les entreprises de démonstration de ce script, jamais sur celles du
 * semis de base : celles-là annoncent « 84 avis » sans porter une seule ligne d'avis, et la
 * première publication recalculerait leur note à partir du seul avis réel — 5 sur 5 sur 1 avis
 * au lieu de 4,7 sur 84. L'incohérence est dans le semis, pas dans le recalcul.
 */
async function semeLaModeration(): Promise<void> {
  const commune = await prisma.commune.findFirst({ select: { code: true } });
  const metier = await prisma.metier.findFirst({
    where: { masque: false },
    orderBy: { rang: 'asc' },
    select: { id: true },
  });
  const entreprise = await prisma.entreprise.findUnique({
    where: { slug: 'demo-bo-a-verifier' },
    select: { id: true },
  });
  if (commune === null || entreprise === null) return;

  const scenarios = [
    {
      reference: 'DEMO-BO-AVIS-NUMERO',
      prenom: 'Sandrine',
      note: 4,
      commentaire:
        'Travail soigné et ponctuel. Si quelqu’un cherche, je donne son numéro : 06 12 34 56 78. Je referai appel à lui.',
    },
    {
      reference: 'DEMO-BO-AVIS-GRAVE',
      prenom: 'Mathieu',
      note: 1,
      commentaire:
        'Devis doublé une fois le chantier commencé, et impossible de le joindre ensuite. Pour moi c’est une arnaque.',
    },
    {
      reference: 'DEMO-BO-AVIS-PROPRE',
      prenom: 'Léa',
      note: 5,
      commentaire:
        'Intervention le jour même, prix annoncé respecté, et il a pris le temps d’expliquer ce qu’il faisait.',
    },
  ];

  for (const scenario of scenarios) {
    let demande = await prisma.demande.findUnique({
      where: { reference: scenario.reference },
      select: { id: true },
    });
    if (demande === null) {
      demande = await prisma.demande.create({
        data: {
          reference: scenario.reference,
          type: 'partagee',
          statut: 'gagnee',
          communeId: commune.code,
          description: 'Demande de démonstration, close, ayant donné lieu à un avis.',
          urgence: 'normale',
          clientPrenom: scenario.prenom,
          clientEmail: `${scenario.prenom.toLowerCase()}.demo@exemple.test`,
          clientTelephone: '+33199000080',
          telephoneVerifieLe: new Date(),
          consentementTexte: 'Consentement de démonstration.',
          consentementDonneLe: new Date(),
          deposeeLe: new Date(Date.now() - 12 * 86_400_000),
          objectifPros: 3,
          ...(metier !== null ? { metierId: metier.id } : {}),
        },
        select: { id: true },
      });
    }

    // Le statut est remis à `en_attente` à chaque passage : une exécution précédente a pu
    // publier ou refuser l'avis depuis l'écran, et il ne serait plus dans la file qu'il sert
    // à montrer.
    await prisma.avis.upsert({
      where: { demandeId: demande.id },
      update: {
        statut: 'en_attente',
        commentairePublic: null,
        publieLe: null,
        modereLe: null,
        motifRefus: null,
      },
      create: {
        entrepriseId: entreprise.id,
        demandeId: demande.id,
        note: scenario.note,
        commentaire: scenario.commentaire,
        auteurPrenom: scenario.prenom,
        statut: 'en_attente',
        creeLe: new Date(Date.now() - 6 * 86_400_000),
      },
    });
  }

  // Une contestation déjà hors délai : c'est le cas que l'écran doit rendre visible, parce
  // qu'un professionnel attend une réponse qu'on lui a promise sous 48 heures.
  const demandeContestee = await prisma.demande.findUnique({
    where: { reference: 'DEMO-BO-AVIS-GRAVE' },
    select: { id: true },
  });
  if (demandeContestee !== null) {
    const existante = await prisma.contestation.findFirst({
      where: { demandeId: demandeContestee.id, entrepriseId: entreprise.id },
      select: { id: true },
    });
    if (existante === null) {
      await prisma.contestation.create({
        data: {
          demandeId: demandeContestee.id,
          entrepriseId: entreprise.id,
          motif: 'client_injoignable',
          explication:
            'Six appels sur trois jours, deux messages, aucune réponse. Le rendez-vous n’a jamais pu être fixé.',
          deposeeLe: new Date(Date.now() - 5 * 86_400_000),
          echeanceLe: new Date(Date.now() - 3 * 86_400_000),
        },
      });
    }
  }

  const signalement = await prisma.signalementDsa.findFirst({
    where: { contenuId: 'demo-bo-a-verifier' },
    select: { id: true },
  });
  if (signalement === null) {
    await prisma.signalementDsa.create({
      data: {
        typeContenu: 'fiche',
        contenuId: 'demo-bo-a-verifier',
        motif: 'Allégation de certification mensongère',
        explication:
          'La fiche annonce une qualification RGE que l’entreprise ne détient pas, d’après l’annuaire officiel.',
        auteurEmail: 'signalant.demo@exemple.test',
      },
    });
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
  await semeDesProfessionnels();
  await semeLaModeration();

  const racine = path.resolve(import.meta.dirname, '../../..');
  await writeFile(path.join(racine, '.jeton-administration'), `${totpSecret}\n`, 'utf8');

  process.stdout.write(
    `Compte de back-office prêt.\n  adresse      : ${EMAIL}\n  mot de passe : ${MOT_DE_PASSE}\n  secret TOTP  : ${totpSecret}\n`,
  );
}

await main();
await prisma.$disconnect();
