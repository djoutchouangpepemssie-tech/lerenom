/**
 * Le recalcul nocturne des scores de qualité.
 *
 * Le score n'est jamais calculé au moment d'afficher une page : il est recalculé chaque nuit et
 * stocké, composante par composante, pour que le back-office puisse expliquer une variation à
 * un professionnel qui la conteste.
 */

import { prisma } from '@lerenom/db';
import {
  composanteAvis,
  composanteFraicheur,
  composanteReactivite,
  scoreQualite,
} from '@lerenom/core';
import { parametresEnVigueur } from './parametres.ts';

export async function recalculeScores(): Promise<number> {
  const parametres = await parametresEnVigueur();
  const jour = new Date().toISOString().slice(0, 10);
  const ilYa90Jours = new Date(Date.now() - 90 * 24 * 3_600_000);

  // La note moyenne du métier est le C de la moyenne bayésienne : sans elle, une entreprise
  // sans avis serait comparée à une moyenne arbitraire.
  const metiers = await prisma.metier.findMany({ select: { id: true, noteMoyenne: true } });
  const notesMetier = new Map(metiers.map((m) => [m.id, m.noteMoyenne]));

  const entreprises = await prisma.entreprise.findMany({
    where: { suspendue: false, retireeLe: null },
    include: {
      fiche: { select: { completude: true, modifieLe: true } },
      metiers: { where: { principal: true }, take: 1 },
      distributions: {
        where: { envoyeeLe: { gte: ilYa90Jours } },
        select: { statut: true, envoyeeLe: true, repondueLe: true },
      },
    },
  });

  let calcules = 0;

  for (const entreprise of entreprises) {
    const recues = entreprise.distributions.length;
    const repondues = entreprise.distributions.filter((d) => d.repondueLe !== null);
    const tauxReponse = recues === 0 ? 1 : repondues.length / recues;

    const delais = repondues.map(
      (d) => ((d.repondueLe?.getTime() ?? 0) - d.envoyeeLe.getTime()) / 60_000,
    );
    const delaiMoyen =
      delais.length === 0 ? 0 : delais.reduce((somme, d) => somme + d, 0) / delais.length;

    const joursDepuisMaj =
      entreprise.fiche === null
        ? 365
        : (Date.now() - entreprise.fiche.modifieLe.getTime()) / 86_400_000;

    const metierPrincipal = entreprise.metiers[0]?.metierId;
    const noteMetier =
      (metierPrincipal === undefined ? null : notesMetier.get(metierPrincipal)) ??
      parametres.noteMoyenneParDefaut;

    const composantes = {
      avis: composanteAvis(
        entreprise.nombreAvis,
        entreprise.noteMoyenne ?? noteMetier,
        noteMetier,
        parametres.avisDeReference,
      ),
      // L'activité : avoir reçu et traité des demandes récemment. Dix sur 90 jours vaut 1.
      activite: Math.min(1, recues / 10),
      // La pertinence dépend du besoin : à l'échelle de l'entreprise, elle vaut la complétude
      // de sa fiche, qui conditionne sa capacité à correspondre à une demande précise.
      pertinence: entreprise.fiche?.completude ?? 0,
      reactivite: composanteReactivite(tauxReponse, delaiMoyen),
      fraicheur: composanteFraicheur(joursDepuisMaj),
    };

    const score = scoreQualite(composantes, parametres.poidsScore);

    await prisma.scoreQualite.upsert({
      where: { entrepriseId_jour: { entrepriseId: entreprise.id, jour } },
      update: { ...composantes, score },
      create: { entrepriseId: entreprise.id, jour, ...composantes, score },
    });

    await prisma.entreprise.update({
      where: { id: entreprise.id },
      data: {
        delaiReponseMinutes: delais.length === 0 ? null : Math.round(delaiMoyen),
      },
    });

    calcules += 1;
  }

  return calcules;
}

/** Clôt les demandes qui ont dépassé leur fraîcheur : une demande périmée ne se revend pas. */
export async function perimeLesDemandes(): Promise<number> {
  const parametres = await parametresEnVigueur();
  const limite = new Date(Date.now() - parametres.heuresFraicheurDemande * 3_600_000);

  const { count } = await prisma.demande.updateMany({
    where: {
      deposeeLe: { lt: limite },
      statut: { in: ['en_distribution', 'en_attente_de_relance', 'brouillon'] },
    },
    data: { statut: 'perimee', perimeeLe: new Date() },
  });

  return count;
}
