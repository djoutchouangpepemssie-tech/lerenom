/**
 * La double authentification du back-office.
 *
 * Le cahier des charges l'impose, et la raison est simple : un compte du back-office voit les
 * coordonnées de tous les clients, peut ouvrir la session d'un professionnel et modifier les
 * paramètres qui gouvernent la distribution. Un mot de passe volé y donne accès à tout. Un
 * code qui change toutes les trente secondes rend le vol inutile sans le téléphone.
 *
 * TOTP est implémenté ici plutôt qu'emprunté à une bibliothèque, et c'est un choix qui mérite
 * sa justification, parce que « ne réécrivez pas de la cryptographie » est une règle saine.
 * Ce qui est écrit ici n'est **pas** de la cryptographie : c'est la RFC 6238, c'est-à-dire un
 * compteur de trente secondes, un HMAC-SHA1 que Node fournit, et une troncature de quatre
 * octets décrite en six lignes dans la RFC. Aucune primitive n'est inventée. En face, une
 * dépendance de plus dans un produit qui en a peu, pour cinquante lignes.
 *
 * Trois protections valent d'être nommées.
 *
 * **La comparaison est à temps constant.** Comparer deux codes avec `===` fuit, par le temps
 * de réponse, le nombre de chiffres corrects — assez pour deviner un code chiffre à chiffre.
 *
 * **La fenêtre de tolérance est de ±1 pas**, soit trente secondes de part et d'autre. Les
 * horloges des téléphones dérivent, et refuser un code juste parce que l'utilisateur a mis
 * deux secondes à le taper le pousserait à désactiver la double authentification. Plus large,
 * en revanche, allonge d'autant la durée de vie d'un code intercepté.
 *
 * **Un code ne sert qu'une fois.** Cette garantie-là ne peut pas vivre ici : elle suppose de
 * se souvenir du dernier pas accepté, donc un état. `codeDejaUtilise` dit comment l'appelant
 * doit s'y prendre, et la session admin s'en charge.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** La durée d'un pas, en secondes. Trente : la valeur que toutes les applications attendent. */
export const PAS_TOTP_SECONDES = 30;

/** Le nombre de chiffres du code. Six : la valeur universelle. */
export const CHIFFRES_TOTP = 6;

/** Pas de tolérance de part et d'autre, pour la dérive d'horloge. */
export const TOLERANCE_PAS = 1;

const ALPHABET_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Encode des octets en base32 sans remplissage, la forme qu'attendent les applications. */
export function versBase32(octets: Uint8Array): string {
  let bits = 0;
  let valeur = 0;
  let sortie = '';
  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET_BASE32[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET_BASE32[(valeur << (5 - bits)) & 31];
  return sortie;
}

/**
 * Décode une base32.
 *
 * Les espaces et la casse sont tolérés : un secret se recopie à la main depuis un écran, et
 * refuser « JBSW Y3DP » quand on accepte « JBSWY3DP » n'ajoute aucune sécurité.
 */
export function depuisBase32(texte: string): Uint8Array {
  const propre = texte.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let valeur = 0;
  const octets: number[] = [];
  for (const caractere of propre) {
    const index = ALPHABET_BASE32.indexOf(caractere);
    if (index === -1) throw new Error(`Caractère invalide dans le secret : « ${caractere} ».`);
    valeur = (valeur << 5) | index;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(octets);
}

/** Un secret neuf, vingt octets — la taille recommandée par la RFC 4226. */
export function tireSecretTotp(): string {
  return versBase32(randomBytes(20));
}

/** Le pas courant : le nombre de tranches de trente secondes depuis l'époque Unix. */
export function pasActuel(maintenant: Date = new Date()): number {
  return Math.floor(maintenant.getTime() / 1000 / PAS_TOTP_SECONDES);
}

/**
 * Le code attendu pour un pas donné.
 *
 * La troncature dynamique est celle de la RFC 4226 : le dernier demi-octet du HMAC désigne où
 * lire quatre octets, dont on efface le bit de signe avant de prendre le modulo.
 */
export function codeTotp(secret: string, pas: number): string {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(pas));

  const empreinte = createHmac('sha1', Buffer.from(depuisBase32(secret)))
    .update(compteur)
    .digest();
  const decalage = (empreinte[empreinte.length - 1] ?? 0) & 0x0f;
  const tronque =
    (((empreinte[decalage] ?? 0) & 0x7f) << 24) |
    ((empreinte[decalage + 1] ?? 0) << 16) |
    ((empreinte[decalage + 2] ?? 0) << 8) |
    (empreinte[decalage + 3] ?? 0);

  return String(tronque % 10 ** CHIFFRES_TOTP).padStart(CHIFFRES_TOTP, '0');
}

/** Deux codes sont-ils égaux, sans que le temps de comparaison ne dise combien de chiffres ? */
function codesEgaux(attendu: string, propose: string): boolean {
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(propose, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface VerificationTotp {
  readonly valide: boolean;
  /** Le pas qui a validé le code. À retenir : un code ne doit servir qu'une fois. */
  readonly pas: number | null;
}

/**
 * Vérifie un code, en tolérant la dérive d'horloge.
 *
 * Rend le pas qui a validé : l'appelant doit l'enregistrer et refuser qu'il resserve. Sans
 * cela, un code lu par-dessus l'épaule reste utilisable pendant une minute et demie.
 */
export function verifieTotp(
  secret: string,
  propose: string,
  maintenant: Date = new Date(),
  tolerance: number = TOLERANCE_PAS,
): VerificationTotp {
  // Les espaces sautent : les applications affichent « 123 456 », et la moitié des gens les
  // recopient tels quels. Refuser serait une friction sans contrepartie.
  const propre = propose.replace(/\s/g, '');
  if (!/^\d+$/.test(propre) || propre.length !== CHIFFRES_TOTP) return { valide: false, pas: null };

  const courant = pasActuel(maintenant);
  for (let ecart = -tolerance; ecart <= tolerance; ecart += 1) {
    const pas = courant + ecart;
    if (codesEgaux(codeTotp(secret, pas), propre)) return { valide: true, pas };
  }
  return { valide: false, pas: null };
}

/**
 * Un code déjà présenté doit-il être refusé ?
 *
 * La règle : on refuse tout pas inférieur ou égal au dernier accepté. Plus simple que de tenir
 * une liste, et plus sûr — rejouer un ancien code devient impossible, pas seulement le
 * dernier.
 */
export function codeDejaUtilise(pas: number, dernierPasAccepte: number | null): boolean {
  return dernierPasAccepte !== null && pas <= dernierPasAccepte;
}

/**
 * L'adresse `otpauth://` à présenter en QR code.
 *
 * L'émetteur et le compte apparaissent dans l'application du téléphone : sans eux, l'admin
 * qui gère plusieurs comptes voit six chiffres sans savoir à quoi ils servent.
 */
export function adresseOtpauth(secret: string, compte: string, emetteur = 'Le Renom'): string {
  const etiquette = encodeURIComponent(`${emetteur}:${compte}`);
  const parametres = new URLSearchParams({
    secret,
    issuer: emetteur,
    algorithm: 'SHA1',
    digits: String(CHIFFRES_TOTP),
    period: String(PAS_TOTP_SECONDES),
  });
  return `otpauth://totp/${etiquette}?${parametres.toString()}`;
}
