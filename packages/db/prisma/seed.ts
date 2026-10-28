/**
 * Données de démonstration de Le Renom.
 *
 * Le jeu se compose de deux parties :
 *   1. les **référentiels réels** — les 8 départements, les 1 285 communes d'Île-de-France,
 *      les 18 univers, 69 métiers et 479 prestations du catalogue, et les prix indicatifs ;
 *   2. un **jeu de démonstration clairement fictif** — les 7 plombiers de référence de
 *      Paris 11e du cahier des charges, avec leurs formules, leurs avis et une demande en
 *      cours de distribution.
 *
 * Les entreprises de démonstration portent toutes `source: manuelle` et un SIRET de test.
 * Elles ne sont jamais présentées comme réelles, et le seed refuse de tourner en production.
 *
 * Usage :
 *   DATABASE_URL=... pnpm --filter @lerenom/db semer
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/genere/client.js';

const RACINE = path.resolve(import.meta.dirname, '../../..');
const DONNEES = path.join(RACINE, 'donnees');

function lit<T>(nom: string): T {
  return JSON.parse(readFileSync(path.join(DONNEES, nom), 'utf8')) as T;
}

const connectionString = process.env['DATABASE_URL'];
if (connectionString === undefined || connectionString === '') {
  throw new Error('DATABASE_URL est requis.');
}
if (process.env['NODE_ENV'] === 'production') {
  throw new Error(
    'Le seed contient des données de démonstration fictives : il ne tourne pas en production.',
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/* ------------------------------------------------------------------------- */
/* Référentiels                                                               */
/* ------------------------------------------------------------------------- */

interface FichierCommunes {
  departements: { code: string; nom: string; entrees: number }[];
  communes: {
    code: string;
    nom: string;
    slug: string;
    departement: string;
    codesPostaux: string[];
    population: number | null;
    arrondissementDeParis: boolean;
    statut: 'ouvert' | 'bientot' | 'annuaire';
    latitude: number | null;
    longitude: number | null;
    sourceCoordonnees: string | null;
  }[];
}

interface FichierCatalogue {
  univers: {
    slug: string;
    nom: string;
    couleur: string;
    icone: string;
    rang: number;
    metiers: {
      slug: string;
      nom: string;
      codesNaf2008: string[];
      motsCles: string[];
      rang: number;
      prestations: {
        slug: string;
        nom: string;
        unite: 'forfait' | 'heure' | 'unite' | 'm2' | 'ml' | 'jour';
        tresDemande: boolean;
        rang: number;
      }[];
    }[];
  }[];
}

interface FichierPrix {
  metiers: {
    slug: string;
    tauxTva: number;
    prestations: { slug: string; minTTC: number; maxTTC: number; source: string }[];
  }[];
}

function slugifie(texte: string): string {
  return texte
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '-')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function semeGeographie(): Promise<void> {
  const fichier = lit<FichierCommunes>('communes-ile-de-france.json');

  await prisma.departement.createMany({
    data: fichier.departements.map((d) => ({
      code: d.code,
      nom: d.nom,
      slug: `${slugifie(d.nom)}-${d.code}`,
    })),
    skipDuplicates: true,
  });

  await prisma.commune.createMany({
    data: fichier.communes.map((c) => ({
      code: c.code,
      departementId: c.departement,
      nom: c.nom,
      slug: c.slug,
      codesPostaux: c.codesPostaux,
      population: c.population,
      arrondissementDeParis: c.arrondissementDeParis,
      statut: c.statut,
      latitude: c.latitude,
      longitude: c.longitude,
      sourceCoordonnees: c.sourceCoordonnees,
    })),
    skipDuplicates: true,
  });

  const ouvertes = fichier.communes.filter((c) => c.statut === 'ouvert').length;
  const bientot = fichier.communes.filter((c) => c.statut === 'bientot').length;
  console.log(
    `  géographie : ${fichier.departements.length} départements, ${fichier.communes.length} communes ` +
      `(${ouvertes} ouvertes, ${bientot} bientôt)`,
  );
}

async function semeCatalogue(): Promise<Map<string, string>> {
  const catalogue = lit<FichierCatalogue>('catalogue.json');
  const prix = lit<FichierPrix>('prix-indicatifs.json');
  const prixParMetier = new Map(prix.metiers.map((m) => [m.slug, m]));

  const idsMetier = new Map<string, string>();
  let nombreMetiers = 0;
  let nombrePrestations = 0;

  for (const univers of catalogue.univers) {
    const universCree = await prisma.univers.upsert({
      where: { slug: univers.slug },
      update: {},
      create: {
        slug: univers.slug,
        nom: univers.nom,
        couleur: univers.couleur,
        icone: univers.icone,
        rang: univers.rang,
      },
    });

    for (const metier of univers.metiers) {
      const prixMetier = prixParMetier.get(metier.slug);
      const metierCree = await prisma.metier.upsert({
        where: { slug: metier.slug },
        update: {},
        create: {
          universId: universCree.id,
          slug: metier.slug,
          nom: metier.nom,
          codesNaf2008: metier.codesNaf2008,
          motsCles: metier.motsCles,
          rang: metier.rang,
        },
      });
      idsMetier.set(metier.slug, metierCree.id);
      nombreMetiers += 1;

      if (prixMetier !== undefined) {
        await prisma.prixMetier.upsert({
          where: { metierId: metierCree.id },
          update: {},
          create: { metierId: metierCree.id, tauxTva: prixMetier.tauxTva },
        });
      }

      const prixParPrestation = new Map((prixMetier?.prestations ?? []).map((p) => [p.slug, p]));

      for (const prestation of metier.prestations) {
        const prestationCreee = await prisma.prestation.upsert({
          where: { slug: prestation.slug },
          update: {},
          create: {
            metierId: metierCree.id,
            slug: prestation.slug,
            nom: prestation.nom,
            unite: prestation.unite,
            tresDemande: prestation.tresDemande,
            rang: prestation.rang,
          },
        });
        nombrePrestations += 1;

        const bande = prixParPrestation.get(prestation.slug);
        if (bande !== undefined) {
          await prisma.prixPrestation.upsert({
            where: { prestationId: prestationCreee.id },
            update: {},
            create: {
              prestationId: prestationCreee.id,
              minTTC: bande.minTTC,
              maxTTC: bande.maxTTC,
              source: bande.source,
            },
          });
        }
      }
    }
  }

  console.log(
    `  catalogue : ${catalogue.univers.length} univers, ${nombreMetiers} métiers, ` +
      `${nombrePrestations} prestations`,
  );
  return idsMetier;
}

/* ------------------------------------------------------------------------- */
/* Paramètres d'exploitation                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Les valeurs par défaut de `packages/core`, recopiées ici parce que le seed ne peut pas
 * importer un paquet TypeScript de l'espace de travail. Les tests de `packages/core`
 * garantissent qu'elles ne bougent pas sans décision ; ici elles amorcent la table historisée
 * que le back-office modifie ensuite.
 */
const PARAMETRES: Record<string, unknown> = {
  'score.poids': { avis: 0.3, activite: 0.25, pertinence: 0.2, reactivite: 0.15, fraicheur: 0.1 },
  'score.avisDeReference': 10,
  'classement.noteMinimale': 3.5,
  'classement.emplacementsPayesMax': 3,
  'classement.premiumMaxParMetierVille': 6,
  'classement.premiumRemontentSansExclusif': true,
  'distribution.prosMaxParDemande': 3,
  'distribution.minutesExclusiviteExclusif': 30,
  'distribution.minutesReponseAutresPros': 120,
  'distribution.minutesAvanceUrgence': 5,
  'distribution.heuresFraicheurDemande': 72,
  'distribution.rayonAgenceParDefautKm': 10,
  'distribution.facteurElargissementRayon': 1.5,
  'quotas.seuilAlerteForfait': 0.8,
  'quotas.demandesDirectesGratuit': 3,
  'contestation.joursContestation': 7,
  'contestation.heuresTraitement': 48,
  'client.joursControle': 2,
  'client.joursDemandeAvis': 15,
  'facturation.tauxTvaLeRenom': 0.2,
  'conformite.moisConservationDemandes': 24,
};

async function semeParametres(): Promise<void> {
  for (const [cle, valeur] of Object.entries(PARAMETRES)) {
    const existant = await prisma.parametre.findFirst({ where: { cle, finitLe: null } });
    if (existant === null) {
      await prisma.parametre.create({
        data: { cle, valeur: valeur as never, motif: 'Valeur initiale du 27 octobre 2026.' },
      });
    }
  }
  console.log(`  paramètres : ${Object.keys(PARAMETRES).length} règles historisées`);
}

/* ------------------------------------------------------------------------- */
/* Démonstration : les 7 plombiers de Paris 11e                               */
/* ------------------------------------------------------------------------- */

interface ProDemo {
  readonly siret: string;
  readonly nom: string;
  readonly formule: 'gratuit' | 'essentiel' | 'premium' | 'exclusif';
  readonly note: number;
  readonly avis: number;
  readonly delaiReponseMinutes: number;
  readonly description: string;
  readonly communes: string[];
  readonly disponible?: boolean;
  /// Prestations proposées, par slug, avec leur prix affiché en euros TTC.
  readonly prestations?: readonly (readonly [string, number])[];
  /// Coordonnées de l'agence, laissées vides tant que le géocodage n'a pas tourné.
  readonly titulaireExclusivite?: boolean;
}

/** Jeu de démonstration du cahier des charges §19. Entreprises fictives, SIRET de test. */
const PLOMBIERS: readonly ProDemo[] = [
  {
    siret: '80000000100017',
    nom: 'Plomberie Martin',
    formule: 'exclusif',
    note: 4.9,
    avis: 212,
    delaiReponseMinutes: 12,
    description:
      "Entreprise familiale installée dans le 11e depuis 1998. Recherche de fuite, dépannage d'urgence et rénovation complète de salle de bain. Nous intervenons sous deux heures dans l'arrondissement.",
    communes: ['75111', '75112', '75120', '93048', '94080'],
    titulaireExclusivite: true,
    prestations: [
      ['plombier--recherche-de-fuite', 180],
      ['plombier--reparation-de-fuite-d-eau', 220],
      ['plombier--debouchage-d-evier-ou-de-lavabo', 140],
      ['plombier--remplacement-de-robinet', 160],
      ['plombier--installation-de-wc', 290],
    ],
  },
  {
    siret: '80000000200016',
    nom: 'Dupont Plomberie',
    formule: 'premium',
    note: 4.8,
    avis: 126,
    delaiReponseMinutes: 24,
    description:
      'Deux agences, à Paris 11e et à Montreuil. Plomberie générale, remplacement de chauffe-eau et installation sanitaire. Devis détaillé avant toute intervention.',
    communes: ['75111', '93048'],
    prestations: [
      ['plombier--recherche-de-fuite', 195],
      ['plombier--reparation-de-fuite-d-eau', 240],
      ['plombier--remplacement-de-robinet', 150],
      ['plombier--remplacement-de-chasse-d-eau', 180],
    ],
  },
  {
    siret: '80000000300015',
    nom: 'Atelier Roche',
    formule: 'premium',
    note: 4.7,
    avis: 84,
    delaiReponseMinutes: 38,
    description:
      "Artisan plombier, spécialiste de la rénovation de salle de bain et de la douche à l'italienne. Travail soigné, chantiers laissés propres.",
    communes: ['75111', '75120'],
    prestations: [
      ['plombier--installation-de-wc', 310],
      ['plombier--remplacement-de-robinet', 170],
      ['plombier--remplacement-de-flexible-et-raccords', 90],
    ],
  },
  {
    siret: '80000000400014',
    nom: 'SOS Fuite 11',
    formule: 'essentiel',
    note: 4.6,
    avis: 58,
    delaiReponseMinutes: 45,
    description:
      "Dépannage et recherche de fuite sept jours sur sept. Détection sans destruction, intervention rapide dans l'est parisien.",
    communes: ['75111'],
    prestations: [
      ['plombier--recherche-de-fuite', 210],
      ['plombier--reparation-de-fuite-d-eau', 260],
      ['plombier--debouchage-d-evier-ou-de-lavabo', 160],
    ],
  },
  {
    siret: '80000000500013',
    nom: 'Hydro Services',
    formule: 'essentiel',
    disponible: false,
    note: 4.4,
    avis: 40,
    delaiReponseMinutes: 72,
    description:
      'Plomberie, débouchage et entretien de chaudière pour les particuliers et les copropriétés du 11e arrondissement.',
    communes: ['75111'],
    prestations: [
      ['plombier--debouchage-d-evier-ou-de-lavabo', 130],
      ['plombier--remplacement-de-robinet', 140],
    ],
  },
  {
    siret: '80000000600012',
    nom: "Plomb'Art 11",
    formule: 'gratuit',
    note: 4.5,
    avis: 31,
    delaiReponseMinutes: 95,
    description:
      'Petits travaux de plomberie, remplacement de robinetterie et réparation de fuites. Artisan indépendant.',
    communes: ['75111'],
    prestations: [
      ['plombier--remplacement-de-robinet', 120],
      ['plombier--reparation-de-fuite-d-eau', 190],
      ['plombier--remplacement-de-flexible-et-raccords', 75],
    ],
  },
  {
    siret: '80000000700011',
    nom: 'Lefèvre Sanitaire',
    formule: 'gratuit',
    note: 4.3,
    avis: 19,
    delaiReponseMinutes: 140,
    description:
      'Installation et dépannage sanitaire. Intervention sur rendez-vous dans le 11e et les arrondissements voisins.',
    communes: ['75111'],
    prestations: [
      ['plombier--installation-de-wc', 270],
      ['plombier--remplacement-de-chasse-d-eau', 150],
    ],
  },
];

async function semeDemonstration(idsMetier: Map<string, string>): Promise<void> {
  const metierPlombier = idsMetier.get('plombier');
  if (metierPlombier === undefined) {
    throw new Error(
      'Le métier « plombier » est absent du catalogue : le seed de démonstration ne peut pas tourner.',
    );
  }

  const prestationFuite = await prisma.prestation.findUnique({
    where: { slug: 'plombier--recherche-de-fuite' },
  });

  for (const [indice, pro] of PLOMBIERS.entries()) {
    // Numéros de la plage 01 99 00 00 xx, réservée par l'Arcep à la fiction : aucun vrai
    // abonné ne peut être dérangé par une donnée de démonstration.
    const telephoneFictif = `+33199000${String(indice + 10).padStart(3, '0')}`;
    const emailFictif = `contact@${slugifie(pro.nom)}.exemple`;
    const entreprise = await prisma.entreprise.upsert({
      where: { siret: pro.siret },
      // Les données de démonstration se rafraîchissent à chaque semis : sans cela, un champ
      // ajouté au modèle resterait vide sur les lignes déjà créées, et le défaut passerait
      // pour un comportement.
      update: {
        nom: pro.nom,
        noteMoyenne: pro.note,
        nombreAvis: pro.avis,
        disponible: pro.disponible ?? true,
        interventionUrgente: pro.formule !== 'gratuit',
        delaiReponseMinutes: pro.delaiReponseMinutes,
      },
      create: {
        siret: pro.siret,
        siren: pro.siret.slice(0, 9),
        nom: pro.nom,
        slug: `${slugifie(pro.nom)}-paris-11-${pro.siret}`,
        // Données de démonstration : jamais présentées comme réelles.
        source: 'manuelle',
        revendiquee: true,
        verifiee: true,
        noteMoyenne: pro.note,
        nombreAvis: pro.avis,
        disponible: pro.disponible ?? true,
        // Les urgences sont réservées aux formules payantes.
        interventionUrgente: pro.formule !== 'gratuit',
        delaiReponseMinutes: pro.delaiReponseMinutes,
      },
    });

    await prisma.fiche.upsert({
      where: { entrepriseId: entreprise.id },
      // Les champs de démonstration sont rafraîchis : un semis relancé après un changement
      // de jeu d'essai doit refléter le nouveau, pas garder l'ancien.
      update: { telephone: telephoneFictif, email: emailFictif, description: pro.description },
      create: {
        entrepriseId: entreprise.id,
        description: pro.description,
        telephone: telephoneFictif,
        email: emailFictif,
        completude: pro.formule === 'gratuit' ? 0.45 : pro.formule === 'essentiel' ? 0.68 : 0.92,
        atouts:
          pro.formule === 'gratuit'
            ? []
            : ['Devis gratuit', 'Intervention rapide', 'Assurance décennale'],
      },
    });

    // Même raison : les agences déjà en base reçoivent le contact de démonstration à jour.
    await prisma.agence.updateMany({
      where: { entrepriseId: entreprise.id },
      data: { contactTelephone: telephoneFictif, contactEmail: emailFictif },
    });

    const agenceExistante = await prisma.agence.findFirst({
      where: { entrepriseId: entreprise.id },
    });
    if (agenceExistante === null) {
      await prisma.agence.create({
        data: {
          entrepriseId: entreprise.id,
          nom: 'Agence principale',
          adresse: '1 rue de la Roquette',
          codePostal: '75011',
          communeId: '75111',
          rayonKm: 10,
          principale: true,
          contactTelephone: telephoneFictif,
          contactEmail: emailFictif,
        },
      });
      if (pro.nom === 'Dupont Plomberie') {
        await prisma.agence.create({
          data: {
            entrepriseId: entreprise.id,
            nom: 'Agence de Montreuil',
            adresse: '12 rue de Paris',
            codePostal: '93100',
            communeId: '93048',
            rayonKm: 12,
          },
        });
      }
    }

    await prisma.metierPro.upsert({
      where: { entrepriseId_metierId: { entrepriseId: entreprise.id, metierId: metierPlombier } },
      update: {},
      create: { entrepriseId: entreprise.id, metierId: metierPlombier, principal: true },
    });

    for (const [slugPrestation, prixTTC] of pro.prestations ?? []) {
      const prestation = await prisma.prestation.findUnique({
        where: { slug: slugPrestation },
        select: { id: true },
      });
      if (prestation === null) {
        throw new Error(`Prestation inconnue dans le jeu de démonstration : ${slugPrestation}`);
      }
      await prisma.prestationPro.upsert({
        where: {
          entrepriseId_prestationId: {
            entrepriseId: entreprise.id,
            prestationId: prestation.id,
          },
        },
        update: { prixTTC },
        create: { entrepriseId: entreprise.id, prestationId: prestation.id, prixTTC },
      });
    }

    for (const communeId of pro.communes) {
      await prisma.zonePro.upsert({
        where: { entrepriseId_communeId: { entrepriseId: entreprise.id, communeId } },
        update: {},
        create: { entrepriseId: entreprise.id, communeId },
      });
    }

    if (pro.formule !== 'gratuit') {
      const abonnementExistant = await prisma.abonnement.findFirst({
        where: { entrepriseId: entreprise.id },
      });
      if (abonnementExistant === null) {
        await prisma.abonnement.create({
          data: {
            entrepriseId: entreprise.id,
            formule: pro.formule,
            debuteLe: new Date('2026-07-01T00:00:00Z'),
            engageJusquA: pro.formule === 'exclusif' ? new Date('2027-07-01T00:00:00Z') : null,
            visibilitePartout: pro.formule === 'exclusif',
          },
        });
      }
    }

    // Les emplacements payés : un Exclusif et deux Premium sur « plombier × Paris 11e ».
    if (pro.formule === 'premium' || pro.formule === 'exclusif') {
      await prisma.emplacement.upsert({
        where: {
          entrepriseId_metierId_communeId: {
            entrepriseId: entreprise.id,
            metierId: metierPlombier,
            communeId: '75111',
          },
        },
        update: {},
        create: {
          entrepriseId: entreprise.id,
          metierId: metierPlombier,
          communeId: '75111',
          formule: pro.formule,
        },
      });
    }

    if (pro.titulaireExclusivite === true) {
      const exclusiviteExistante = await prisma.exclusivite.findFirst({
        where: { metierId: metierPlombier, communeId: '75111' },
      });
      if (exclusiviteExistante === null) {
        await prisma.exclusivite.create({
          data: {
            metierId: metierPlombier,
            communeId: '75111',
            entrepriseId: entreprise.id,
            debuteLe: new Date('2026-07-01T00:00:00Z'),
            finitLe: new Date('2027-07-01T00:00:00Z'),
          },
        });
      }
    }

    // Le score du soir, avec ses composantes, pour que le back-office puisse l'expliquer.
    const jour = '2026-10-27';
    const reactivite = Math.min(1, 60 / Math.max(60, pro.delaiReponseMinutes));
    await prisma.scoreQualite.upsert({
      where: { entrepriseId_jour: { entrepriseId: entreprise.id, jour } },
      update: {},
      create: {
        entrepriseId: entreprise.id,
        jour,
        avis: (pro.note - 1) / 4,
        activite: pro.formule === 'gratuit' ? 0.4 : 0.85,
        pertinence: 0.9,
        reactivite,
        fraicheur: 0.95,
        score:
          0.3 * ((pro.note - 1) / 4) +
          0.25 * (pro.formule === 'gratuit' ? 0.4 : 0.85) +
          0.2 * 0.9 +
          0.15 * reactivite +
          0.1 * 0.95,
      },
    });
  }

  console.log(
    `  démonstration : ${PLOMBIERS.length} plombiers à Paris 11e, 1 exclusivité, 3 emplacements payés`,
  );

  if (prestationFuite !== null) {
    const reference = 'DEM-2026-000001';
    const existante = await prisma.demande.findUnique({ where: { reference } });
    if (existante === null) {
      await prisma.demande.create({
        data: {
          reference,
          type: 'partagee',
          statut: 'en_distribution',
          metierId: metierPlombier,
          prestationId: prestationFuite.id,
          confianceClassement: 0.94,
          communeId: '75111',
          codePostal: '75011',
          quartier: 'Sainte-Marguerite',
          description:
            "Une fuite sous l'évier de la cuisine depuis hier soir. L'eau coule dès que j'ouvre le robinet et le placard est trempé.",
          urgence: 'rapide',
          delaiSouhaite: 'Dans les 48 heures',
          budgetMin: 100,
          budgetMax: 400,
          clientPrenom: 'Camille',
          clientEmail: 'camille@exemple.test',
          clientTelephone: '+33600000000',
          telephoneVerifieLe: new Date(),
          consentementTexte:
            "J'accepte que mes coordonnées soient transmises aux professionnels qui acceptent ma demande, dans la limite de 3, et je comprends que les partenaires de Le Renom sont contactés en priorité.",
          consentementDonneLe: new Date(),
          objectifPros: 3,
        },
      });
      console.log('  démonstration : 1 demande en cours de distribution');
    }
  }
}

/* ------------------------------------------------------------------------- */

/**
 * Le semis est-il déjà fait ?
 *
 * Il est écrit en `upsert`, donc rejouable sans dommage — mais il repose 1 285 communes et
 * 479 prestations à chaque passage. Comme il tourne désormais avant chaque déploiement, ce
 * contrôle évite une minute perdue à réécrire ce qui est déjà là.
 *
 * `FORCE_SEMIS=1` le force malgré tout : c'est ce qu'on veut après avoir changé le jeu de
 * données, sans quoi les corrections ne s'appliqueraient jamais.
 */
async function dejaSeme(): Promise<boolean> {
  if (process.env['FORCE_SEMIS'] === '1') return false;

  // Les comptes attendus viennent des fichiers de données eux-mêmes, jamais de nombres
  // recopiés : un catalogue enrichi doit déclencher un nouveau semis, pas passer inaperçu.
  const catalogue = lit<FichierCatalogue>('catalogue.json');
  const attendus = {
    communes: lit<FichierCommunes>('communes-ile-de-france.json').communes.length,
    univers: catalogue.univers.length,
    metiers: catalogue.univers.reduce((somme, u) => somme + u.metiers.length, 0),
    prestations: catalogue.univers.reduce(
      (somme, u) => somme + u.metiers.reduce((n, m) => n + m.prestations.length, 0),
      0,
    ),
  };

  const [communes, univers, metiers, prestations, parametres] = await Promise.all([
    prisma.commune.count(),
    prisma.univers.count(),
    prisma.metier.count(),
    prisma.prestation.count(),
    prisma.parametre.count(),
  ]);

  return (
    communes === attendus.communes &&
    univers === attendus.univers &&
    metiers === attendus.metiers &&
    prestations === attendus.prestations &&
    parametres > 0
  );
}

async function main(): Promise<void> {
  if (await dejaSeme()) {
    console.log('Semis déjà fait : rien à reposer. FORCE_SEMIS=1 pour le refaire.');
    return;
  }

  console.log('Semis de la base Le Renom');
  await semeGeographie();
  const idsMetier = await semeCatalogue();
  await semeParametres();
  await semeDemonstration(idsMetier);
  console.log('Terminé.');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
