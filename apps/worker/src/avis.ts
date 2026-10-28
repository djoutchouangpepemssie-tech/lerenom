/**
 * Les invitations à déposer un avis.
 *
 * La charte publique l'annonce : « l'invitation à déposer un avis part quinze jours après les
 * travaux ». C'est ce que fait ce module, une fois par nuit — le délai venant des paramètres,
 * jamais d'un nombre écrit ici.
 *
 * Un seul chemin mène à un avis : cette invitation. Il n'existe pas de formulaire libre, pas
 * d'import, pas d'avis collecté ailleurs. C'est ce qui permet d'écrire « avis vérifié » sans
 * mentir, et ce que l'article L111-7-2 du code de la consommation attend d'une plateforme.
 */

import { prisma } from '@lerenom/db';
import { invitationAvisDue } from '@lerenom/core';
import { creeLien } from '@lerenom/liens';
import { parametresEnVigueur } from './parametres.ts';

export interface BilanInvitations {
  readonly examinees: number;
  readonly envoyees: number;
}

/**
 * Envoie les invitations dues.
 *
 * On part des travaux déclarés réalisés, pas des acceptations : un professionnel qui a accepté
 * sans jamais intervenir ne doit pas récolter d'avis.
 */
export async function inviteAuxAvis(maintenant: Date = new Date()): Promise<BilanInvitations> {
  const parametres = await parametresEnVigueur();

  // On ne remonte pas plus loin que le double du délai : au-delà, l'invitation n'a plus de
  // sens, et une demande oubliée ne doit pas réveiller un client des mois après.
  const plancher = new Date(
    maintenant.getTime() - 2 * parametres.joursDemandeAvis * 24 * 3_600_000,
  );

  const travaux = await prisma.suiviDemande.findMany({
    where: { etape: 'travaux_realises', creeLe: { gte: plancher } },
    select: { demandeId: true, entrepriseId: true, creeLe: true },
    orderBy: { creeLe: 'asc' },
  });

  let envoyees = 0;

  for (const travail of travaux) {
    const [avis, dejaInvite, demande] = await Promise.all([
      prisma.avis.findUnique({ where: { demandeId: travail.demandeId }, select: { id: true } }),
      prisma.lienAction.findFirst({
        where: { demandeId: travail.demandeId, action: 'deposer_avis' },
        select: { id: true },
      }),
      prisma.demande.findUnique({
        where: { id: travail.demandeId },
        select: {
          reference: true,
          clientPrenom: true,
          clientEmail: true,
          clientTelephone: true,
          annuleeLe: true,
        },
      }),
    ]);

    if (avis !== null || demande === null || demande.annuleeLe !== null) continue;
    if (
      !invitationAvisDue(
        travail.creeLe,
        dejaInvite !== null,
        parametres.joursDemandeAvis,
        maintenant,
      )
    ) {
      continue;
    }

    const entreprise = await prisma.entreprise.findUnique({
      where: { id: travail.entrepriseId },
      select: { nom: true },
    });
    if (entreprise === null) continue;

    const lien = await creeLien(travail.demandeId, 'deposer_avis', travail.entrepriseId);
    const corps =
      `Le Renom : comment s’est passée votre intervention avec ${entreprise.nom} ? ` +
      `Votre avis en une minute : ${lien.url}`;

    await prisma.messageSortant.createMany({
      data: [
        {
          demandeId: travail.demandeId,
          canal: 'sms',
          modele: 'invitation-avis',
          destinataire: demande.clientTelephone,
          corps,
          statut: 'en_attente',
        },
        {
          demandeId: travail.demandeId,
          canal: 'email',
          modele: 'invitation-avis',
          destinataire: demande.clientEmail,
          sujet: `Votre avis sur ${entreprise.nom}`,
          corps,
          statut: 'en_attente',
        },
      ],
    });

    envoyees += 1;
  }

  return { examinees: travaux.length, envoyees };
}
