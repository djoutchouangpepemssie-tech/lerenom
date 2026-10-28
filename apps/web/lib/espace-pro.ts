/**
 * Ce qu'un professionnel voit de son espace.
 *
 * Une règle gouverne tout ce fichier : **les coordonnées du client ne sortent de la base que
 * si le professionnel a accepté la demande.** Ce n'est pas une affaire d'affichage, c'est la
 * promesse faite au client au moment où il a déposé sa demande, et elle se tient dans la
 * requête — sinon elle ne tient nulle part.
 */

import { prisma } from '@lerenom/db';
import { coutAcceptation, type Formule, type TypeDemande } from '@lerenom/core';
import { parametresEnVigueur } from '@lerenom/distribution';
import { aLaVille, nomVille } from '@/lib/affichage';

export interface DemandeEnAttente {
  readonly distributionId: string;
  readonly reference: string;
  readonly besoin: string;
  readonly ville: string;
  readonly quartier: string | null;
  readonly description: string;
  readonly urgence: string;
  readonly budget: string | null;
  readonly rang: number;
  readonly raisonRang: string;
  readonly envoyeeLe: Date;
  readonly echeanceLe: Date;
  readonly montantHT: number;
  readonly consommeForfait: boolean;
  readonly distanceKm: number | null;
  /**
   * Ce que l'acceptation coûtera, dit avant le clic.
   *
   * Le prix n'est inscrit dans la distribution qu'**au moment de l'acceptation** : avant, le
   * champ vaut zéro. Afficher ce zéro reviendrait à annoncer « gratuite » une demande
   * facturée 12 €. On recalcule donc le coût réel, avec la formule et le forfait du mois.
   * `null` quand la formule n'ouvre pas droit à cette demande — une urgence pour un Gratuit.
   */
  readonly libelleAcceptation: string | null;
}

export interface DemandeAcceptee extends DemandeEnAttente {
  /** Les coordonnées, qui n'existent qu'ici : après acceptation, et jamais avant. */
  readonly clientPrenom: string;
  readonly clientTelephone: string;
  readonly clientEmail: string;
  readonly adresse: string | null;
  readonly accepteeLe: Date | null;
  readonly travauxDeclares: boolean;
}

const RAISONS: Readonly<Record<string, string>> = {
  exclusif_de_la_zone: 'Votre exclusivité sur cette ville',
  premium_le_moins_servi: 'Rotation Premium : vous étiez le moins servi',
  score_et_proximite: 'Votre score et votre proximité',
  choix_du_client: 'Le client vous a choisi',
  envoi_manuel: 'Envoi par un conseiller',
  re_proposition: 'Demande re-proposée',
};

/** Le libellé du budget, quand le client en a donné un. */
function budget(min: unknown, max: unknown): string | null {
  const bas = min === null ? null : Number(min);
  const haut = max === null ? null : Number(max);
  if (bas === null && haut === null) return null;
  if (bas !== null && haut !== null) return `${String(bas)} à ${String(haut)} €`;
  if (bas !== null) return `à partir de ${String(bas)} €`;
  return `jusqu’à ${String(haut)} €`;
}

/** Les demandes qui attendent une réponse. Aucune coordonnée n'est lue. */
export async function demandesEnAttente(
  entrepriseId: string,
): Promise<readonly DemandeEnAttente[]> {
  const mois = new Date().toISOString().slice(0, 7);

  const [parametres, abonnement, quota] = await Promise.all([
    parametresEnVigueur(),
    prisma.abonnement.findFirst({
      where: { entrepriseId, statut: 'actif' },
      select: { formule: true },
    }),
    prisma.quotaMensuel.findFirst({
      where: { entrepriseId, mois },
      select: { demandesAcceptees: true },
    }),
  ]);

  const formule: Formule = abonnement?.formule ?? 'gratuit';
  const dejaAcceptees = quota?.demandesAcceptees ?? 0;

  const distributions = await prisma.distribution.findMany({
    where: { entrepriseId, statut: { in: ['envoyee', 'ouverte'] } },
    orderBy: { echeanceLe: 'asc' },
    select: {
      id: true,
      rang: true,
      raisonRang: true,
      envoyeeLe: true,
      echeanceLe: true,
      montantHT: true,
      consommeForfait: true,
      distanceKm: true,
      demande: {
        select: {
          reference: true,
          type: true,
          description: true,
          urgence: true,
          budgetMin: true,
          budgetMax: true,
          commune: { select: { nom: true } },
          quartier: true,
          prestation: { select: { nom: true } },
          metier: { select: { nom: true } },
        },
      },
    },
  });

  return distributions.map((distribution) => {
    const type: TypeDemande =
      distribution.demande.urgence === 'urgente'
        ? 'urgente'
        : distribution.demande.type === 'directe'
          ? 'directe'
          : 'partagee';
    const cout = coutAcceptation(formule, type, dejaAcceptees, parametres);

    return {
      distributionId: distribution.id,
      reference: distribution.demande.reference,
      besoin: distribution.demande.prestation?.nom ?? distribution.demande.metier?.nom ?? 'Demande',
      ville: nomVille(distribution.demande.commune.nom),
      quartier: distribution.demande.quartier,
      description: distribution.demande.description,
      urgence: distribution.demande.urgence,
      budget: budget(distribution.demande.budgetMin, distribution.demande.budgetMax),
      rang: distribution.rang,
      raisonRang: RAISONS[distribution.raisonRang] ?? distribution.raisonRang,
      envoyeeLe: distribution.envoyeeLe,
      echeanceLe: distribution.echeanceLe,
      montantHT: cout?.montantHT ?? 0,
      consommeForfait: cout?.consommeForfait ?? false,
      distanceKm: distribution.distanceKm,
      libelleAcceptation: cout?.libelleBouton ?? null,
    };
  });
}

/** Les demandes acceptées, avec les coordonnées — c'est ce que le professionnel a payé. */
export async function demandesAcceptees(
  entrepriseId: string,
  limite = 30,
): Promise<readonly DemandeAcceptee[]> {
  const distributions = await prisma.distribution.findMany({
    where: { entrepriseId, statut: 'acceptee' },
    orderBy: { repondueLe: 'desc' },
    take: limite,
    select: {
      id: true,
      rang: true,
      raisonRang: true,
      envoyeeLe: true,
      echeanceLe: true,
      repondueLe: true,
      montantHT: true,
      consommeForfait: true,
      distanceKm: true,
      demande: {
        select: {
          id: true,
          reference: true,
          description: true,
          urgence: true,
          budgetMin: true,
          budgetMax: true,
          adresse: true,
          clientPrenom: true,
          clientTelephone: true,
          clientEmail: true,
          commune: { select: { nom: true } },
          quartier: true,
          prestation: { select: { nom: true } },
          metier: { select: { nom: true } },
          suivis: { where: { entrepriseId }, select: { etape: true } },
        },
      },
    },
  });

  return distributions.map((distribution) => ({
    distributionId: distribution.id,
    reference: distribution.demande.reference,
    besoin: distribution.demande.prestation?.nom ?? distribution.demande.metier?.nom ?? 'Demande',
    ville: nomVille(distribution.demande.commune.nom),
    quartier: distribution.demande.quartier,
    description: distribution.demande.description,
    urgence: distribution.demande.urgence,
    budget: budget(distribution.demande.budgetMin, distribution.demande.budgetMax),
    rang: distribution.rang,
    raisonRang: RAISONS[distribution.raisonRang] ?? distribution.raisonRang,
    envoyeeLe: distribution.envoyeeLe,
    echeanceLe: distribution.echeanceLe,
    montantHT: Number(distribution.montantHT),
    consommeForfait: distribution.consommeForfait,
    distanceKm: distribution.distanceKm,
    // Déjà acceptée : le prix n'est plus une estimation, c'est ce qui a été facturé.
    libelleAcceptation: null,
    clientPrenom: distribution.demande.clientPrenom,
    clientTelephone: distribution.demande.clientTelephone,
    clientEmail: distribution.demande.clientEmail,
    adresse: distribution.demande.adresse,
    accepteeLe: distribution.repondueLe,
    travauxDeclares: distribution.demande.suivis.some(
      (suivi) => suivi.etape === 'travaux_realises',
    ),
  }));
}

export interface ChiffresDuMois {
  readonly formule: string;
  readonly demandesIncluses: number;
  readonly demandesAcceptees: number;
  readonly depenseHT: number;
  readonly enAttente: number;
  readonly tauxReponse: number | null;
  readonly note: number | null;
  readonly nombreAvis: number;
  readonly ville: string | null;
}

/** Les chiffres du tableau de bord. Rien d'inventé : tout vient des tables. */
export async function chiffresDuMois(entrepriseId: string): Promise<ChiffresDuMois> {
  const mois = new Date().toISOString().slice(0, 7);

  const [entreprise, abonnement, quota, enAttente, recues, repondues, agence] = await Promise.all([
    prisma.entreprise.findUniqueOrThrow({
      where: { id: entrepriseId },
      select: { noteMoyenne: true, nombreAvis: true },
    }),
    prisma.abonnement.findFirst({
      where: { entrepriseId, statut: 'actif' },
      select: { formule: true },
    }),
    prisma.quotaMensuel.findFirst({
      where: { entrepriseId, mois },
      select: { demandesIncluses: true, demandesAcceptees: true, depenseHT: true },
    }),
    prisma.distribution.count({ where: { entrepriseId, statut: { in: ['envoyee', 'ouverte'] } } }),
    prisma.distribution.count({ where: { entrepriseId } }),
    prisma.distribution.count({
      where: { entrepriseId, statut: { in: ['acceptee', 'refusee'] } },
    }),
    prisma.agence.findFirst({
      where: { entrepriseId },
      orderBy: { principale: 'desc' },
      select: { commune: { select: { nom: true } } },
    }),
  ]);

  return {
    formule: abonnement?.formule ?? 'gratuit',
    demandesIncluses: quota?.demandesIncluses ?? 0,
    demandesAcceptees: quota?.demandesAcceptees ?? 0,
    depenseHT: Number(quota?.depenseHT ?? 0),
    enAttente,
    // Le taux de réponse n'a pas de sens sans demandes : on affiche « — », pas 0 %.
    tauxReponse: recues === 0 ? null : repondues / recues,
    note: entreprise.noteMoyenne,
    nombreAvis: entreprise.nombreAvis,
    ville: agence === null ? null : aLaVille(agence.commune.nom),
  };
}
