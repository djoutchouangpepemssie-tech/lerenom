/**
 * L'orchestration de la distribution, partagée.
 *
 * Elle vivait dans le worker, ce qui convenait tant que seul le worker en avait besoin. Mais
 * l'acceptation d'une demande par un professionnel doit être **synchrone** : il clique, il
 * obtient les coordonnées, et le verrou qui empêche deux acceptations simultanées doit se
 * poser pendant sa requête. Passer par une file aurait rendu l'opération asynchrone, donc le
 * verrou inutile.
 *
 * Le worker garde ce qui le concerne : les files, les minuteurs, les travaux de nuit.
 */

export * from './distribution.ts';
export * from './parametres.ts';
export * from './avis.ts';
export * from './scores.ts';
export * from './travaux-de-nuit.ts';
export * from './rendez-vous.ts';
export * from './expedition.ts';
