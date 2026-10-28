'use client';

import { useEffect, useState } from 'react';
import {
  JOURS,
  LIBELLE_JOUR,
  creneauLisible,
  estOuvert,
  fermetureEnCours,
  heureLisible,
  prochaineOuverture,
  type Horaires,
} from '@lerenom/core';
import { cn } from '@lerenom/ui';

/**
 * Les horaires, et surtout la réponse à « puis-je appeler maintenant ? ».
 *
 * Le composant est client **et attend d'être monté** avant d'annoncer un état. Le serveur
 * rend la page à une heure, le navigateur l'affiche à une autre : calculer « ouvert » des deux
 * côtés produit deux textes différents, et React refuse alors d'hydrater toute la page. C'est
 * exactement le bogue déjà rencontré sur le minuteur de suivi — il ne se voit qu'en
 * production, et seulement à certaines heures.
 *
 * Le tableau de la semaine, lui, est le même à toute heure : il s'affiche tout de suite.
 */
export function HorairesPubliques({ horaires }: { readonly horaires: Horaires }) {
  const [maintenant, setMaintenant] = useState<{ jour: string; minutes: number } | null>(null);

  useEffect(() => {
    // Le fuseau de Paris, et non celui du visiteur : « ouvert » parle de l'artisan, pas de
    // l'endroit d'où on le consulte.
    const format = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parties = format.formatToParts(new Date());
    const jour = parties.find((partie) => partie.type === 'weekday')?.value ?? '';
    const heures = Number(parties.find((partie) => partie.type === 'hour')?.value ?? '0');
    const minutes = Number(parties.find((partie) => partie.type === 'minute')?.value ?? '0');
    setMaintenant({ jour: jour.toLowerCase(), minutes: heures * 60 + minutes });
  }, []);

  const jourCourant = JOURS.find((jour) => jour === maintenant?.jour) ?? null;
  const ouvert =
    jourCourant !== null && maintenant !== null
      ? estOuvert(horaires, jourCourant, maintenant.minutes)
      : null;

  return (
    <div>
      <div aria-live="polite" className="min-h-9">
        {ouvert !== null && jourCourant !== null && maintenant !== null && (
          <Etat
            ouvert={ouvert}
            horaires={horaires}
            jour={jourCourant}
            minutes={maintenant.minutes}
          />
        )}
      </div>

      <dl className="border-bordure mt-4 divide-y divide-[var(--color-bordure)] border-t border-b">
        {JOURS.map((jour) => {
          const creneaux = horaires[jour];
          return (
            <div
              key={jour}
              className={cn(
                'flex items-baseline justify-between gap-4 py-2.5 text-sm',
                jour === jourCourant && 'font-semibold',
              )}
            >
              <dt className="text-encre-70">{LIBELLE_JOUR[jour]}</dt>
              <dd className={creneaux.length === 0 ? 'text-encre-55' : 'text-encre'}>
                {creneaux.length === 0
                  ? 'Fermé'
                  : creneaux.map((creneau) => creneauLisible(creneau)).join(' · ')}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function Etat({
  ouvert,
  horaires,
  jour,
  minutes,
}: {
  readonly ouvert: boolean;
  readonly horaires: Horaires;
  readonly jour: (typeof JOURS)[number];
  readonly minutes: number;
}) {
  if (ouvert) {
    const fermeture = fermetureEnCours(horaires, jour, minutes);
    return (
      <p className="bg-succes-fond text-succes inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold">
        Ouvert
        {fermeture !== null && (
          <span className="font-normal">· jusqu’à {heureLisible(fermeture)}</span>
        )}
      </p>
    );
  }

  const suivante = prochaineOuverture(horaires, jour, minutes);
  return (
    <p className="bg-encre/[0.06] text-encre-70 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold">
      Fermé
      {suivante !== null && (
        <span className="font-normal">
          · rouvre{' '}
          {suivante.dansNJours === 0
            ? `à ${heureLisible(suivante.minutes)}`
            : suivante.dansNJours === 1
              ? `demain à ${heureLisible(suivante.minutes)}`
              : `${LIBELLE_JOUR[suivante.jour].toLowerCase()} à ${heureLisible(suivante.minutes)}`}
        </span>
      )}
    </p>
  );
}
