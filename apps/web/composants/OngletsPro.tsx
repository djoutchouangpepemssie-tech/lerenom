'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
 *
 * La barre s'estompe du côté où il reste des onglets. Sans cela, la capture à 390 px montrait
 * « tre » collé au bord gauche : un mot tranché net ressemble à un défaut d'affichage, et rien
 * ne disait qu'il suffisait de faire glisser. Un dégradé le dit sans un mot — et il disparaît
 * dès qu'on atteint le bout, pour ne pas suggérer un ailleurs qui n'existe pas.
 */
export function OngletsPro({
  onglets,
}: {
  readonly onglets: readonly { readonly href: string; readonly libelle: string }[];
}) {
  const chemin = usePathname();
  const barre = useRef<HTMLElement>(null);
  const [reste, setReste] = useState({ gauche: false, droite: false });

  const mesure = useCallback(() => {
    const element = barre.current;
    if (element === null) return;
    const bout = element.scrollWidth - element.clientWidth - element.scrollLeft;
    // Un pixel de tolérance : les largeurs fractionnaires laissent un reliquat qui ferait
    // clignoter le dégradé en bout de course.
    setReste({ gauche: element.scrollLeft > 1, droite: bout > 1 });
  }, []);

  // Quatre onglets ne tiennent pas sur un téléphone : sans ceci, l'onglet courant est hors
  // cadre et il faut faire défiler pour savoir où l'on se trouve. On déplace la barre
  // elle-même, et non la page : `scrollIntoView` entraînerait le document entier.
  useEffect(() => {
    const element = barre.current;
    if (element === null) return;
    const actif = element.querySelector<HTMLElement>('[aria-current="page"]');
    if (actif !== null) {
      const decalage = actif.offsetLeft - (element.clientWidth - actif.clientWidth) / 2;
      element.scrollLeft = Math.max(0, decalage);
    }
    mesure();

    // La largeur disponible change à la rotation du téléphone comme au redimensionnement de
    // la fenêtre : un dégradé figé mentirait dans les deux cas.
    const observateur = new ResizeObserver(mesure);
    observateur.observe(element);
    return () => {
      observateur.disconnect();
    };
  }, [chemin, mesure]);

  // Le masque coupe franchement là où il n'y a rien à annoncer, et s'estompe sur 24 px là où
  // la barre continue.
  const bordGauche = reste.gauche ? 'transparent 0, #000 24px' : '#000 0';
  const bordDroit = reste.droite ? '#000 calc(100% - 24px), transparent 100%' : '#000 100%';

  return (
    <nav
      ref={barre}
      onScroll={mesure}
      aria-label="Espace professionnel"
      className="flex gap-1 overflow-x-auto pb-1"
      style={{ maskImage: `linear-gradient(to right, ${bordGauche}, ${bordDroit})` }}
    >
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
