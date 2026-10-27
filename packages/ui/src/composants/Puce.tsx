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
  desactivee = false,
  titre,
  children,
  className,
}: {
  readonly active?: boolean | undefined;
  readonly onBascule?: (() => void) | undefined;
  // `| undefined` explicite : avec `exactOptionalPropertyTypes`, un appelant qui calcule la
  // valeur — `compte={n || undefined}` — ne doit pas se voir refuser la propriété.
  readonly compte?: number | undefined;
  /** Un filtre qui ne laisserait aucun résultat se désactive plutôt que de vider la page. */
  readonly desactivee?: boolean | undefined;
  readonly titre?: string | undefined;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={desactivee}
      title={titre}
      onClick={onBascule}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 py-2',
        'text-sm font-semibold transition-all duration-[var(--duree-courte)]',
        desactivee
          ? 'border-bordure bg-carte text-encre-40 cursor-not-allowed opacity-60'
          : active
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
