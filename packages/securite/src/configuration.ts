/**
 * La vérification de la configuration au démarrage.
 *
 * Un secret absent n'est pas un incident à découvrir au premier client : c'est une erreur de
 * déploiement, et elle doit arrêter le service avant qu'il n'accepte la moindre requête. Sans
 * ce contrôle, `SECRET_VERIFICATION` manquant se manifesterait par une erreur 500 au moment
 * précis où quelqu'un essaie de valider son numéro — c'est-à-dire au pire moment possible.
 */

import process from 'node:process';

/** La longueur minimale d'un secret. 32 caractères hexadécimaux, soit `openssl rand -hex 16`. */
export const LONGUEUR_SECRET_MINIMALE = 32;

export interface ProblemeConfiguration {
  readonly variable: string;
  readonly probleme: string;
  readonly remede: string;
}

/**
 * Relit les variables d'environnement indispensables.
 *
 * Rend la liste des problèmes plutôt que de lever à la première : un exploitant qui déploie
 * doit tout voir d'un coup, pas corriger une variable, relancer, en découvrir une autre.
 */
export function verifieConfiguration(
  environnement: Readonly<Record<string, string | undefined>>,
): readonly ProblemeConfiguration[] {
  const problemes: ProblemeConfiguration[] = [];

  const secret = environnement['SECRET_VERIFICATION'];
  if (secret === undefined || secret === '') {
    problemes.push({
      variable: 'SECRET_VERIFICATION',
      probleme: 'absente',
      remede: 'openssl rand -hex 32',
    });
  } else if (secret.length < LONGUEUR_SECRET_MINIMALE) {
    problemes.push({
      variable: 'SECRET_VERIFICATION',
      probleme: `trop courte (${String(secret.length)} caractères, ${String(LONGUEUR_SECRET_MINIMALE)} au minimum)`,
      remede: 'openssl rand -hex 32',
    });
  }

  const base = environnement['DATABASE_URL'];
  if (base === undefined || base === '') {
    problemes.push({
      variable: 'DATABASE_URL',
      probleme: 'absente',
      remede: 'postgresql://utilisateur:motdepasse@hote:5432/lerenom',
    });
  }

  return problemes;
}

/** Le message à afficher. Il nomme chaque variable et dit quoi faire, pas seulement ce qui manque. */
export function messageConfiguration(problemes: readonly ProblemeConfiguration[]): string {
  const lignes = problemes.map(
    (probleme) => `  · ${probleme.variable} : ${probleme.probleme} — ${probleme.remede}`,
  );
  return [
    'Configuration incomplète : le service ne peut pas démarrer.',
    ...lignes,
    'Voir .env.exemple à la racine du dépôt.',
  ].join('\n');
}

/**
 * Vérifie la configuration ou arrête le processus.
 *
 * Appelée au démarrage du worker. Le site, lui, ne s'arrête pas : une page publique doit
 * rester servie même si un secret manque, et seules les fonctions qui en ont besoin refusent.
 */
export function exigeConfiguration(
  environnement: Readonly<Record<string, string | undefined>>,
): void {
  const problemes = verifieConfiguration(environnement);
  if (problemes.length === 0) return;
  throw new Error(messageConfiguration(problemes));
}

/**
 * Le secret qui hache les codes de vérification et les jetons de lien.
 *
 * Une seule définition pour tout le dépôt : trois contrôles écrits séparément finissent par
 * diverger, et celui qui diverge est toujours celui qu'on avait oublié de relire.
 *
 * Absent ou trop court, on refuse. Il n'y a pas de valeur par défaut : hacher avec une chaîne
 * connue de tout le monde reviendrait à ne pas hacher.
 */
export function secretVerification(
  environnement: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const secret = environnement['SECRET_VERIFICATION'];
  if (secret === undefined || secret.length < LONGUEUR_SECRET_MINIMALE) {
    throw new Error(
      `SECRET_VERIFICATION est absente ou trop courte (${String(LONGUEUR_SECRET_MINIMALE)} caractères minimum). ` +
        'Voir .env.exemple : openssl rand -hex 32',
    );
  }
  return secret;
}
