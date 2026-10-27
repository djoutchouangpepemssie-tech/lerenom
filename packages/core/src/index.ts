/**
 * @lerenom/core — les règles métier de Le Renom.
 *
 * Tout ce que la plateforme décide se décide ici, en fonctions pures, sans base de données,
 * sans réseau et sans framework. Les applications orchestrent : elles lisent, appellent une
 * règle, écrivent le résultat et le journalisent. Elles ne décident pas.
 */

export * from './regles-validees.js';
export * from './parametres.js';
export * from './geo.js';
export * from './score.js';
export * from './classement.js';
export * from './zones.js';
export * from './quotas.js';
export * from './distribution.js';
export * from './garantie.js';
export * from './devis.js';
export * from './validateurs.js';
