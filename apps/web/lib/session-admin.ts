import { cookies, headers } from 'next/headers';
import { prisma } from '@lerenom/db';
import { validiteSession } from '@lerenom/core';
import { empreinteJeton, secretVerification, tireJeton } from '@lerenom/securite';

/**
 * La session d'un membre du back-office.
 *
 * Même mécanique que la session d'un professionnel — un jeton aléatoire dans le cookie, son
 * empreinte seule en base, une révocation possible — avec trois différences qui tiennent
 * toutes à ce qu'un compte du back-office peut faire.
 *
 * **Elle est courte.** Huit heures, une journée de travail, là où un professionnel reste
 * connecté un mois. Un compte du back-office voit les coordonnées de tous les clients et
 * pourra ouvrir la session d'un professionnel ; une session oubliée sur un poste partagé n'y
 * a pas le même coût qu'ailleurs.
 *
 * **Elle exige la double authentification.** Le mot de passe seul n'ouvre rien : la session
 * n'est créée qu'après le code. C'est pourquoi `ouvreSessionAdmin` n'est appelée que depuis
 * la route qui a déjà vérifié les deux.
 *
 * **Un compte désactivé perd l'accès immédiatement**, sans attendre l'expiration de sa
 * session. Désactiver quelqu'un qui reste connecté huit heures n'est pas le désactiver.
 */

const COOKIE = 'lerenom_admin';

/** Huit heures : une journée de travail, et pas une nuit de plus. */
export const DUREE_SESSION_ADMIN_HEURES = 8;

export type RoleAdmin = 'administrateur' | 'moderateur' | 'support' | 'commercial' | 'comptabilite';

export interface AdminConnecte {
  readonly adminId: string;
  readonly nom: string;
  readonly email: string;
  readonly role: RoleAdmin;
  readonly sessionId: string;
}

export function expirationSessionAdmin(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + DUREE_SESSION_ADMIN_HEURES * 3_600_000);
}

/**
 * Ouvre une session et pose le cookie.
 *
 * À n'appeler qu'après avoir vérifié **le mot de passe et le code**. La fonction ne le
 * revérifie pas : elle ne saurait pas le faire mieux que l'appelant, et un contrôle en double
 * qui diverge un jour est pire que pas de contrôle.
 */
export async function ouvreSessionAdmin(adminId: string): Promise<void> {
  const jeton = tireJeton();
  const entetes = await headers();
  const expireLe = expirationSessionAdmin();

  const session = await prisma.sessionAdmin.create({
    data: {
      adminId,
      jeton: empreinteJeton(jeton, secretVerification()),
      expireLe,
      adresseIp: entetes.get('x-forwarded-for'),
      appareil: entetes.get('user-agent'),
    },
    select: { id: true },
  });

  await prisma.admin.update({
    where: { id: adminId },
    data: { derniereConnexion: new Date() },
  });

  const boite = await cookies();
  boite.set(COOKIE, `${session.id}.${jeton}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['LERENOM_ENV'] !== 'developpement',
    path: '/',
    expires: expireLe,
  });
}

/** Le membre du back-office connecté, ou `null`. */
export async function adminConnecte(): Promise<AdminConnecte | null> {
  const boite = await cookies();
  const valeur = boite.get(COOKIE)?.value;
  if (valeur === undefined) return null;

  const [sessionId, jeton] = valeur.split('.');
  if (sessionId === undefined || jeton === undefined) return null;

  const session = await prisma.sessionAdmin.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      jeton: true,
      expireLe: true,
      revoqueeLe: true,
      derniereActiviteLe: true,
      admin: { select: { id: true, nom: true, email: true, role: true, actif: true } },
    },
  });

  if (session === null) return null;
  if (session.jeton !== empreinteJeton(jeton, secretVerification())) return null;
  if (validiteSession(session).issue !== 'valide') return null;
  // Un compte désactivé perd l'accès à l'instant, sans attendre la fin de sa session.
  if (!session.admin.actif) return null;

  if (Date.now() - session.derniereActiviteLe.getTime() > 3_600_000) {
    await prisma.sessionAdmin.update({
      where: { id: session.id },
      data: { derniereActiviteLe: new Date() },
    });
  }

  return {
    adminId: session.admin.id,
    nom: session.admin.nom,
    email: session.admin.email,
    role: session.admin.role,
    sessionId: session.id,
  };
}

/** Ferme la session courante : révoquée en base, cookie effacé. */
export async function fermeSessionAdmin(): Promise<void> {
  const boite = await cookies();
  const valeur = boite.get(COOKIE)?.value;
  boite.delete(COOKIE);

  const sessionId = valeur?.split('.')[0];
  if (sessionId === undefined) return;

  await prisma.sessionAdmin.updateMany({
    where: { id: sessionId, revoqueeLe: null },
    data: { revoqueeLe: new Date() },
  });
}

/**
 * Inscrit une action au journal d'audit.
 *
 * Le journal ne se modifie ni ne s'efface : une correction est une **nouvelle ligne**. C'est
 * la seule façon qu'un journal réponde encore à la question qu'on lui pose — « qui a changé
 * cela, et quand ? » — le jour où quelqu'un a intérêt à ce qu'il réponde autrement.
 *
 * `avant` et `apres` sont les deux états : sans l'avant, on sait qu'une valeur a changé mais
 * plus laquelle elle était, et c'est précisément ce qu'on cherche.
 */
export async function inscritAuJournal(
  adminId: string,
  action: string,
  typeObjet: string,
  objetId: string | null,
  etats: { readonly avant?: unknown; readonly apres?: unknown } = {},
): Promise<void> {
  const entetes = await headers();
  await prisma.journalAudit.create({
    data: {
      adminId,
      action,
      typeObjet,
      objetId,
      ...(etats.avant !== undefined ? { avant: etats.avant as object } : {}),
      ...(etats.apres !== undefined ? { apres: etats.apres as object } : {}),
      adresseIp: entetes.get('x-forwarded-for'),
    },
  });
}
