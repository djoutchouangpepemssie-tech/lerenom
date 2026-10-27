'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Un nombre qui monte quand il entre dans l'écran.
 *
 * Sous `prefers-reduced-motion`, la valeur finale s'affiche immédiatement : l'animation est un
 * agrément, pas le moyen de lire le chiffre.
 */
export function Compteur({
  valeur,
  dureeMs = 1100,
  suffixe = '',
  className,
}: {
  readonly valeur: number;
  readonly dureeMs?: number;
  readonly suffixe?: string;
  readonly className?: string;
}) {
  const reference = useRef<HTMLSpanElement>(null);
  const [affiche, setAffiche] = useState(0);

  useEffect(() => {
    const element = reference.current;
    if (element === null) return;

    const mouvementReduit =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (mouvementReduit) {
      setAffiche(valeur);
      return;
    }

    let image = 0;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees[0]?.isIntersecting !== true) return;
        observateur.disconnect();

        const depart = performance.now();
        const avance = (maintenant: number) => {
          const part = Math.min(1, (maintenant - depart) / dureeMs);
          // Sortie douce : le compteur ralentit en approchant de sa valeur.
          setAffiche(Math.round(valeur * (1 - (1 - part) ** 3)));
          if (part < 1) image = requestAnimationFrame(avance);
        };
        image = requestAnimationFrame(avance);
      },
      { threshold: 0.4 },
    );

    observateur.observe(element);
    return () => {
      observateur.disconnect();
      cancelAnimationFrame(image);
    };
  }, [valeur, dureeMs]);

  return (
    <span ref={reference} className={className}>
      {affiche.toLocaleString('fr-FR')}
      {suffixe}
    </span>
  );
}
