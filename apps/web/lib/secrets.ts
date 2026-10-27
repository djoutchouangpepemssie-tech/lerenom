/**
 * Les secrets du serveur.
 *
 * Un secret absent n'est pas une valeur par défaut : c'est une erreur de déploiement. On préfère
 * refuser de démarrer la fonctionnalité plutôt que de hacher des codes avec une chaîne connue de
 * tout le monde.
 */

/** Le secret qui sert à hacher les codes de vérification SMS. */
export function secretVerification(): string {
  const secret = process.env['SECRET_VERIFICATION'];
  if (secret === undefined || secret.length < 32) {
    throw new Error(
      'SECRET_VERIFICATION est absent ou trop court (32 caractères minimum). ' +
        'Voir .env.exemple : openssl rand -hex 32',
    );
  }
  return secret;
}

/**
 * Sommes-nous en développement ?
 *
 * Tant qu'aucun opérateur SMS n'est branché, le développement a besoin de relire le code de
 * vérification dans la file des messages sortants. En production, ce code ne doit jamais être
 * lisible ailleurs que sur le téléphone du client.
 */
export function enDeveloppement(): boolean {
  return process.env['LERENOM_ENV'] === 'developpement';
}
