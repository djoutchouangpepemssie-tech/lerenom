/**
 * Les travaux périodiques, et leur routage.
 *
 * Séparé du worker à dessein : le worker est du câblage — des files, des minuteurs, des
 * signaux d'arrêt — et le câblage ne se teste pas utilement. Le routage, lui, se teste : un
 * nom de travail mal orthographié dans une planification doit échouer bruyamment plutôt que
 * de ne rien faire toutes les nuits sans que personne ne s'en aperçoive.
 */

import { demandeConfirmationIntervention, inviteAuxAvis } from './avis.ts';
import { perimeLesDemandes, recalculeScores } from './scores.ts';

/** Les travaux connus, et ce qu'ils font. */
export const TRAVAUX_DE_NUIT = {
  scores: async () => ({ scores: await recalculeScores() }),
  peremption: async () => ({ perimees: await perimeLesDemandes() }),
  'invitations-avis': async () => await inviteAuxAvis(),
  'confirmations-intervention': async () => await demandeConfirmationIntervention(),
} as const;

export type NomTravailDeNuit = keyof typeof TRAVAUX_DE_NUIT;

/** Un nom est-il un travail connu ? */
export function estUnTravailDeNuit(nom: string): nom is NomTravailDeNuit {
  return Object.hasOwn(TRAVAUX_DE_NUIT, nom);
}

/**
 * Exécute un travail par son nom.
 *
 * Un nom inconnu lève : une planification mal orthographiée doit se voir au premier
 * déclenchement, pas après six mois de nuits sans effet.
 */
export async function executeTravailDeNuit(nom: string): Promise<unknown> {
  if (!estUnTravailDeNuit(nom)) {
    const connus = Object.keys(TRAVAUX_DE_NUIT).join(', ');
    throw new Error(`Travail de nuit inconnu : « ${nom} ». Connus : ${connus}.`);
  }
  return TRAVAUX_DE_NUIT[nom]();
}
