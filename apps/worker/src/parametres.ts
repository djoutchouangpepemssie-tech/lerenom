/**
 * Les paramètres d'exploitation, lus en base.
 *
 * Le worker ne connaît aucun délai en dur : il lit la table `parametres`, historisée, que le
 * back-office modifie. Un délai changé par Arcel s'applique à la prochaine demande distribuée,
 * sans déploiement.
 */

import { prisma } from '@lerenom/db';
import { PARAMETRES_PAR_DEFAUT } from '@lerenom/core';
import type { Parametres } from '@lerenom/core';

/** Les paramètres en vigueur, recomposés depuis la table historisée. */
export async function parametresEnVigueur(): Promise<Parametres> {
  const lignes = await prisma.parametre.findMany({ where: { finitLe: null } });
  const parCle = new Map(lignes.map((l) => [l.cle, l.valeur]));

  const nombre = (cle: string, defaut: number): number => {
    const valeur = parCle.get(cle);
    return typeof valeur === 'number' ? valeur : defaut;
  };

  return {
    ...PARAMETRES_PAR_DEFAUT,
    noteMinimale: nombre('classement.noteMinimale', PARAMETRES_PAR_DEFAUT.noteMinimale),
    prosMaxParDemande: nombre(
      'distribution.prosMaxParDemande',
      PARAMETRES_PAR_DEFAUT.prosMaxParDemande,
    ),
    minutesExclusiviteExclusif: nombre(
      'distribution.minutesExclusiviteExclusif',
      PARAMETRES_PAR_DEFAUT.minutesExclusiviteExclusif,
    ),
    minutesReponseAutresPros: nombre(
      'distribution.minutesReponseAutresPros',
      PARAMETRES_PAR_DEFAUT.minutesReponseAutresPros,
    ),
    minutesAvanceUrgence: nombre(
      'distribution.minutesAvanceUrgence',
      PARAMETRES_PAR_DEFAUT.minutesAvanceUrgence,
    ),
    heuresFraicheurDemande: nombre(
      'distribution.heuresFraicheurDemande',
      PARAMETRES_PAR_DEFAUT.heuresFraicheurDemande,
    ),
    rayonAgenceParDefautKm: nombre(
      'distribution.rayonAgenceParDefautKm',
      PARAMETRES_PAR_DEFAUT.rayonAgenceParDefautKm,
    ),
    seuilAlerteForfait: nombre(
      'quotas.seuilAlerteForfait',
      PARAMETRES_PAR_DEFAUT.seuilAlerteForfait,
    ),
  };
}
