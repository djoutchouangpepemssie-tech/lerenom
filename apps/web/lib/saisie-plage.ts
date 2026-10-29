import { LIBELLE_TYPE_PLAGE, type SaisiePlage, type TypePlage } from '@lerenom/core';

/**
 * Lire une plage d'agenda depuis une requête.
 *
 * La lecture du corps et celle de la plage sont séparées : la route de création a besoin du
 * corps **entier** — pour le client d'une proposition — et le lire deux fois obligerait à
 * cloner la requête, ce qui ramène une valeur non typée là où tout le reste est vérifié.
 */

/** Le corps JSON d'une requête, ou `null` s'il est illisible. */
export async function litLeCorps(requete: Request): Promise<Record<string, unknown> | null> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return null;
  }
  if (typeof corps !== 'object' || corps === null) return null;
  return corps as Record<string, unknown>;
}

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}

/**
 * La plage décrite par un corps déjà analysé.
 *
 * La saisie vient du navigateur : elle est suspecte jusqu'à preuve du contraire. Une date
 * illisible ressort en `Invalid Date`, que `problemesPlage` traite comme une saisie
 * manquante — jamais en exception à cinq cents.
 *
 * Les champs sont lus comme des chaînes explicitement, et non par `String(inconnu)` : un
 * objet s'y transformerait en « [object Object] », qu'on comparerait ensuite sans rien
 * remarquer.
 */
export function litSaisiePlage(donnees: Record<string, unknown>): SaisiePlage | null {
  const type = texte(donnees['type']);
  if (!(type in LIBELLE_TYPE_PLAGE)) return null;

  return {
    type: type as TypePlage,
    debut: new Date(texte(donnees['debut'])),
    fin: new Date(texte(donnees['fin'])),
  };
}
