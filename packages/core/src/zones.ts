/**
 * Les zones d'apparition d'un professionnel.
 *
 * Une page est un métier dans une ville : le nombre de pages où un pro apparaît est donc le
 * produit de ses villes par ses métiers. C'est le chiffre que l'inscription affiche en direct,
 * et l'argument de vente du passage à la formule supérieure.
 */

import type { Parametres } from './parametres.js';
import type { Formule } from './regles-validees.js';

/** Statut d'ouverture d'une commune aux demandes de devis. */
export type StatutCommune = 'ouvert' | 'bientot' | 'annuaire';

export interface VilleChoisie {
  /** Code INSEE de la commune, ou code de l'arrondissement pour Paris. */
  readonly code: string;
  readonly statut: StatutCommune;
  readonly population: number;
  /** La commune du siège social du pro : elle n'est jamais retirée automatiquement. */
  readonly siege?: boolean;
}

/** Nombre de villes autorisées par la formule. `null` = sans limite (Exclusif). */
export function villesAutorisees(formule: Formule, parametres: Parametres): number | null {
  return parametres.villesMax[formule];
}

/** Nombre d'agences autorisées par la formule. `null` = sans limite (Exclusif). */
export function agencesAutorisees(formule: Formule, parametres: Parametres): number | null {
  return parametres.agencesMax[formule];
}

/** Une page = un métier dans une ville. */
export function nombreDePages(nombreVilles: number, nombreMetiers: number): number {
  return Math.max(0, nombreVilles) * Math.max(0, nombreMetiers);
}

/** La sélection tient-elle dans la formule ? */
export function selectionValide(
  villes: readonly VilleChoisie[],
  formule: Formule,
  parametres: Parametres,
): boolean {
  const limite = villesAutorisees(formule, parametres);
  return limite === null || villes.length <= limite;
}

/**
 * Priorité de conservation d'une ville : plus le nombre est petit, plus la ville est gardée.
 *
 * Ordre imposé : la ville du siège en dernier (donc gardée en priorité), puis les villes
 * ouvertes aux demandes, puis celles qui ouvrent bientôt, puis l'annuaire. C'est l'ordre qui
 * conserve au pro le plus de valeur réelle : une ville ouverte lui envoie des demandes, une
 * ville d'annuaire ne lui apporte aujourd'hui que de la visibilité.
 */
export function prioriteConservation(ville: VilleChoisie): number {
  if (ville.siege === true) return 0;
  switch (ville.statut) {
    case 'ouvert':
      return 1;
    case 'bientot':
      return 2;
    case 'annuaire':
      return 3;
  }
}

export interface AjustementZones {
  /** Les villes gardées, dans l'ordre de priorité de conservation. */
  readonly conservees: readonly VilleChoisie[];
  /** Les villes retirées, dans l'ordre où elles l'ont été. */
  readonly retirees: readonly VilleChoisie[];
}

/**
 * Ajuste une sélection de villes à la formule choisie.
 *
 * Appelée à l'inscription (étape 6) et à chaque changement de formule en descente. Le pro est
 * toujours prévenu du retrait et peut corriger lui-même sa sélection : cette fonction propose,
 * elle ne décide pas à sa place.
 *
 * À statut égal, la ville la plus peuplée est gardée — c'est celle qui apporte le plus de
 * recherches — et le code INSEE tranche les égalités restantes pour que le résultat soit
 * reproductible.
 */
export function ajusteZonesPourFormule(
  villes: readonly VilleChoisie[],
  formule: Formule,
  parametres: Parametres,
): AjustementZones {
  const limite = villesAutorisees(formule, parametres);
  const triees = [...villes].sort((a, b) => {
    const pa = prioriteConservation(a);
    const pb = prioriteConservation(b);
    if (pa !== pb) return pa - pb;
    if (b.population !== a.population) return b.population - a.population;
    return a.code.localeCompare(b.code);
  });

  if (limite === null || triees.length <= limite) {
    return { conservees: triees, retirees: [] };
  }

  return {
    conservees: triees.slice(0, limite),
    // Les dernières de l'ordre de conservation sont les premières retirées.
    retirees: triees.slice(limite).reverse(),
  };
}
