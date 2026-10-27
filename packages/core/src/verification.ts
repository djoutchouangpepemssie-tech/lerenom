/**
 * La vérification du mobile d'un client : les règles.
 *
 * Le Renom n'a pas de compte client : le numéro de mobile est la seule identité du visiteur, et
 * un code à six chiffres est la seule preuve qu'il lui appartient. Tant que cette preuve manque,
 * la demande reste un brouillon et aucun professionnel ne la voit.
 *
 * Ce module ne contient que des règles : la forme du code, sa durée de validité, le nombre de
 * tentatives, et l'ordre dans lequel les refus sont prononcés. Le tirage et le hachage vivent
 * dans `@lerenom/securite`, qui a besoin de Node ; le cœur, lui, doit rester utilisable dans le
 * navigateur, pour que le formulaire valide la saisie avec les mêmes règles que le serveur.
 */

/** Nombre de chiffres du code. Six : assez court pour être lu au téléphone, assez long pour tenir. */
export const LONGUEUR_CODE = 6;

/** Validité du code. Au-delà, le visiteur en demande un nouveau. */
export const VALIDITE_CODE_MINUTES = 15;

/**
 * Tentatives autorisées avant qu'un nouveau code soit exigé.
 *
 * Six chiffres, c'est un million de combinaisons : sans limite, un robot les épuise en quelques
 * minutes. Cinq essais laissent au client de bonne foi la marge de se tromper deux fois.
 */
export const TENTATIVES_MAX = 5;

export type ResultatVerification =
  | { readonly issue: 'verifie' }
  | { readonly issue: 'code-faux'; readonly tentativesRestantes: number }
  | { readonly issue: 'expire' }
  | { readonly issue: 'trop-de-tentatives' }
  | { readonly issue: 'deja-verifie' };

export interface EtatVerification {
  /** `null` quand aucun code n'a été tiré, ou quand le code a déjà servi. */
  readonly empreinte: string | null;
  readonly expireLe: Date | null;
  readonly tentatives: number;
  readonly dejaVerifie: boolean;
}

/**
 * Tranche sur une tentative de vérification.
 *
 * `codeCorrespond` est le verdict de la comparaison cryptographique, calculé ailleurs : cette
 * fonction ne voit jamais le code.
 *
 * L'ordre des contrôles n'est pas indifférent. On épuise d'abord les cas qui ne dépendent pas du
 * code — déjà vérifié, plus de tentatives, code expiré — pour ne pas donner au robot un moyen de
 * distinguer un code faux d'un code périmé.
 */
export function decideVerification(
  etat: EtatVerification,
  codeCorrespond: boolean,
  maintenant: Date = new Date(),
): ResultatVerification {
  if (etat.dejaVerifie) return { issue: 'deja-verifie' };
  if (etat.tentatives >= TENTATIVES_MAX) return { issue: 'trop-de-tentatives' };
  if (etat.empreinte === null || etat.expireLe === null) return { issue: 'expire' };
  if (etat.expireLe.getTime() <= maintenant.getTime()) return { issue: 'expire' };
  if (codeCorrespond) return { issue: 'verifie' };

  return { issue: 'code-faux', tentativesRestantes: TENTATIVES_MAX - etat.tentatives - 1 };
}

/** Le code est-il bien formé ? Six chiffres, rien d'autre. */
export function codeBienForme(valeur: string): boolean {
  return new RegExp(`^\\d{${LONGUEUR_CODE}}$`).test(valeur);
}

/** L'instant d'expiration d'un code tiré maintenant. */
export function expirationCode(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + VALIDITE_CODE_MINUTES * 60 * 1000);
}
