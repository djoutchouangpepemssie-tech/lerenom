/**
 * @lerenom/core — les règles métier de Le Renom.
 *
 * Tout ce que la plateforme décide se décide ici, en fonctions pures, sans base de données,
 * sans réseau et sans framework. Les applications orchestrent : elles lisent, appellent une
 * règle, écrivent le résultat et le journalisent. Elles ne décident pas.
 */

export * from './regles-validees.ts';
export * from './parametres.ts';
export * from './geo.ts';
export * from './score.ts';
export * from './classement.ts';
export * from './zones.ts';
export * from './quotas.ts';
export * from './distribution.ts';
export * from './garantie.ts';
export * from './devis.ts';
export * from './avoir.ts';
export * from './rib.ts';
export * from './validateurs.ts';
export * from './verification.ts';
export * from './liens.ts';
export * from './avis.ts';
export * from './contestation.ts';
export * from './mot-de-passe.ts';
export * from './connexion.ts';
export * from './inscription.ts';
export * from './fiche.ts';
export * from './horaires.ts';
