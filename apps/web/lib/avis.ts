/**
 * Ce qu'il faut savoir pour présenter — et accepter — un avis.
 *
 * Le lien d'invitation porte l'entreprise visée dans sa cible : c'est lui qui dit sur qui le
 * client est invité à se prononcer, et non un choix laissé ouvert dans le formulaire. Un client
 * ne doit pas pouvoir noter un professionnel qui n'est jamais intervenu chez lui.
 */

import { prisma } from '@lerenom/db';
import { droitDeDeposerUnAvis, type DroitAvis } from '@lerenom/core';

export interface ContexteAvis {
  readonly demandeId: string;
  readonly entrepriseId: string;
  readonly reference: string;
  readonly prenom: string;
  readonly nomPro: string;
  readonly villePro: string | null;
  readonly droit: DroitAvis;
}

/**
 * Rassemble ce qu'il faut pour afficher le formulaire, et vérifie le droit d'y répondre.
 *
 * `cibleId` est l'entreprise désignée par l'invitation. Sans elle, ou si elle n'a pas été
 * retenue sur cette demande, il n'y a pas d'avis possible : on ne devine pas.
 */
export async function contexteAvis(
  demandeId: string,
  cibleId: string | null,
): Promise<ContexteAvis | null> {
  if (cibleId === null) return null;

  const [demande, distribution, avis, travaux] = await Promise.all([
    prisma.demande.findUnique({
      where: { id: demandeId },
      select: { reference: true, clientPrenom: true, annuleeLe: true },
    }),
    prisma.distribution.findFirst({
      where: { demandeId, entrepriseId: cibleId, statut: 'acceptee' },
      select: {
        entreprise: { select: { nom: true } },
        agence: { select: { commune: { select: { nom: true } } } },
      },
    }),
    prisma.avis.findUnique({ where: { demandeId }, select: { id: true } }),
    prisma.suiviDemande.findFirst({
      where: { demandeId, entrepriseId: cibleId, etape: 'travaux_realises' },
      select: { creeLe: true },
      orderBy: { creeLe: 'asc' },
    }),
  ]);

  // Pas de demande, ou un professionnel qui n'a jamais obtenu cette demande : rien à noter.
  if (demande === null || distribution === null) return null;

  return {
    demandeId,
    entrepriseId: cibleId,
    reference: demande.reference,
    prenom: demande.clientPrenom,
    nomPro: distribution.entreprise.nom,
    villePro: distribution.agence?.commune.nom.replace(/\s+Arrondissement$/i, '') ?? null,
    droit: droitDeDeposerUnAvis({
      travauxRealisesLe: travaux?.creeLe ?? null,
      avisDejaDepose: avis !== null,
      demandeAnnuleeLe: demande.annuleeLe,
    }),
  };
}
