/**
 * La cascade de distribution d'une demande.
 *
 * Ce module **orchestre**, il ne décide pas : l'éligibilité, l'ordre, les délais et le coût
 * viennent tous de `@lerenom/core`. Il lit la base, appelle la règle, écrit le résultat et le
 * journalise — dans cet ordre, et rien d'autre.
 *
 * Chaque envoi, chaque refus, chaque expiration laisse une ligne dans `distributions` : qui, à
 * quel rang, pourquoi ce rang, quand envoyée, quand répondue, à quel prix, et par qui si c'est
 * un administrateur. C'est cette table qui fait foi devant un litige, pas le journal applicatif.
 */

import { prisma } from '@lerenom/db';
import type { Formule, MotifRefus, ProCandidat } from '@lerenom/core';
import {
  coutAcceptation,
  demandeComplete,
  demandePerimee,
  etatForfait,
  peutEncoreDistribuer,
  peutEtreRePropose,
  placesRestantes,
  planifieCascadePartagee,
  planifieCascadeUrgente,
  rapproche,
} from '@lerenom/core';
import { creeLien } from '@lerenom/liens';
import { parametresEnVigueur } from './parametres.ts';

export interface ResultatDistribution {
  readonly demandeId: string;
  readonly reference: string;
  /** Les entreprises à qui la demande vient d'être envoyée. */
  readonly envoyes: readonly string[];
  /** Les pros écartés, avec leur raison, pour le centre de distribution. */
  readonly ecartes: readonly { readonly entrepriseId: string; readonly explication: string }[];
  readonly statut: string;
}

/**
 * `core` nomme les motifs avec des tirets — c'est la forme qui s'affiche — et l'énumération
 * PostgreSQL les nomme avec des soulignés. La conversion est explicite ici, une seule fois,
 * plutôt que dispersée en littéraux dans les requêtes.
 */
const MOTIF_VERS_BASE = {
  indisponible: 'indisponible',
  'trop-loin': 'trop_loin',
  'pas-mon-metier': 'pas_mon_metier',
  'budget-trop-bas': 'budget_trop_bas',
} as const;

const MOTIF_DEPUIS_BASE = {
  indisponible: 'indisponible',
  trop_loin: 'trop-loin',
  pas_mon_metier: 'pas-mon-metier',
  budget_trop_bas: 'budget-trop-bas',
} as const;

/** Mois civil au format AAAA-MM, celui qui porte les quotas. */
function moisCourant(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Charge les professionnels candidats à une demande, sous la forme attendue par `rapproche`.
 *
 * Le filtrage grossier se fait en SQL — métier déclaré, zone couverte, compte vivant — et c'est
 * `rapproche` qui tranche l'éligibilité réelle et nomme la raison de chaque exclusion.
 */
async function candidats(
  metierId: string,
  communeCode: string,
  dejaSollicites: readonly string[],
): Promise<readonly ProCandidat[]> {
  const mois = moisCourant();

  const entreprises = await prisma.entreprise.findMany({
    where: {
      id: { notIn: [...dejaSollicites] },
      suspendue: false,
      retireeLe: null,
      metiers: { some: { metierId } },
      zones: { some: { communeId: communeCode } },
    },
    include: {
      // La commune de l'agence vient avec : elle porte un point de référence, qui sert de
      // position de repli tant que l'adresse exacte n'est pas géocodée. Voir plus bas.
      agences: { include: { commune: { select: { latitude: true, longitude: true } } } },
      abonnements: { where: { statut: 'actif' }, take: 1 },
      quotas: { where: { mois }, take: 1 },
      exclusivites: { where: { metierId, communeId: communeCode, active: true }, take: 1 },
      scores: { orderBy: { jour: 'desc' }, take: 1 },
      zones: { select: { communeId: true } },
    },
  });

  return entreprises.map((entreprise) => {
    const abonnement = entreprise.abonnements[0];
    const formule: Formule = abonnement?.formule ?? 'gratuit';
    const communesDuPro = entreprise.zones.map((z) => z.communeId);

    return {
      entrepriseId: entreprise.id,
      formule,
      score: entreprise.scores[0]?.score ?? 0,
      note: entreprise.noteMoyenne,
      titulaireExclusivite: entreprise.exclusivites.length > 0,
      metierCorrespond: true,
      disponible: entreprise.disponible,
      // Un compte est à jour tant qu'il n'est ni suspendu ni impayé.
      compteAJour: abonnement === undefined || abonnement.statut === 'actif',
      agences: entreprise.agences.map((agence) => ({
        agenceId: agence.id,
        ...positionDe(agence),
        rayonKm: agence.rayonKm,
        // Tant que le géocodage n'a pas tourné, ce sont les villes déclarées par le pro qui
        // définissent sa zone — le cahier des charges autorise explicitement ce mode.
        communesCouvertes: communesDuPro,
      })),
      demandesAccepteesCeMois: entreprise.quotas[0]?.demandesAcceptees ?? 0,
    };
  });
}

/** La position d'une demande : l'adresse du client si elle est géocodée, sa commune sinon. */
function positionDemande(demande: {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly commune: { readonly latitude: number | null; readonly longitude: number | null };
}): { latitude: number; longitude: number } | null {
  if (demande.latitude !== null && demande.longitude !== null) {
    return { latitude: demande.latitude, longitude: demande.longitude };
  }
  if (demande.commune.latitude !== null && demande.commune.longitude !== null) {
    return { latitude: demande.commune.latitude, longitude: demande.commune.longitude };
  }
  return null;
}

/**
 * La position d'une agence : son adresse géocodée, sinon le point de sa commune.
 *
 * Le repli n'est pas un pis-aller honteux, c'est la granularité dont on dispose : les
 * communes franciliennes sont distantes de kilomètres, et ce qu'on calcule est un
 * **classement** — « celui-ci est plus près que celui-là » —, pas un itinéraire. Deux
 * artisans de la même commune se retrouvent à égalité de distance, et les autres critères
 * les départagent ; c'est exactement ce qu'on veut dire quand on ne sait rien de plus.
 *
 * Le repli est calculé **à la lecture** et non recopié dans la colonne de l'agence. Trois
 * valeurs dérivées stockées nous ont déjà menti dans ce projet (voir `docs/PLAN.md`) : une
 * position recopiée ne suivrait pas une correction du point de la commune, et personne ne
 * s'en apercevrait.
 */
function positionDe(agence: {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly commune: { readonly latitude: number | null; readonly longitude: number | null };
}): { position?: { latitude: number; longitude: number } } {
  if (agence.latitude !== null && agence.longitude !== null) {
    return { position: { latitude: agence.latitude, longitude: agence.longitude } };
  }
  if (agence.commune.latitude !== null && agence.commune.longitude !== null) {
    return { position: { latitude: agence.commune.latitude, longitude: agence.commune.longitude } };
  }
  return {};
}

/** Les entreprises déjà sollicitées sur cette demande, à ne jamais solliciter deux fois. */
async function dejaSollicites(demandeId: string): Promise<string[]> {
  const lignes = await prisma.distribution.findMany({
    where: { demandeId },
    select: { entrepriseId: true },
  });
  return lignes.map((l) => l.entrepriseId);
}

/**
 * Démarre ou poursuit la cascade d'une demande.
 *
 * Appelée à la vérification du téléphone, puis à chaque refus et à chaque expiration. Elle est
 * **idempotente par pro** : une entreprise déjà sollicitée ne l'est jamais une seconde fois,
 * et le plafond de 3 professionnels est vérifié avant chaque envoi.
 */
export async function avanceCascade(demandeId: string): Promise<ResultatDistribution> {
  const parametres = await parametresEnVigueur();

  const demande = await prisma.demande.findUniqueOrThrow({
    where: { id: demandeId },
    include: { distributions: true, commune: true },
  });

  const etat = {
    objectif: demande.objectifPros,
    acceptes: demande.distributions
      .filter((d) => d.statut === 'acceptee')
      .map((d) => d.entrepriseId),
    refus: demande.distributions
      .filter((d) => d.statut === 'refusee')
      .map((d) => ({
        entrepriseId: d.entrepriseId,
        motif: MOTIF_DEPUIS_BASE[d.motifRefus ?? 'indisponible'],
      })),
    expires: demande.distributions.filter((d) => d.statut === 'expiree').map((d) => d.entrepriseId),
    enCours: demande.distributions
      .filter((d) => d.statut === 'envoyee' || d.statut === 'ouverte')
      .map((d) => d.entrepriseId),
    heuresDepuisDepot: (Date.now() - demande.deposeeLe.getTime()) / 3_600_000,
    enPause: demande.statut === 'en_pause',
    suspecte: demande.statut === 'suspecte',
  };

  const base = { demandeId, reference: demande.reference };

  // Une demande non vérifiée ne part nulle part : c'est la règle, et la première barrière
  // contre les demandes fantaisistes.
  if (demande.telephoneVerifieLe === null) {
    return { ...base, envoyes: [], ecartes: [], statut: 'en-attente-de-verification' };
  }

  if (demande.statut === 'en_attente_ouverture') {
    return { ...base, envoyes: [], ecartes: [], statut: 'en-attente-ouverture' };
  }

  if (demandeComplete(etat)) {
    await prisma.demande.update({
      where: { id: demandeId },
      data: { statut: 'complete', clotureeLe: new Date() },
    });
    return { ...base, envoyes: [], ecartes: [], statut: 'complete' };
  }

  if (demandePerimee(etat, parametres)) {
    await prisma.demande.update({
      where: { id: demandeId },
      data: { statut: 'perimee', perimeeLe: new Date() },
    });
    return { ...base, envoyes: [], ecartes: [], statut: 'perimee' };
  }

  if (!peutEncoreDistribuer(etat, parametres)) {
    const statut = etat.enCours.length > 0 ? 'en_distribution' : 'sans_preneur';
    await prisma.demande.update({ where: { id: demandeId }, data: { statut } });
    if (statut === 'sans_preneur') await alerteSansPreneur(demandeId, demande.reference);
    return { ...base, envoyes: [], ecartes: [], statut };
  }

  // Un pro dont l'échéance court garde la main : on n'envoie pas au suivant avant son terme.
  if (etat.enCours.length > 0) {
    return { ...base, envoyes: [], ecartes: [], statut: 'en_distribution' };
  }

  if (demande.metierId === null) {
    return { ...base, envoyes: [], ecartes: [], statut: 'a-classer' };
  }

  const sollicites = await dejaSollicites(demandeId);
  // Même repli que pour les agences : l'adresse du client si elle a été géocodée, le point
  // de sa commune sinon. Comparer une adresse précise à un point communal n'aurait d'ailleurs
  // pas grand sens — mieux vaut deux approximations de même grain.
  const position = positionDemande(demande);
  const { retenus, ecartes } = rapproche(
    await candidats(demande.metierId, demande.communeId, sollicites),
    {
      communeCode: demande.communeId,
      ...(position !== null ? { position } : {}),
    },
    parametres,
  );

  // Il reste autant de places que de professionnels pouvant encore obtenir la demande.
  const places = placesRestantes(etat);
  const cascade =
    demande.urgence === 'urgente'
      ? planifieCascadeUrgente(retenus, parametres)
      : planifieCascadePartagee(retenus, parametres);

  // Un seul tour à la fois : on envoie au groupe le plus proche dans le temps, puis on attend
  // son échéance. C'est ce qui donne à l'Exclusif ses 30 minutes de solitude.
  const premierDepart = cascade[0]?.minutesApresDepot;
  const aEnvoyer = cascade
    .filter((etape) => etape.minutesApresDepot === premierDepart)
    .slice(0, Math.max(0, places));

  if (aEnvoyer.length === 0) {
    await prisma.demande.update({ where: { id: demandeId }, data: { statut: 'sans_preneur' } });
    await alerteSansPreneur(demandeId, demande.reference);
    return {
      ...base,
      envoyes: [],
      ecartes: ecartes.map((e) => ({ entrepriseId: e.entrepriseId, explication: e.explication })),
      statut: 'sans_preneur',
    };
  }

  const rangDepart = demande.distributions.length;
  const maintenant = Date.now();

  await prisma.$transaction(
    aEnvoyer.map((etape, index) =>
      prisma.distribution.create({
        data: {
          demandeId,
          entrepriseId: etape.entrepriseId,
          agenceId: etape.agenceId,
          rang: rangDepart + index + 1,
          tour: etape.tour,
          raisonRang:
            etape.raisonRang === 'exclusif-de-la-zone'
              ? 'exclusif_de_la_zone'
              : etape.raisonRang === 'premium-le-moins-servi'
                ? 'premium_le_moins_servi'
                : 'score_et_proximite',
          statut: 'envoyee',
          echeanceLe: new Date(maintenant + etape.minutesPourRepondre * 60_000),
          distanceKm:
            retenus.find((r) => r.entrepriseId === etape.entrepriseId)?.distanceKm ?? null,
        },
      }),
    ),
  );

  await prisma.demande.update({ where: { id: demandeId }, data: { statut: 'en_distribution' } });
  await notifie(
    demandeId,
    aEnvoyer.map((e) => e.entrepriseId),
  );

  return {
    ...base,
    envoyes: aEnvoyer.map((e) => e.entrepriseId),
    ecartes: ecartes.map((e) => ({ entrepriseId: e.entrepriseId, explication: e.explication })),
    statut: 'en_distribution',
  };
}

/** Un pro n'a pas répondu dans son délai : la demande passe au suivant, sans rien lui facturer. */
export async function expire(distributionId: string): Promise<ResultatDistribution | null> {
  const distribution = await prisma.distribution.findUnique({ where: { id: distributionId } });
  if (distribution === null) return null;
  if (distribution.statut !== 'envoyee' && distribution.statut !== 'ouverte') return null;

  await prisma.distribution.update({
    where: { id: distributionId },
    data: { statut: 'expiree' },
  });

  // Trois expirations de suite : le pro ne reçoit plus rien jusqu'à sa reconnexion.
  await verifieExpirationsConsecutives(distribution.entrepriseId);

  return avanceCascade(distribution.demandeId);
}

/**
 * Un pro refuse. C'est gratuit, et le motif est obligatoire : « pas mon métier » signale la
 * demande au classement, « trop loin » invite le pro à ajuster son rayon.
 */
export async function refuse(
  distributionId: string,
  motif: MotifRefus,
): Promise<ResultatDistribution | null> {
  const distribution = await prisma.distribution.findUnique({ where: { id: distributionId } });
  if (distribution === null) return null;
  if (distribution.statut === 'acceptee') {
    throw new Error(
      'Une demande acceptée ne peut plus être refusée : l’acceptation est définitive.',
    );
  }

  await prisma.distribution.update({
    where: { id: distributionId },
    data: { statut: 'refusee', motifRefus: MOTIF_VERS_BASE[motif], repondueLe: new Date() },
  });

  if (motif === 'pas-mon-metier') {
    await prisma.tacheAValider.create({
      data: {
        type: 'classement-demande',
        objetId: distribution.demandeId,
        explication:
          'Un professionnel a refusé cette demande avec le motif « pas mon métier » : le classement automatique est peut-être à corriger.',
      },
    });
  }

  return avanceCascade(distribution.demandeId);
}

/**
 * Un pro accepte. L'acceptation est **définitive** : elle débloque les coordonnées du client et
 * ne s'annule pas. Le forfait est décompté, ou la demande facturée au prix de la formule.
 */
export async function accepte(distributionId: string): Promise<{
  readonly montantHT: number;
  readonly consommeForfait: boolean;
}> {
  const parametres = await parametresEnVigueur();

  const resultat = await prisma.$transaction(async (tx) => {
    // Verrou : deux acceptations simultanées sur une urgence ne peuvent pas passer toutes deux.
    const [verrouillee] = await tx.$queryRaw<{ id: string; demande_id: string; statut: string }[]>`
      SELECT id, demande_id, statut FROM distributions WHERE id = ${distributionId} FOR UPDATE
    `;
    if (verrouillee === undefined) throw new Error('Distribution inconnue.');
    if (verrouillee.statut === 'acceptee') {
      throw new Error('Cette demande a déjà été acceptée.');
    }
    if (verrouillee.statut === 'refusee' || verrouillee.statut === 'expiree') {
      throw new Error('Cette demande n’est plus disponible.');
    }

    const demande = await tx.demande.findUniqueOrThrow({
      where: { id: verrouillee.demande_id },
      include: { distributions: { where: { statut: 'acceptee' } } },
    });

    if (demande.distributions.length >= demande.objectifPros) {
      throw new Error('Cette demande a déjà trouvé ses professionnels.');
    }

    const distribution = await tx.distribution.findUniqueOrThrow({ where: { id: distributionId } });
    const abonnement = await tx.abonnement.findFirst({
      where: { entrepriseId: distribution.entrepriseId, statut: 'actif' },
    });
    const formule: Formule = abonnement?.formule ?? 'gratuit';
    const mois = moisCourant();

    const quota = await tx.quotaMensuel.upsert({
      where: { entrepriseId_mois: { entrepriseId: distribution.entrepriseId, mois } },
      update: {},
      create: {
        entrepriseId: distribution.entrepriseId,
        mois,
        formule,
        demandesIncluses: parametres.demandesIncluses[formule],
      },
    });

    const type =
      demande.urgence === 'urgente'
        ? 'urgente'
        : demande.type === 'directe'
          ? 'directe'
          : 'partagee';
    const cout = coutAcceptation(formule, type, quota.demandesAcceptees, parametres);
    if (cout === null) {
      throw new Error('Cette formule n’a pas accès aux demandes urgentes.');
    }

    await tx.distribution.update({
      where: { id: distributionId },
      data: {
        statut: 'acceptee',
        repondueLe: new Date(),
        montantHT: cout.montantHT,
        consommeForfait: cout.consommeForfait,
      },
    });

    await tx.quotaMensuel.update({
      where: { id: quota.id },
      data: {
        ...(cout.consommeForfait ? { demandesAcceptees: { increment: 1 } } : {}),
        ...(type === 'urgente' ? { urgencesAcceptees: { increment: 1 } } : {}),
        ...(cout.montantHT > 0 ? { depenseHT: { increment: cout.montantHT } } : {}),
      },
    });

    await tx.suiviDemande.create({
      data: { demandeId: demande.id, entrepriseId: distribution.entrepriseId, etape: 'acceptee' },
    });

    const acceptes = demande.distributions.length + 1;
    if (acceptes >= demande.objectifPros) {
      await tx.demande.update({
        where: { id: demande.id },
        data: { statut: 'complete', clotureeLe: new Date() },
      });
    }

    // Alerte à 80 % du forfait, au pro comme à l'administrateur.
    const forfait = etatForfait(
      formule,
      quota.demandesAcceptees + (cout.consommeForfait ? 1 : 0),
      parametres,
    );
    if (forfait.alerte && quota.alerteEnvoyeeLe === null) {
      await tx.quotaMensuel.update({
        where: { id: quota.id },
        data: { alerteEnvoyeeLe: new Date() },
      });
      await tx.alerte.create({
        data: {
          type: 'pro_trois_expirations',
          gravite: 'basse',
          titre: 'Forfait bientôt épuisé',
          explication: `${forfait.consommees} demandes sur ${forfait.incluses} consommées ce mois-ci.`,
          objetId: distribution.entrepriseId,
        },
      });
    }

    return { montantHT: cout.montantHT, consommeForfait: cout.consommeForfait };
  });

  // Le client est prévenu **après** la transaction : un envoi de message ne doit jamais
  // pouvoir faire échouer une acceptation déjà acquise.
  await previentLeClient(distributionId);

  return resultat;
}

/**
 * Prévient le client qu'un professionnel a accepté, et lui donne son lien de suivi.
 *
 * Le lien est la seule porte du client : il n'a pas de compte. On lui en crée un à chaque
 * acceptation plutôt que d'en réutiliser un — le jeton n'est jamais conservé en clair, donc on
 * ne saurait pas le lui renvoyer. Les deux liens ouvrent la même page.
 *
 * Un échec ici ne remonte pas : l'acceptation est acquise, la facturation aussi, et un SMS
 * manquant se rattrape depuis le back-office. Il laisse en revanche une alerte.
 */
async function previentLeClient(distributionId: string): Promise<void> {
  try {
    const distribution = await prisma.distribution.findUniqueOrThrow({
      where: { id: distributionId },
      select: {
        demande: {
          select: {
            id: true,
            reference: true,
            clientPrenom: true,
            clientEmail: true,
            clientTelephone: true,
            commune: { select: { nom: true } },
            prestation: { select: { nom: true } },
          },
        },
        entreprise: { select: { nom: true } },
      },
    });

    const demande = distribution.demande;
    const pro = distribution.entreprise.nom;
    const besoin = demande.prestation?.nom ?? 'votre demande';
    const lien = await creeLien(demande.id, 'voir_pros');

    const corps =
      `Le Renom : ${pro} a accepté ${besoin}. ` +
      `Ses coordonnées : ${lien.url} (demande ${demande.reference}).`;

    await prisma.messageSortant.createMany({
      data: [
        {
          demandeId: demande.id,
          canal: 'sms',
          modele: 'pro-a-accepte',
          destinataire: demande.clientTelephone,
          corps,
          statut: 'en_attente',
        },
        {
          demandeId: demande.id,
          canal: 'email',
          modele: 'pro-a-accepte',
          destinataire: demande.clientEmail,
          sujet: `${pro} a accepté votre demande`,
          corps,
          statut: 'en_attente',
        },
      ],
    });
  } catch (erreur) {
    await prisma.alerte.create({
      data: {
        type: 'message_non_envoye',
        gravite: 'moyenne',
        titre: 'Client non prévenu d’une acceptation',
        explication: erreur instanceof Error ? erreur.message : String(erreur),
        objetId: distributionId,
      },
    });
  }
}

/**
 * Re-proposer une demande à un pro qui l'a refusée. Une seule fois, jamais après un
 * « pas mon métier ».
 */
export async function reProposer(
  distributionId: string,
  parAdministrateur: boolean,
  auteur?: string,
): Promise<boolean> {
  const parametres = await parametresEnVigueur();
  const distribution = await prisma.distribution.findUnique({ where: { id: distributionId } });
  if (distribution === null || distribution.statut !== 'refusee') return false;

  const motif = MOTIF_DEPUIS_BASE[distribution.motifRefus ?? 'indisponible'];
  if (!peutEtreRePropose(motif, distribution.reproposeeLe !== null, parAdministrateur))
    return false;

  await prisma.distribution.update({
    where: { id: distributionId },
    data: {
      statut: 'envoyee',
      motifRefus: null,
      repondueLe: null,
      reproposeeLe: new Date(),
      raisonRang: 're_proposition',
      echeanceLe: new Date(Date.now() + parametres.minutesReponseAutresPros * 60_000),
      manuel: parAdministrateur,
      ...(auteur !== undefined ? { auteur } : {}),
    },
  });

  await notifie(distribution.demandeId, [distribution.entrepriseId]);
  return true;
}

/* ------------------------------------------------------------------------- */
/* Effets de bord                                                             */
/* ------------------------------------------------------------------------- */

/** Met en file les messages d'alerte aux professionnels : notification, SMS et e-mail. */
async function notifie(demandeId: string, entrepriseIds: readonly string[]): Promise<void> {
  if (entrepriseIds.length === 0) return;

  const [demande, utilisateurs] = await Promise.all([
    prisma.demande.findUniqueOrThrow({
      where: { id: demandeId },
      include: { prestation: true, commune: true },
    }),
    prisma.utilisateurPro.findMany({ where: { entrepriseId: { in: [...entrepriseIds] } } }),
  ]);

  const besoin = demande.prestation?.nom ?? 'Nouvelle demande';
  const ville = demande.commune.nom.replace(/\s+Arrondissement$/i, '');

  interface MessageAEnvoyer {
    demandeId: string;
    canal: 'sms' | 'email';
    modele: string;
    destinataire: string;
    sujet: string | null;
    corps: string;
    statut: 'en_attente';
  }

  await prisma.messageSortant.createMany({
    data: utilisateurs.flatMap((utilisateur): MessageAEnvoyer[] => {
      const corps = `Le Renom : une demande « ${besoin} » à ${ville} vous attend. Référence ${demande.reference}.`;
      const messages: MessageAEnvoyer[] = [
        {
          demandeId,
          canal: 'email',
          modele: 'demande-recue',
          destinataire: utilisateur.email,
          sujet: `Nouvelle demande à ${ville} : ${besoin}`,
          corps,
          statut: 'en_attente',
        },
      ];
      if (utilisateur.telephone !== null) {
        messages.push({
          demandeId,
          canal: 'sms',
          modele: 'demande-recue',
          destinataire: utilisateur.telephone,
          sujet: null,
          corps,
          statut: 'en_attente',
        });
      }
      return messages;
    }),
  });
}

async function alerteSansPreneur(demandeId: string, reference: string): Promise<void> {
  const existante = await prisma.alerte.findFirst({
    where: { type: 'demande_sans_preneur', objetId: demandeId, traiteeLe: null },
  });
  if (existante !== null) return;

  await prisma.alerte.create({
    data: {
      type: 'demande_sans_preneur',
      gravite: 'haute',
      titre: `Demande ${reference} sans preneur`,
      explication:
        'Tous les professionnels éligibles ont refusé ou laissé expirer. Élargissez la zone, envoyez à la main, ou prévenez le client.',
      objetId: demandeId,
    },
  });
}

/** Trois expirations de suite : les envois sont suspendus jusqu'à la reconnexion du pro. */
async function verifieExpirationsConsecutives(entrepriseId: string): Promise<void> {
  const trois = await prisma.distribution.findMany({
    where: { entrepriseId },
    orderBy: { envoyeeLe: 'desc' },
    take: 3,
    select: { statut: true },
  });

  if (trois.length < 3 || !trois.every((d) => d.statut === 'expiree')) return;

  await prisma.entreprise.update({ where: { id: entrepriseId }, data: { disponible: false } });
  await prisma.alerte.create({
    data: {
      type: 'pro_trois_expirations',
      gravite: 'moyenne',
      titre: 'Trois demandes laissées expirer de suite',
      explication:
        'Les envois sont suspendus pour ce professionnel jusqu’à ce qu’il se reconnecte et se redéclare disponible.',
      objetId: entrepriseId,
    },
  });
}
