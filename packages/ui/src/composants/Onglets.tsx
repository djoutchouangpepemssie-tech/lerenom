'use client';

import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { cn } from '../utilitaires';

export interface Onglet {
  readonly cle: string;
  readonly libelle: string;
  readonly compte?: number;
  readonly contenu: ReactNode;
}

/**
 * Des onglets navigables au clavier, conformes au modèle ARIA : flèches pour changer d'onglet,
 * un seul onglet dans l'ordre de tabulation, le panneau actif associé par `aria-controls`.
 *
 * C'est le composant qui tient la règle de mise en page du back-office : 4 indicateurs au
 * maximum par page, puis des onglets, un seul tableau visible à la fois.
 */
export function Onglets({
  onglets,
  etiquette,
  className,
}: {
  readonly onglets: readonly Onglet[];
  readonly etiquette: string;
  readonly className?: string;
}) {
  const base = useId();
  const [actif, setActif] = useState(onglets[0]?.cle ?? '');
  const indexActif = Math.max(
    0,
    onglets.findIndex((o) => o.cle === actif),
  );

  function deplace(pas: number) {
    const suivant = onglets[(indexActif + pas + onglets.length) % onglets.length];
    if (suivant !== undefined) {
      setActif(suivant.cle);
      document.getElementById(`${base}-${suivant.cle}`)?.focus();
    }
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={etiquette}
        className="border-bordure flex gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onKeyDown={(evenement) => {
          if (evenement.key === 'ArrowRight') {
            evenement.preventDefault();
            deplace(1);
          }
          if (evenement.key === 'ArrowLeft') {
            evenement.preventDefault();
            deplace(-1);
          }
        }}
      >
        {onglets.map((onglet) => {
          const estActif = onglet.cle === actif;
          return (
            <button
              key={onglet.cle}
              id={`${base}-${onglet.cle}`}
              role="tab"
              type="button"
              aria-selected={estActif}
              aria-controls={`${base}-${onglet.cle}-panneau`}
              tabIndex={estActif ? 0 : -1}
              onClick={() => setActif(onglet.cle)}
              className={cn(
                'relative min-h-11 shrink-0 px-4 py-2.5 text-sm font-semibold whitespace-nowrap',
                'transition-colors duration-[var(--duree-courte)]',
                estActif ? 'text-encre' : 'text-encre-55 hover:text-encre',
              )}
            >
              {onglet.libelle}
              {onglet.compte !== undefined && (
                <span className="bg-creme text-encre-55 ml-2 rounded-full px-1.5 text-[0.7rem] font-bold">
                  {onglet.compte}
                </span>
              )}
              {estActif && (
                <span
                  aria-hidden="true"
                  className="bg-or absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {onglets.map((onglet) => (
        <div
          key={onglet.cle}
          id={`${base}-${onglet.cle}-panneau`}
          role="tabpanel"
          aria-labelledby={`${base}-${onglet.cle}`}
          hidden={onglet.cle !== actif}
          tabIndex={0}
          className="pt-5 focus:outline-none"
        >
          {onglet.cle === actif && onglet.contenu}
        </div>
      ))}
    </div>
  );
}
