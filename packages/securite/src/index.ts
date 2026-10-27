/**
 * Le tirage et le hachage des codes de vérification.
 *
 * Séparé de `@lerenom/core` parce qu'il a besoin de Node : le cœur métier, lui, doit pouvoir
 * tourner dans le navigateur. Ici vivent les trois précautions qui ne sont pas des règles mais
 * des devoirs :
 *   * le code est tiré avec le générateur cryptographique, pas avec `Math.random` ;
 *   * il n'est **jamais** conservé en clair. Une fuite de la base ne doit pas permettre de
 *     valider des demandes à la place des visiteurs ;
 *   * la comparaison se fait à temps constant, pour ne pas révéler l'empreinte octet par octet.
 */

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  decideVerification,
  LONGUEUR_CODE,
  type EtatVerification,
  type ResultatVerification,
} from '@lerenom/core';

/** Tire un code à six chiffres, zéros de tête compris. */
export function tireCode(): string {
  return randomInt(0, 10 ** LONGUEUR_CODE)
    .toString()
    .padStart(LONGUEUR_CODE, '0');
}

/**
 * Empreinte du code, liée à la demande et au secret du serveur.
 *
 * Le sel est l'identifiant de la demande : deux visiteurs qui tirent le même code n'ont pas la
 * même empreinte, et une empreinte volée ne sert pas sur une autre demande.
 */
export function empreinteCode(code: string, demandeId: string, secret: string): string {
  return createHmac('sha256', secret).update(`${demandeId}:${code}`).digest('hex');
}

/** Compare deux empreintes hexadécimales à temps constant. */
export function empreintesEgales(attendue: string, proposee: string): boolean {
  const a = Buffer.from(attendue, 'hex');
  const b = Buffer.from(proposee, 'hex');
  // `timingSafeEqual` refuse deux tampons de tailles différentes : on tranche avant.
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Confronte un code saisi à l'état de la demande, règles du cœur comprises. */
export function verifieCode(
  etat: EtatVerification & { readonly demandeId: string },
  codeSaisi: string,
  secret: string,
  maintenant: Date = new Date(),
): ResultatVerification {
  const correspond =
    etat.empreinte !== null &&
    empreintesEgales(etat.empreinte, empreinteCode(codeSaisi, etat.demandeId, secret));

  return decideVerification(etat, correspond, maintenant);
}
