'use client';

import { useEffect, useState } from 'react';
import { cn } from '../utilitaires';

/**
 * Le minuteur d'une demande : 30 minutes pour l'Exclusif, 2 heures pour les autres.
 *
 * Il affiche le temps restant et change de couleur quand il devient court. L'échéance est
 * calculée côté serveur et passée en millisecondes : le navigateur ne décide jamais de
 * l'expiration, il l'affiche.
 */
export function Minuteur({
  echeance,
  className,
  surExpiration,
}: {
  readonly echeance: Date;
  readonly className?: string;
  readonly surExpiration?: () => void;
}) {
  /**
   * `null` tant que le composant n'est pas monté.
   *
   * Le temps restant ne peut pas être calculé au rendu serveur : entre ce rendu et
   * l'hydratation, quelques centaines de millisecondes passent, et React trouve deux textes
   * différents — ce qui casse l'hydratation de toute la page. On n'affiche donc rien de
   * daté tant que le navigateur n'a pas pris la main : le décompte apparaît au montage,
   * c'est-à-dire aussitôt.
   */
  const [restantMs, setRestantMs] = useState<number | null>(null);

  useEffect(() => {
    const met = () => {
      const restant = echeance.getTime() - Date.now();
      setRestantMs(restant);
      return restant;
    };

    if (met() <= 0) {
      surExpiration?.();
      return;
    }

    const identifiant = setInterval(() => {
      if (met() <= 0) {
        clearInterval(identifiant);
        surExpiration?.();
      }
    }, 1000);
    return () => clearInterval(identifiant);
  }, [echeance, surExpiration]);

  const expire = restantMs !== null && restantMs <= 0;
  const minutes = Math.max(0, Math.floor((restantMs ?? 0) / 60000));
  const secondes = Math.max(0, Math.floor(((restantMs ?? 0) % 60000) / 1000));
  const urgent = restantMs !== null && !expire && restantMs < 5 * 60 * 1000;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
        expire
          ? 'bg-encre/[0.06] text-encre-55'
          : urgent
            ? 'bg-erreur-fond text-erreur'
            : 'bg-alerte-fond text-alerte',
        className,
      )}
      // Le temps restant change chaque seconde : on ne le fait pas annoncer en boucle.
      aria-live="off"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 14 14"
        className="size-3.5 fill-none stroke-current stroke-[1.6]"
      >
        <circle cx="7" cy="7.6" r="5.4" />
        <path d="M7 4.6v3l2 1.4" strokeLinecap="round" />
      </svg>
      {restantMs === null
        ? // Avant le montage, aucun texte tiré de l'horloge : un décompte est par nature une
          // affaire de navigateur, et le moindre écart entre le rendu serveur et le rendu
          // client empêcherait React d'hydrater la page entière.
          '—'
        : expire
          ? 'Délai dépassé'
          : `${minutes} min ${String(secondes).padStart(2, '0')} s`}
    </span>
  );
}
