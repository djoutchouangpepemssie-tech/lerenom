/**
 * Géographie : distances et boîtes englobantes.
 *
 * Ces fonctions sont pures et testées, de sorte que l'éligibilité d'un pro à une demande ne
 * dépende pas de la disponibilité de PostGIS. En production, les requêtes SQL filtrent d'abord
 * sur une boîte englobante indexée, puis la distance exacte est vérifiée ici ou par PostGIS :
 * les deux donnent le même résultat, à quelques mètres près.
 */

/** Un point géographique, en degrés décimaux (WGS 84). */
export interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

const RAYON_TERRE_KM = 6371.0088;

function enRadians(degres: number): number {
  return (degres * Math.PI) / 180;
}

/**
 * Distance orthodromique entre deux points, en kilomètres (formule de haversine).
 *
 * Précision suffisante pour une zone d'intervention : l'écart avec une distance géodésique
 * exacte reste sous 0,5 % à l'échelle de l'Île-de-France.
 */
export function distanceKm(a: Point, b: Point): number {
  const dLat = enRadians(b.latitude - a.latitude);
  const dLon = enRadians(b.longitude - a.longitude);
  const latA = enRadians(a.latitude);
  const latB = enRadians(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;

  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BoiteEnglobante {
  readonly latitudeMin: number;
  readonly latitudeMax: number;
  readonly longitudeMin: number;
  readonly longitudeMax: number;
}

/**
 * Boîte englobante d'un disque, pour pré-filtrer en SQL avant de calculer la distance exacte.
 *
 * La boîte est toujours plus large que le disque : elle ne peut pas écarter un point éligible,
 * seulement en laisser passer quelques-uns en trop, que `distanceKm` élimine ensuite.
 */
export function boiteEnglobante(centre: Point, rayonKm: number): BoiteEnglobante {
  const deltaLat = (rayonKm / RAYON_TERRE_KM) * (180 / Math.PI);
  // Près des pôles le parallèle se resserre : on élargit la boîte en longitude en conséquence.
  const cosLat = Math.cos(enRadians(centre.latitude));
  const deltaLon =
    Math.abs(cosLat) < 1e-9
      ? 180
      : (rayonKm / (RAYON_TERRE_KM * Math.abs(cosLat))) * (180 / Math.PI);

  return {
    latitudeMin: Math.max(-90, centre.latitude - deltaLat),
    latitudeMax: Math.min(90, centre.latitude + deltaLat),
    longitudeMin: Math.max(-180, centre.longitude - deltaLon),
    longitudeMax: Math.min(180, centre.longitude + deltaLon),
  };
}

/** Une agence couvre-t-elle une adresse ? Un rayon nul ou négatif ne couvre rien. */
export function couvre(agence: Point, rayonKm: number, adresse: Point): boolean {
  if (rayonKm <= 0) return false;
  return distanceKm(agence, adresse) <= rayonKm;
}

/**
 * Normalise une distance en un score entre 0 et 1, pour le critère de proximité.
 * À la distance nulle le score vaut 1 ; au-delà du rayon de référence il vaut 0.
 */
export function scoreProximite(distanceEnKm: number, rayonReferenceKm: number): number {
  if (rayonReferenceKm <= 0) return 0;
  if (distanceEnKm <= 0) return 1;
  if (distanceEnKm >= rayonReferenceKm) return 0;
  return 1 - distanceEnKm / rayonReferenceKm;
}

/**
 * La distance, écrite comme on peut l'affirmer.
 *
 * Les positions dont dispose Le Renom sont des **points de référence communaux** tant que les
 * adresses ne sont pas géocodées une à une. Afficher « à 1,2 km » revendiquerait une
 * précision de cent mètres que cette donnée n'a pas : deux artisans de la même rue auraient
 * le même chiffre, et deux artisans de la même commune aussi.
 *
 * On écrit donc ce qu'on sait, et à la maille où on le sait :
 *
 *   * même commune, ou presque : « dans votre ville » — c'est l'information utile, et elle
 *     est vraie ;
 *   * en deçà de dix kilomètres : le kilomètre entier ;
 *   * au-delà : par cinq, parce que la différence entre 42 et 43 km ne change aucune
 *     décision et que la donnée ne la garantit pas.
 */
export function distanceLisible(distanceEnKm: number): string {
  if (distanceEnKm < 1.5) return 'dans votre ville';
  if (distanceEnKm < 10) return `à ${String(Math.round(distanceEnKm))} km`;
  return `à ${String(Math.round(distanceEnKm / 5) * 5)} km`;
}
