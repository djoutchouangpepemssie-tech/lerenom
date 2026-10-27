import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utilitaires';

export interface ProprietesCarte extends HTMLAttributes<HTMLDivElement> {
  /** La carte se soulève au survol. Réservé aux cartes cliquables. */
  readonly survolable?: boolean;
  readonly liseréOr?: boolean;
  readonly sombre?: boolean;
}

export function Carte({
  survolable = false,
  liseréOr = false,
  sombre = false,
  className,
  children,
  ...reste
}: ProprietesCarte) {
  return (
    <div
      className={cn(
        // `min-w-0` : sans lui, une carte placée dans une grille ou un flex impose sa largeur
        // minimale de contenu à la piste, et la page déborde horizontalement sur téléphone.
        'shadow-posee min-w-0 rounded-[var(--radius-carte)] border',
        'transition-all duration-[var(--duree-moyenne)] ease-[var(--courbe)]',
        sombre ? 'border-or/20 bg-nuit text-creme' : 'border-bordure bg-carte text-encre',
        liseréOr && 'border-or/55 ring-or/20 ring-1',
        survolable && 'hover:shadow-levee hover:-translate-y-1',
        survolable && !sombre && 'hover:border-or/45',
        className,
      )}
      {...reste}
    >
      {children}
    </div>
  );
}

/** Une statistique mise en avant : un nombre, son libellé, et rien d'autre. */
export function Chiffre({
  valeur,
  libelle,
  clair = false,
}: {
  readonly valeur: ReactNode;
  readonly libelle: string;
  readonly clair?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          'font-[family-name:var(--font-titre)] text-[clamp(1.9rem,4.5vw,2.9rem)] leading-none',
          clair ? 'text-or-clair' : 'text-or-fonce',
        )}
      >
        {valeur}
      </p>
      <p className={cn('mt-2 text-sm', clair ? 'text-creme/70' : 'text-encre-55')}>{libelle}</p>
    </div>
  );
}
