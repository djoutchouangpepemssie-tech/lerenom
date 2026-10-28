/**
 * Le recrédit automatique quand un client annule juste après une acceptation.
 *
 * Le professionnel a payé pour des coordonnées qu'il n'a pas eu le temps d'utiliser. Les lui
 * facturer serait indéfendable, et attendre qu'il réclame le serait presque autant : la plupart
 * ne réclameront jamais, et c'est précisément ce silence qui rendrait la pratique rentable.
 * Le Renom ouvre donc la contestation lui-même, et la tranche dans la foulée.
 *
 * Tout passe par une contestation, même accordée d'office : c'est la table qui fait foi devant
 * un litige, et un recrédit sans trace serait un recrédit invérifiable.
 */

import { prisma } from '@lerenom/db';
import {
  calculeRecredit,
  instruitContestation,
  PARAMETRES_PAR_DEFAUT,
  type Parametres,
} from '@lerenom/core';

/** Les paramètres en vigueur, recomposés depuis la table historisée. */
async function parametres(): Promise<Parametres> {
  const lignes = await prisma.parametre.findMany({ where: { finitLe: null } });
  const parCle = new Map(lignes.map((ligne) => [ligne.cle, ligne.valeur]));

  const nombre = (cle: string, defaut: number): number => {
    const valeur = parCle.get(cle);
    return typeof valeur === 'number' ? valeur : defaut;
  };

  return {
    ...PARAMETRES_PAR_DEFAUT,
    appelsAvantInjoignable: nombre(
      'suivi.appelsAvantInjoignable',
      PARAMETRES_PAR_DEFAUT.appelsAvantInjoignable,
    ),
    heuresFenetreInjoignable: nombre(
      'suivi.heuresFenetreInjoignable',
      PARAMETRES_PAR_DEFAUT.heuresFenetreInjoignable,
    ),
    minutesAnnulationRecreditee: nombre(
      'suivi.minutesAnnulationRecreditee',
      PARAMETRES_PAR_DEFAUT.minutesAnnulationRecreditee,
    ),
    heuresTraitementContestation: nombre(
      'contestation.heuresTraitementContestation',
      PARAMETRES_PAR_DEFAUT.heuresTraitementContestation,
    ),
  };
}

export interface BilanRecredits {
  readonly examinees: number;
  readonly accordes: number;
}

/**
 * Recrédite les professionnels lésés par une annulation très rapide.
 *
 * Appelée juste après l'annulation, sur la demande concernée. Un échec ici ne doit jamais
 * faire échouer l'annulation elle-même : le client a le droit d'arrêter sa demande, et un
 * problème de facturation entre Le Renom et un pro ne le regarde pas.
 */
export async function recrediteApresAnnulation(
  demandeId: string,
  annuleeLe: Date,
): Promise<BilanRecredits> {
  const regles = await parametres();

  const acceptees = await prisma.distribution.findMany({
    where: { demandeId, statut: 'acceptee', recredite: false },
    select: {
      id: true,
      entrepriseId: true,
      repondueLe: true,
      montantHT: true,
      consommeForfait: true,
    },
  });

  let accordes = 0;

  for (const distribution of acceptees) {
    if (distribution.repondueLe === null) continue;

    const minutes = (annuleeLe.getTime() - distribution.repondueLe.getTime()) / 60_000;

    // Un contact établi ferme la porte : le pro a eu ce qu'il a payé.
    const [appels, suivis, contestationExistante] = await Promise.all([
      prisma.appelSuivi.findMany({
        where: { demandeId, entrepriseId: distribution.entrepriseId },
        select: { repondu: true },
      }),
      prisma.suiviDemande.findMany({
        where: { demandeId, entrepriseId: distribution.entrepriseId },
        select: { etape: true },
      }),
      prisma.contestation.findFirst({
        where: { demandeId, entrepriseId: distribution.entrepriseId },
        select: { id: true },
      }),
    ]);

    if (contestationExistante !== null) continue;

    const contactEtabli =
      appels.some((appel) => appel.repondu) ||
      suivis.some((suivi) => suivi.etape !== 'acceptee' && suivi.etape !== 'perdue');

    const decision = instruitContestation(
      'annulation_immediate',
      {
        appelsSansReponse: appels.filter((appel) => !appel.repondu).length,
        doublonAvere: false,
        minutesAvantAnnulation: minutes,
        interventionConfirmee: suivis.some((suivi) => suivi.etape === 'travaux_realises'),
        contactEtabli,
      },
      regles,
    );

    if (decision.issue !== 'recredit-de-droit') continue;

    const recredit = calculeRecredit({
      accepteeLe: distribution.repondueLe,
      montantHT: Number(distribution.montantHT),
      consommeForfait: distribution.consommeForfait,
      dejaRecredite: false,
      dejaContestee: false,
    });

    // Rien à rendre : ni argent, ni unité de forfait. On n'ouvre pas un dossier pour rien.
    if (recredit.montantHT <= 0 && !recredit.rendAuForfait) continue;

    const mois = annuleeLe.toISOString().slice(0, 7);

    await prisma.$transaction(async (tx) => {
      const contestation = await tx.contestation.create({
        data: {
          demandeId,
          entrepriseId: distribution.entrepriseId,
          motif: 'annulation_immediate',
          explication: decision.explication,
          statut: 'acceptee',
          echeanceLe: new Date(
            annuleeLe.getTime() + regles.heuresTraitementContestation * 3_600_000,
          ),
          trancheeLe: annuleeLe,
          tranchePar: 'Le Renom (automatique)',
          motifDecision: decision.explication,
        },
        select: { id: true },
      });

      await tx.recredit.create({
        data: {
          contestationId: contestation.id,
          montantHT: recredit.montantHT,
          rendAuForfait: recredit.rendAuForfait,
          accordePar: 'Le Renom (automatique)',
        },
      });

      await tx.distribution.update({
        where: { id: distribution.id },
        data: { recredite: true },
      });

      // On rend exactement ce qui a été pris, dans le mois où il a été pris.
      const quota = await tx.quotaMensuel.findFirst({
        where: { entrepriseId: distribution.entrepriseId, mois },
        select: { id: true, demandesAcceptees: true, depenseHT: true },
      });

      if (quota !== null) {
        await tx.quotaMensuel.update({
          where: { id: quota.id },
          data: {
            ...(recredit.rendAuForfait && quota.demandesAcceptees > 0
              ? { demandesAcceptees: { decrement: 1 } }
              : {}),
            ...(recredit.montantHT > 0 ? { depenseHT: { decrement: recredit.montantHT } } : {}),
          },
        });
      }
    });

    accordes += 1;
  }

  return { examinees: acceptees.length, accordes };
}
