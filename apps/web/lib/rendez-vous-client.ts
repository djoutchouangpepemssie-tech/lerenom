import { prisma } from '@lerenom/db';
import { MESSAGE_REFUS, heureDe, peutRepondre, type StatutRendezVous } from '@lerenom/core';

/**
 * Ce qu'un client voit et peut faire d'un rendez-vous proposé.
 *
 * Même périmètre strict que partout ailleurs côté client : le rendez-vous que le jeton
 * désigne, et rien d'autre. Pas l'agenda du professionnel, pas ses autres clients.
 *
 * Accepter **rend la plage ferme** : son type passe de « proposé » à « intervention », ce qui
 * la soumet à la contrainte d'exclusion de la base. Si le professionnel a posé entretemps une
 * intervention au même horaire, la bascule échoue — et c'est le bon comportement : mieux vaut
 * dire au client que le créneau n'est plus libre que de l'inscrire deux fois.
 */

export interface RendezVousPourClient {
  readonly id: string;
  readonly statut: StatutRendezVous;
  readonly debut: Date;
  readonly fin: Date;
  readonly expireLe: Date | null;
  readonly entrepriseNom: string;
  readonly entrepriseTelephone: string | null;
  /** Le client peut-il encore répondre ? */
  readonly repondable: boolean;
  readonly raisonRefus: string | null;
}

export async function rendezVousPourClient(
  rendezVousId: string,
  maintenant: Date = new Date(),
): Promise<RendezVousPourClient | null> {
  const rendezVous = await prisma.rendezVous.findUnique({
    where: { id: rendezVousId },
    select: {
      id: true,
      statut: true,
      creneau: {
        select: {
          debutLe: true,
          finLe: true,
          expireLe: true,
          entreprise: { select: { nom: true, fiche: { select: { telephone: true } } } },
        },
      },
    },
  });
  if (rendezVous === null) return null;

  const verdict = peutRepondre(
    {
      statut: rendezVous.statut,
      debut: rendezVous.creneau.debutLe,
      expireLe: rendezVous.creneau.expireLe,
    },
    maintenant,
  );

  return {
    id: rendezVous.id,
    statut: rendezVous.statut,
    debut: rendezVous.creneau.debutLe,
    fin: rendezVous.creneau.finLe,
    expireLe: rendezVous.creneau.expireLe,
    entrepriseNom: rendezVous.creneau.entreprise.nom,
    entrepriseTelephone: rendezVous.creneau.entreprise.fiche?.telephone ?? null,
    repondable: verdict.ok,
    raisonRefus: verdict.ok ? null : MESSAGE_REFUS[verdict.refus],
  };
}

export type ResultatReponse =
  | { readonly ok: true; readonly accepte: boolean }
  | { readonly ok: false; readonly message: string };

/**
 * Le client accepte ou décline.
 *
 * **Accepter** rend la plage ferme et confirme le rendez-vous. **Décliner** l'annule et rend
 * l'horaire : le professionnel n'a pas à faire le ménage derrière un refus.
 *
 * Dans les deux cas, le professionnel est prévenu — c'est la réponse qu'il attend, et la
 * laisser dormir dans la base reviendrait à ne pas l'avoir demandée.
 */
export async function repondAuRendezVous(
  rendezVousId: string,
  accepte: boolean,
  maintenant: Date = new Date(),
): Promise<ResultatReponse> {
  const rendezVous = await prisma.rendezVous.findUnique({
    where: { id: rendezVousId },
    select: {
      statut: true,
      creneauId: true,
      creneau: {
        select: {
          debutLe: true,
          finLe: true,
          expireLe: true,
          entrepriseId: true,
          entreprise: { select: { nom: true, utilisateurs: { select: { email: true }, take: 1 } } },
        },
      },
      client: { select: { nom: true } },
    },
  });
  if (rendezVous === null) return { ok: false, message: 'Ce rendez-vous n’existe plus.' };

  const verdict = peutRepondre(
    {
      statut: rendezVous.statut,
      debut: rendezVous.creneau.debutLe,
      expireLe: rendezVous.creneau.expireLe,
    },
    maintenant,
  );
  if (!verdict.ok) return { ok: false, message: MESSAGE_REFUS[verdict.refus] };

  if (!accepte) {
    await prisma.$transaction(async (tx) => {
      await tx.rendezVous.update({
        where: { id: rendezVousId },
        data: { statut: 'annule', annuleLe: maintenant },
      });
      // Marquée, pas effacée : voir `annuleLeRendezVous`, même raison.
      await tx.creneau.update({
        where: { id: rendezVous.creneauId },
        data: { annuleLe: maintenant },
      });
    });
    await previensLePro(rendezVous, false);
    return { ok: true, accepte: false };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.creneau.update({
        where: { id: rendezVous.creneauId },
        // La plage devient ferme : elle entre sous la contrainte d'exclusion, et l'échéance
        // de la proposition n'a plus d'objet.
        data: { type: 'intervention', propose: false, expireLe: null },
      });
      await tx.rendezVous.update({
        where: { id: rendezVousId },
        data: { statut: 'confirme', confirmeLe: maintenant },
      });
    });
  } catch (erreur) {
    const message =
      typeof erreur === 'object' && erreur !== null && 'message' in erreur ? erreur.message : '';
    if (typeof message === 'string' && message.includes('creneaux_sans_chevauchement')) {
      return {
        ok: false,
        message:
          'Ce créneau vient d’être pris. Contactez l’entreprise, elle vous en proposera un autre.',
      };
    }
    throw erreur;
  }

  await previensLePro(rendezVous, true);
  return { ok: true, accepte: true };
}

/** Le professionnel attend cette réponse : elle ne doit pas dormir dans la base. */
async function previensLePro(
  rendezVous: {
    readonly creneau: {
      readonly debutLe: Date;
      readonly entreprise: { readonly utilisateurs: readonly { readonly email: string }[] };
    };
    readonly client: { readonly nom: string } | null;
  },
  accepte: boolean,
): Promise<void> {
  const destinataire = rendezVous.creneau.entreprise.utilisateurs[0]?.email;
  if (destinataire === undefined) return;

  const qui = rendezVous.client?.nom ?? 'Votre client';
  const quand = heureDe(rendezVous.creneau.debutLe);
  await prisma.messageSortant.create({
    data: {
      canal: 'email',
      modele: accepte ? 'rendez-vous-accepte' : 'rendez-vous-decline',
      destinataire,
      sujet: accepte ? 'Rendez-vous confirmé' : 'Créneau décliné',
      corps: accepte
        ? `${qui} a confirmé le rendez-vous de ${quand}.`
        : `${qui} a décliné le créneau de ${quand}. L'horaire est de nouveau libre dans votre agenda.`,
      statut: 'en_attente',
    },
  });
}
