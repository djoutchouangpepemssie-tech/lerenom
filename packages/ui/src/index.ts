/**
 * @lerenom/ui — le design system de Le Renom.
 *
 * Les jetons vivent dans `styles.css`, importé une fois par l'application. Les composants ne
 * portent ni couleur ni durée en dur : ils lisent les variables CSS, de sorte que l'identité
 * puisse évoluer sans toucher à un seul composant.
 */

export { cn, retardApparition } from './utilitaires';

export { Bouton } from './composants/Bouton';
export type { AspectBouton, ProprietesBouton, TailleBouton } from './composants/Bouton';

export {
  BadgeMerite,
  BadgePayant,
  ListeBadgesMerite,
  MentionSponsorise,
  SceauExclusivite,
} from './composants/Badge';
export type { Merite, ProprietesBadgePayant } from './composants/Badge';

export { Accent, Apparition, Conteneur, Section, TitreSection } from './composants/Mise';
export { Carte, Chiffre } from './composants/Carte';
export { Champ, Liste, ZoneTexte } from './composants/Champ';
export { BarrePuces, Puce } from './composants/Puce';
export { Onglets } from './composants/Onglets';
export type { Onglet } from './composants/Onglets';
export { Anneau, Jauge } from './composants/Jauge';
export { Minuteur } from './composants/Minuteur';
export { Compteur } from './composants/Compteur';
export { BandeauDefilant } from './composants/Bandeau';
export { Note } from './composants/Note';
export { BarreCollante, Modale, Tiroir } from './composants/Modale';
export { CielEtoile, Epingle, ToitsDeParis } from './composants/ToitsDeParis';
