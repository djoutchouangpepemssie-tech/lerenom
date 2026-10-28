/**
 * Les secrets et l'environnement du site.
 *
 * La définition du secret vit dans `@lerenom/securite` : une seule, pour le site, le worker et
 * la création des liens. Trois contrôles écrits séparément finissent par diverger, et celui qui
 * diverge est toujours celui qu'on avait oublié de relire.
 */

export { secretVerification } from '@lerenom/securite';

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
