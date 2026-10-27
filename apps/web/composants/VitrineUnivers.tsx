'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Carte, cn } from '@lerenom/ui';

export interface UniversVitrine {
  readonly slug: string;
  readonly nom: string;
  readonly couleur: string;
  readonly icone: string;
  readonly metiers: readonly {
    readonly slug: string;
    readonly nom: string;
    readonly nombrePrestations: number;
    readonly prestations: readonly { readonly slug: string; readonly nom: string }[];
  }[];
}

/**
 * La vitrine des univers : des tuiles, puis le panneau du métier choisi avec ses prestations.
 *
 * C'est le même geste que la « fenêtre des services » de l'inscription pro et de la demande de
 * devis : on choisit un univers, puis un métier, puis une prestation. L'arborescence est la même
 * partout, donc l'habitude prise ici sert ailleurs.
 */
export function VitrineUnivers({
  univers,
  className,
}: {
  readonly univers: readonly UniversVitrine[];
  readonly className?: string;
}) {
  const [universActif, setUniversActif] = useState(univers[0]?.slug ?? '');
  const courant = univers.find((u) => u.slug === universActif) ?? univers[0];

  if (courant === undefined) return null;

  return (
    <div className={className}>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {univers.map((u) => {
          const actif = u.slug === courant.slug;
          return (
            <li key={u.slug}>
              <button
                type="button"
                onClick={() => setUniversActif(u.slug)}
                aria-pressed={actif}
                className={cn(
                  'flex h-full w-full flex-col items-start gap-2.5 rounded-[var(--radius-carte)] border p-3.5 text-left',
                  'transition-all duration-[var(--duree-moyenne)] ease-[var(--courbe)]',
                  actif
                    ? 'border-or/55 bg-or/[0.07] shadow-posee'
                    : 'border-bordure bg-carte hover:border-or/40 hover:shadow-posee hover:-translate-y-0.5',
                )}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-6 shrink-0"
                  style={{ color: u.couleur }}
                >
                  <path d={u.icone} fill="currentColor" />
                </svg>
                <span className="text-encre text-[0.82rem] leading-snug font-semibold">
                  {u.nom}
                </span>
                <span className="text-encre-40 mt-auto text-[0.7rem]">
                  {u.metiers.length} métiers
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Carte className="mt-5 p-5 md:p-7">
        <div className="flex items-center gap-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-7 shrink-0"
            style={{ color: courant.couleur }}
          >
            <path d={courant.icone} fill="currentColor" />
          </svg>
          <h3 className="text-xl md:text-2xl">{courant.nom}</h3>
        </div>

        <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {courant.metiers.map((metier) => (
            <div key={metier.slug}>
              <Link
                href={`/${metier.slug}`}
                className="group text-encre inline-flex items-center gap-1.5 font-semibold"
              >
                {metier.nom}
                <span
                  aria-hidden="true"
                  className="text-or opacity-0 transition-opacity group-hover:opacity-100"
                >
                  →
                </span>
              </Link>
              <ul className="mt-2 space-y-1">
                {metier.prestations.map((prestation) => (
                  <li key={prestation.slug}>
                    <Link
                      href={`/${metier.slug}`}
                      className="text-encre-55 hover:text-or-fonce text-sm transition-colors"
                    >
                      {prestation.nom}
                    </Link>
                  </li>
                ))}
                {metier.nombrePrestations > metier.prestations.length && (
                  <li className="text-encre-40 text-sm">
                    et {metier.nombrePrestations - metier.prestations.length} autres
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </Carte>
    </div>
  );
}
