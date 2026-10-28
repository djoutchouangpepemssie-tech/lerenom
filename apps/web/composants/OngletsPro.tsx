'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lerenom/ui';

/**
 * Les onglets de l'espace professionnel.
 *
 * Ils ne marquaient pas la page courante. Avec deux onglets cela passait encore ; avec quatre,
 * dont un qui sort du cadre sur téléphone et qu'il faut aller chercher en faisant défiler, ne
 * pas savoir où l'on se trouve devient un vrai inconfort.
 *
 * L'onglet courant est souligné **et** porte `aria-current` : la couleur seule ne suffit pas,
 * ni pour un lecteur d'écran ni pour qui distingue mal les contrastes.
 */
export function OngletsPro({
  onglets,
}: {
  readonly onglets: readonly { readonly href: string; readonly libelle: string }[];
}) {
  const chemin = usePathname();
  const barre = useRef<HTMLElement>(null);

  // Quatre onglets ne tiennent pas sur un téléphone : sans ceci, l'onglet courant est hors
  // cadre et il faut faire défiler pour savoir où l'on se trouve. On déplace la barre
  // elle-même, et non la page : `scrollIntoView` entraînerait le document entier.
  useEffect(() => {
    const element = barre.current;
    if (element === null) return;
    const actif = element.querySelector<HTMLElement>('[aria-current="page"]');
    if (actif === null) return;
    const decalage = actif.offsetLeft - (element.clientWidth - actif.clientWidth) / 2;
    element.scrollLeft = Math.max(0, decalage);
  }, [chemin]);

  return (
    <nav ref={barre} aria-label="Espace professionnel" className="flex gap-1 overflow-x-auto pb-1">
      {onglets.map((onglet) => {
        // `/pro/espace` est le préfixe de tous les autres : il n'est courant qu'exactement.
        const courant =
          onglet.href === '/pro/espace' ? chemin === onglet.href : chemin.startsWith(onglet.href);
        return (
          <Link
            key={onglet.href}
            href={onglet.href}
            aria-current={courant ? 'page' : undefined}
            className={cn(
              'rounded-t-[var(--radius-douce)] border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
              courant
                ? 'border-or text-encre font-semibold'
                : 'text-encre-70 hover:text-encre hover:border-or border-transparent',
            )}
          >
            {onglet.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
