import { LIBELLE_TYPE_PLAGE, type SaisiePlage, type TypePlage } from '@lerenom/core';

/**
 * Lit une plage depuis le corps d'une requête.
 *
 * La saisie vient du navigateur : elle est suspecte jusqu'à preuve du contraire. Une date
 * illisible ressort en `Invalid Date`, que `problemesPlage` traite comme une saisie
 * manquante — jamais en exception à cinq cents.
 */
function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}

export async function litSaisiePlage(requete: Request): Promise<SaisiePlage | null> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return null;
  }
  if (typeof corps !== 'object' || corps === null) return null;
  const donnees = corps as Record<string, unknown>;

  // Lire explicitement des chaînes plutôt que `String(inconnu)` : un objet s'y serait
  // transformé en « [object Object] », qu'on aurait ensuite comparé sans rien remarquer.
  const type = texte(donnees['type']);
  if (!(type in LIBELLE_TYPE_PLAGE)) return null;

  return {
    type: type as TypePlage,
    debut: new Date(texte(donnees['debut'])),
    fin: new Date(texte(donnees['fin'])),
  };
}
