/**
 * La session d'un professionnel : ouverture, lecture, fermeture.
 *
 * Le cookie ne porte qu'un jeton aléatoire ; tout le reste vit en base. Deux raisons :
 *   * une session doit pouvoir être **révoquée** — un salarié qui part, un mot de passe changé,
 *     une connexion suspecte. Un jeton auto-porté ne se révoque pas, il expire ;
 *   * la base n'en garde que l'empreinte. Lire la base ne permet donc pas de se faire passer
 *     pour quelqu'un, pas plus que pour les liens clients.
 */

import { cookies, headers } from 'next/headers';
import { prisma } from '@lerenom/db';
import { expirationSession, validiteSession } from '@lerenom/core';
import { empreinteJeton, secretVerification, tireJeton } from '@lerenom/securite';

const COOKIE = 'lerenom_pro';

export interface ProConnecte {
  readonly utilisateurId: string;
  readonly entrepriseId: string;
  readonly nom: string;
  readonly email: string;
  readonly entreprise: string;
  readonly sessionId: string;
}

/** Ouvre une session et pose le cookie. Rend le jeton, qui n'existe qu'ici en clair. */
export async function ouvreSession(utilisateurId: string): Promise<void> {
  const jeton = tireJeton();
  const entetes = await headers();
  const expireLe = expirationSession();

  const session = await prisma.sessionPro.create({
    data: {
      utilisateurId,
      jeton: empreinteJeton(jeton, secretVerification()),
      expireLe,
      adresseIp: entetes.get('x-forwarded-for'),
      appareil: entetes.get('user-agent'),
    },
    select: { id: true },
  });

  await prisma.utilisateurPro.update({
    where: { id: utilisateurId },
    data: { derniereConnexion: new Date() },
  });

  const boite = await cookies();
  boite.set(COOKIE, `${session.id}.${jeton}`, {
    httpOnly: true,
    sameSite: 'lax',
    // En développement, le site tourne en clair : un cookie `secure` ne serait jamais posé.
    secure: process.env['LERENOM_ENV'] !== 'developpement',
    path: '/',
    expires: expireLe,
  });
}

/**
 * Le professionnel connecté, ou `null`.
 *
 * Met à jour la date de dernière activité au passage, mais pas plus d'une fois par heure :
 * écrire en base à chaque affichage de page coûterait cher pour une précision inutile.
 */
export async function proConnecte(): Promise<ProConnecte | null> {
  const boite = await cookies();
  const valeur = boite.get(COOKIE)?.value;
  if (valeur === undefined) return null;

  const [sessionId, jeton] = valeur.split('.');
  if (sessionId === undefined || jeton === undefined) return null;

  const session = await prisma.sessionPro.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      jeton: true,
      expireLe: true,
      revoqueeLe: true,
      derniereActiviteLe: true,
      utilisateur: {
        select: {
          id: true,
          nom: true,
          email: true,
          entrepriseId: true,
          entreprise: { select: { nom: true, suspendue: true } },
        },
      },
    },
  });

  if (session === null) return null;
  if (session.jeton !== empreinteJeton(jeton, secretVerification())) return null;
  if (validiteSession(session).issue !== 'valide') return null;
  // Une entreprise suspendue n'accède plus à son espace : la suspension serait sans effet.
  if (session.utilisateur.entreprise.suspendue) return null;

  if (Date.now() - session.derniereActiviteLe.getTime() > 3_600_000) {
    await prisma.sessionPro.update({
      where: { id: session.id },
      data: { derniereActiviteLe: new Date() },
    });
  }

  return {
    utilisateurId: session.utilisateur.id,
    entrepriseId: session.utilisateur.entrepriseId,
    nom: session.utilisateur.nom,
    email: session.utilisateur.email,
    entreprise: session.utilisateur.entreprise.nom,
    sessionId: session.id,
  };
}

/** Ferme la session courante : révoquée en base, cookie effacé. */
export async function fermeSession(): Promise<void> {
  const boite = await cookies();
  const valeur = boite.get(COOKIE)?.value;
  boite.delete(COOKIE);

  const sessionId = valeur?.split('.')[0];
  if (sessionId === undefined) return;

  await prisma.sessionPro.updateMany({
    where: { id: sessionId, revoqueeLe: null },
    data: { revoqueeLe: new Date() },
  });
}

/** Ferme toutes les sessions d'un utilisateur. Appelée quand le mot de passe change. */
export async function fermeToutesLesSessions(utilisateurId: string): Promise<void> {
  await prisma.sessionPro.updateMany({
    where: { utilisateurId, revoqueeLe: null },
    data: { revoqueeLe: new Date() },
  });
}
