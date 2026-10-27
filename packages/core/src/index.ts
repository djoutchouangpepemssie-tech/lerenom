/**
 * @lerenom/core — les règles métier de Le Renom.
 *
 * Tout ce que la plateforme décide se décide ici, en fonctions pures, sans base de données,
 * sans réseau et sans framework. Les applications orchestrent : elles lisent, appellent une
 * règle, écrivent le résultat et le journalisent. Elles ne décident pas.
 */

export * from './regles-validees';
export * from './parametres';
export * from './geo';
export * from './score';
export * from './classement';
export * from './zones';
export * from './quotas';
export * from './distribution';
export * from './garantie';
export * from './devis';
export * from './validateurs';
