'use client';

import type { ReactNode } from 'react';
import { cn } from '../utilitaires';

/**
 * Une puce de filtre, qui se coche et se décoche.
 * `aria-pressed` est obligatoire : sans lui, un lecteur d'écran annonce un bouton sans état.
 */
export function Puce({
  active = false,
  onBascule,
  compte,
  children,
  className,
}: {
  readonly active?: boolean;
  readonly onBascule?: () => void;
  readonly compte?: number;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onBascule}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 py-2',
        'text-sm font-semibold transition-all duration-[var(--duree-courte)]',
        active
          ? 'border-or bg-or/15 text-or-fonce shadow-posee'
          : 'border-bordure bg-carte text-encre-70 hover:border-or/50 hover:text-encre',
        className,
      )}
    >
      {children}
      {compte !== undefined && (
        <span
          className={cn(
            'rounded-full px-1.5 text-[0.7rem] font-bold',
            active ? 'bg-or/25 text-or-fonce' : 'bg-creme text-encre-55',
          )}
        >
          {compte}
        </span>
      )}
    </button>
  );
}

/**
 * Une liste de puces qui défile horizontalement sur téléphone.
 * Le défilement est interne à la barre : la page elle-même ne défile jamais horizontalement.
 */
export function BarrePuces({
  children,
  className,
  etiquette,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly etiquette: string;
}) {
  return (
    <div
      role="group"
      aria-label={etiquette}
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible',
        '[&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}
