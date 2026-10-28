/**
 * Le hachage des mots de passe professionnels.
 *
 * **scrypt**, de la bibliothèque standard de Node, avec un sel par utilisateur. Argon2id serait
 * marginalement préférable, mais il suppose un module natif compilé : une dépendance binaire de
 * plus à construire et à déployer, pour un gain théorique. L'OWASP accepte explicitement scrypt
 * en remplacement, et un algorithme standard correctement paramétré vaut mieux qu'un meilleur
 * algorithme mal installé.
 *
 * Le format stocké est auto-descriptif : `scrypt$N$r$p$sel$empreinte`. Il porte ses propres
 * paramètres, donc durcir le coût demain n'invalidera pas les mots de passe d'hier — on
 * revérifiera avec les paramètres inscrits dans l'empreinte, et on réécrira au passage.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * `scrypt` promisifié. `promisify` perd la surcharge qui accepte des options, et ce sont
 * précisément elles qui portent le coût : on écrit l'enveloppe à la main.
 */
function derive(
  motDePasse: string,
  sel: Buffer,
  longueur: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resoud, rejette) => {
    scrypt(motDePasse, sel, longueur, options, (erreur, empreinte) => {
      if (erreur !== null) rejette(erreur);
      else resoud(empreinte);
    });
  });
}

/** 64 Mio de mémoire par calcul : assez pour gêner sérieusement une attaque par carte graphique. */
const COUT = 2 ** 16;
const BLOCS = 8;
const PARALLELISME = 1;
const LONGUEUR_EMPREINTE = 32;
const LONGUEUR_SEL = 16;

/** scrypt refuse de travailler si on ne lui donne pas assez de mémoire pour ces paramètres. */
const MEMOIRE_MAX = 192 * 1024 * 1024;

export async function hacheMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(LONGUEUR_SEL);
  const empreinte = await derive(motDePasse.normalize('NFKC'), sel, LONGUEUR_EMPREINTE, {
    N: COUT,
    r: BLOCS,
    p: PARALLELISME,
    maxmem: MEMOIRE_MAX,
  });

  return [
    'scrypt',
    String(COUT),
    String(BLOCS),
    String(PARALLELISME),
    sel.toString('base64url'),
    empreinte.toString('base64url'),
  ].join('$');
}

/**
 * Vérifie un mot de passe contre une empreinte stockée.
 *
 * Rend `false` plutôt que de lever sur une empreinte illisible : une ligne corrompue en base ne
 * doit pas devenir une erreur 500 sur la page de connexion, et surtout pas un message qui
 * distinguerait ce compte des autres.
 */
export async function verifieMotDePasse(motDePasse: string, stocke: string): Promise<boolean> {
  const morceaux = stocke.split('$');
  if (morceaux.length !== 6 || morceaux[0] !== 'scrypt') return false;

  const cout = Number(morceaux[1]);
  const blocs = Number(morceaux[2]);
  const parallelisme = Number(morceaux[3]);
  if (!Number.isInteger(cout) || !Number.isInteger(blocs) || !Number.isInteger(parallelisme)) {
    return false;
  }

  const sel = Buffer.from(morceaux[4] ?? '', 'base64url');
  const attendue = Buffer.from(morceaux[5] ?? '', 'base64url');
  if (sel.length === 0 || attendue.length === 0) return false;

  try {
    const calculee = await derive(motDePasse.normalize('NFKC'), sel, attendue.length, {
      N: cout,
      r: blocs,
      p: parallelisme,
      maxmem: MEMOIRE_MAX,
    });

    return calculee.length === attendue.length && timingSafeEqual(calculee, attendue);
  } catch {
    return false;
  }
}

/**
 * L'empreinte a-t-elle été calculée avec des paramètres dépassés ?
 *
 * Quand on durcit le coût, les anciennes empreintes restent valides : on les reconnaît ici, et
 * on les réécrit à la prochaine connexion réussie, sans rien demander au professionnel.
 */
export function empreinteADurcir(stocke: string): boolean {
  const morceaux = stocke.split('$');
  if (morceaux.length !== 6 || morceaux[0] !== 'scrypt') return true;
  return Number(morceaux[1]) < COUT;
}
