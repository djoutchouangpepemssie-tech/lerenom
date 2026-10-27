import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utilitaires';

export type AspectBouton = 'or' | 'encre' | 'contour' | 'discret' | 'danger';
export type TailleBouton = 'petit' | 'moyen' | 'grand';

export interface ProprietesBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly aspect?: AspectBouton;
  readonly taille?: TailleBouton;
  /** Occupe toute la largeur : utile dans les barres d'action collées en bas sur téléphone. */
  readonly pleineLargeur?: boolean;
  readonly icone?: ReactNode;
  readonly chargement?: boolean;
}

const ASPECTS: Record<AspectBouton, string> = {
  or: 'bg-or text-encre hover:bg-or-clair active:bg-or-fonce active:text-creme shadow-posee hover:shadow-or',
  encre: 'bg-encre text-creme hover:bg-nuit shadow-posee hover:shadow-levee',
  contour: 'border border-bordure bg-carte text-encre hover:border-or hover:bg-creme',
  discret: 'bg-transparent text-encre-70 hover:bg-creme hover:text-encre',
  danger: 'bg-erreur-fond text-erreur border border-erreur/25 hover:bg-erreur hover:text-carte',
};

/* Toutes les cibles font au moins 40 px de haut (cahier des charges §18, accessibilité). */
const TAILLES: Record<TailleBouton, string> = {
  petit: 'min-h-10 px-3.5 text-sm gap-1.5',
  moyen: 'min-h-11 px-5 text-[0.95rem] gap-2',
  grand: 'min-h-13 px-7 text-base gap-2.5',
};

/**
 * Le bouton de Le Renom.
 *
 * Aucun bouton n'est décoratif : s'il est affiché, il fait quelque chose. Quand une action est
 * momentanément impossible, on le désactive avec un `title` qui dit pourquoi — on ne le masque
 * pas, pour que l'utilisateur sache que l'action existe.
 */
export function Bouton({
  aspect = 'contour',
  taille = 'moyen',
  pleineLargeur = false,
  icone,
  chargement = false,
  className,
  children,
  disabled,
  type = 'button',
  ...reste
}: ProprietesBouton) {
  return (
    <button
      type={type}
      disabled={disabled === true || chargement}
      aria-busy={chargement || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-douce)] font-semibold',
        'transition-all duration-[var(--duree-moyenne)] ease-[var(--courbe)]',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
        'active:translate-y-px',
        ASPECTS[aspect],
        TAILLES[taille],
        pleineLargeur && 'w-full',
        className,
      )}
      {...reste}
    >
      {chargement ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icone
      )}
      {children}
    </button>
  );
}
