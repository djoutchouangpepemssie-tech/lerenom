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
 * L'adresse que chaque action ouvre.
 *
 * Toutes les actions du client tournaient autour d'une demande, et tous les liens menaient
 * donc au suivi. Un devis remis par un professionnel à son propre client n'a pas de demande
 * derrière lui : il a sa page.
 */
function cheminDeLAction(action: ActionLien): string {
  return action === 'signer_devis' ? 'devis' : 'suivi';
}

/**
 * Crée un lien.
 *
 * `demandeId` vaut `null` pour ce qui ne découle pas d'une demande — un devis qu'un
 * professionnel établit directement pour un client à lui. La colonne l'a toujours permis ;
 * seule cette fonction l'interdisait.
 *
 * Si un lien de la même action existe déjà et reste valide, **on ne le remplace pas** : un
 * client qui reçoit deux SMS ne doit pas voir le premier lien mourir. Mais on ne peut pas non
 * plus renvoyer le jeton d'origine, qui n'a jamais été conservé en clair — on en crée donc un
 * second, également valide. Les deux ouvrent la même page ; le premier expirera de lui-même.
 */
export async function creeLien(
  demandeId: string | null,
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

  return {
    id: lien.id,
    jeton,
    url: `${adresseDuSite()}/${cheminDeLAction(action)}/${jeton}`,
    expireLe,
  };
}

export interface LienResolu {
  readonly id: string;
  readonly action: ActionLien;
  /** `null` pour un lien qui ne découle pas d'une demande : un devis direct, par exemple. */
  readonly demandeId: string | null;
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

  if (lien === null) return { issue: 'inconnu' };

  const etat: EtatLien = decideLien(lien);
  if (etat.issue !== 'valide') return { issue: etat.issue };

  return { issue: 'valide', lien };
}

/**
 * Retrouve un lien **pour en lire la cible**, consommé ou non.
 *
 * Un lien à usage unique se ferme après son action : c'est tout son intérêt, et une boîte mail
 * compromise ne doit pas pouvoir resigner un devis. Mais « ne plus pouvoir agir » n'est pas
 * « ne plus pouvoir lire ». Un client qui a signé son devis a le droit de le relire six mois
 * plus tard, depuis le même message — c'est son exemplaire. Lui refuser au motif qu'il a signé
 * serait la plus absurde des sécurités : on l'aurait protégé de son propre document.
 *
 * Cette fonction rend donc le lien même consommé, et **jamais** après expiration — un lien
 * périmé est périmé pour tout. Elle ne doit servir qu'à des pages en lecture seule : son nom le
 * dit, et c'est la seule garantie qui tienne, puisqu'elle ne peut pas vérifier ce que son
 * appelant fera du résultat.
 *
 * Voir `QUESTIONS.md` §Q31 : la question « faut-il un second lien en lecture seule après
 * l'acceptation ? » se répond ici par « non, le même suffit ».
 */
export async function resoudLienPourLecture(
  jeton: string,
): Promise<
  | { readonly issue: 'valide'; readonly lien: LienResolu }
  | { readonly issue: 'inconnu' }
  | { readonly issue: 'expire' }
> {
  const resolution = await resoudLien(jeton);
  if (resolution.issue === 'valide') return resolution;
  if (resolution.issue !== 'deja-utilise') return resolution;

  // Consommé : on le relit, et on ne rend que ce qui désigne la cible. L'expiration, elle,
  // reste opposable — `decideLien` l'a déjà tranchée avant de dire « déjà utilisé », mais on
  // ne s'appuie pas sur cet ordre : il n'est pas garanti par le type.
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
  if (lien === null) return { issue: 'inconnu' };
  if (lien.expireLe.getTime() <= Date.now()) return { issue: 'expire' };
  return { issue: 'valide', lien };
}

/**
 * Comme `resoudLien`, mais pour les liens qui portent forcément une demande.
 *
 * Le suivi, l'annulation, le dépôt d'avis n'ont pas de sens sans elle : plutôt que de faire
 * vérifier à chaque appelant que `demandeId` n'est pas nul, cette variante le garantit par
 * le type — et traite un lien sans demande comme inconnu, puisque pour ces pages il l'est.
 */
export async function resoudLienDeDemande(
  jeton: string,
): Promise<
  | { readonly issue: 'valide'; readonly lien: LienResolu & { readonly demandeId: string } }
  | { readonly issue: 'inconnu' }
  | { readonly issue: 'expire' }
  | { readonly issue: 'deja-utilise' }
> {
  const resolution = await resoudLien(jeton);
  if (resolution.issue !== 'valide') return resolution;
  const { demandeId } = resolution.lien;
  if (demandeId === null) return { issue: 'inconnu' };
  return { issue: 'valide', lien: { ...resolution.lien, demandeId } };
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
