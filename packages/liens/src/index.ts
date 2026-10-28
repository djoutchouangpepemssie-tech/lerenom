/**
 * La création et la résolution des liens à action unique.
 *
 * C'est la seule porte d'entrée d'un client : il n'a pas de compte, pas de mot de passe, rien
 * qu'un lien reçu par SMS ou par courriel. Le worker en crée (quand un professionnel accepte),
 * le site les résout (quand le client clique).
 *
 * Le jeton n'existe en clair qu'une fois, au moment où on le met dans le message. La base n'en
 * garde que l'empreinte : lire la base ne donne donc pas les clés des dossiers en cours.
 */

import { prisma } from '@lerenom/db';
import { decideLien, expirationLien, jetonBienForme, type ActionLien } from '@lerenom/core';
import type { EtatLien } from '@lerenom/core';
import { empreinteJeton, secretVerification, tireJeton } from '@lerenom/securite';

/** L'adresse publique du site, pour écrire des liens cliquables dans les messages. */
export function adresseDuSite(): string {
  return (process.env['LERENOM_URL'] ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export interface LienCree {
  readonly id: string;
  /** Le jeton en clair. Il n'existe qu'ici : à mettre dans le message, et nulle part ailleurs. */
  readonly jeton: string;
  readonly url: string;
  readonly expireLe: Date;
}

/**
 * Crée un lien pour une demande.
 *
 * Si un lien de la même action existe déjà et reste valide, **on ne le remplace pas** : un
 * client qui reçoit deux SMS ne doit pas voir le premier lien mourir. Mais on ne peut pas non
 * plus renvoyer le jeton d'origine, qui n'a jamais été conservé en clair — on en crée donc un
 * second, également valide. Les deux ouvrent la même page ; le premier expirera de lui-même.
 */
export async function creeLien(
  demandeId: string,
  action: ActionLien,
  cibleId?: string,
): Promise<LienCree> {
  const jeton = tireJeton();
  const expireLe = expirationLien(action);

  const lien = await prisma.lienAction.create({
    data: {
      demandeId,
      jeton: empreinteJeton(jeton, secretVerification()),
      action,
      ...(cibleId !== undefined ? { cibleId } : {}),
      expireLe,
    },
    select: { id: true },
  });

  return { id: lien.id, jeton, url: `${adresseDuSite()}/suivi/${jeton}`, expireLe };
}

export interface LienResolu {
  readonly id: string;
  readonly action: ActionLien;
  readonly demandeId: string;
  readonly cibleId: string | null;
  readonly expireLe: Date;
  readonly utiliseLe: Date | null;
}

export type ResolutionLien =
  | { readonly issue: 'valide'; readonly lien: LienResolu }
  | { readonly issue: 'inconnu' }
  | { readonly issue: 'expire' }
  | { readonly issue: 'deja-utilise' };

/**
 * Retrouve un lien à partir de son jeton.
 *
 * La forme du jeton est vérifiée avant d'interroger la base : une adresse tapée au hasard ne
 * doit pas coûter une requête.
 */
export async function resoudLien(jeton: string): Promise<ResolutionLien> {
  if (!jetonBienForme(jeton)) return { issue: 'inconnu' };

  const lien = await prisma.lienAction.findUnique({
    where: { jeton: empreinteJeton(jeton, secretVerification()) },
    select: {
      id: true,
      action: true,
      demandeId: true,
      cibleId: true,
      expireLe: true,
      utiliseLe: true,
    },
  });

  if (lien === null || lien.demandeId === null) return { issue: 'inconnu' };

  const etat: EtatLien = decideLien(lien);
  if (etat.issue !== 'valide') return { issue: etat.issue };

  return { issue: 'valide', lien: { ...lien, demandeId: lien.demandeId } };
}

/**
 * Marque un lien comme consommé.
 *
 * Pour les liens rejouables, cela enregistre simplement la première ouverture : c'est une
 * trace, pas une fermeture. `decideLien` sait faire la différence.
 */
export async function consommeLien(id: string, adresseIp?: string): Promise<void> {
  await prisma.lienAction.updateMany({
    where: { id, utiliseLe: null },
    data: { utiliseLe: new Date(), ...(adresseIp !== undefined ? { adresseIp } : {}) },
  });
}
