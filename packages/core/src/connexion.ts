/**
 * Les règles de connexion d'un professionnel.
 *
 * La vraie défense contre la devinette d'un mot de passe n'est pas d'en exiger un compliqué :
 * c'est de limiter les essais. Un attaquant qui dispose de cinq tentatives par quart d'heure
 * n'ira nulle part, même contre un mot de passe moyen.
 *
 * Le verrouillage est **temporaire**, jamais définitif : un compte bloqué pour de bon serait
 * une arme entre les mains de n'importe qui — il suffirait de saisir dix mauvais mots de passe
 * sur le compte d'un concurrent pour le sortir de la plateforme un jour de pointe.
 */

/** Essais autorisés avant la mise en attente. */
export const TENTATIVES_CONNEXION_MAX = 5;
/** Durée de la mise en attente, en minutes. */
export const MINUTES_VERROUILLAGE = 15;

export interface EtatConnexion {
  readonly tentatives: number;
  readonly derniereTentativeLe: Date | null;
}

export type VerrouConnexion =
  | { readonly issue: 'ouvert' }
  | { readonly issue: 'verrouille'; readonly minutesRestantes: number };

/**
 * Le compte accepte-t-il une tentative maintenant ?
 *
 * La fenêtre glisse : chaque échec repousse la fin du verrouillage, et un quart d'heure de
 * silence remet le compteur à zéro de lui-même.
 */
export function verrouDeConnexion(
  etat: EtatConnexion,
  maintenant: Date = new Date(),
): VerrouConnexion {
  if (etat.tentatives < TENTATIVES_CONNEXION_MAX || etat.derniereTentativeLe === null) {
    return { issue: 'ouvert' };
  }

  const finDuVerrou = etat.derniereTentativeLe.getTime() + MINUTES_VERROUILLAGE * 60_000;
  const restant = finDuVerrou - maintenant.getTime();
  if (restant <= 0) return { issue: 'ouvert' };

  return { issue: 'verrouille', minutesRestantes: Math.ceil(restant / 60_000) };
}

/** Durée d'une session, en jours. Au-delà, il faut se reconnecter. */
export const JOURS_SESSION = 30;
/** Au-delà de cette inactivité, la session est close même si elle n'a pas expiré. */
export const JOURS_INACTIVITE_SESSION = 7;

export interface EtatSession {
  readonly expireLe: Date;
  readonly revoqueeLe: Date | null;
  readonly derniereActiviteLe: Date;
}

export type ValiditeSession =
  | { readonly issue: 'valide' }
  | { readonly issue: 'expiree' }
  | { readonly issue: 'revoquee' }
  | { readonly issue: 'inactive' };

/**
 * La session tient-elle encore ?
 *
 * Trois façons de la perdre, et l'ordre importe pour le message : révoquée d'abord, parce
 * qu'elle a été fermée volontairement ; expirée ensuite ; inactive en dernier.
 */
export function validiteSession(etat: EtatSession, maintenant: Date = new Date()): ValiditeSession {
  if (etat.revoqueeLe !== null) return { issue: 'revoquee' };
  if (etat.expireLe.getTime() <= maintenant.getTime()) return { issue: 'expiree' };

  const limite = etat.derniereActiviteLe.getTime() + JOURS_INACTIVITE_SESSION * 24 * 3_600_000;
  if (maintenant.getTime() > limite) return { issue: 'inactive' };

  return { issue: 'valide' };
}

/** L'expiration d'une session ouverte maintenant. */
export function expirationSession(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + JOURS_SESSION * 24 * 3_600_000);
}
