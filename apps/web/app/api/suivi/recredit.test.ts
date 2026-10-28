/**
 * Le recrédit automatique quand un client annule juste après une acceptation.
 *
 * Ce que ce test protège, c'est l'équité d'un côté et la rigueur de l'autre : un pro qui n'a
 * pas eu le temps d'appeler récupère ce qu'il a payé, un pro qui a déjà joint le client ne
 * récupère rien, et tout passe par une contestation tracée — un recrédit sans trace serait un
 * recrédit invérifiable.
 */

import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { creeLien } from '@lerenom/liens';
import { POST as agit } from './[jeton]/route';

const MARQUE = 'test-recredit';
const MINUTE = 60_000;

let metierId = '';
let proForfaitId = '';
let proFactureId = '';
const dossiers: string[] = [];

function requete(jeton: string, corps: unknown): [Request, { params: Promise<{ jeton: string }> }] {
  return [
    new Request(`http://localhost/api/suivi/${jeton}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps),
    }),
    { params: Promise.resolve({ jeton }) },
  ];
}

/**
 * Un dossier complet : une demande acceptée il y a `minutes`, par un pro facturé ou au forfait.
 * Rend le jeton de suivi du client.
 */
async function dossier(options: {
  readonly minutes: number;
  readonly surForfait: boolean;
  readonly appelRepondu?: boolean;
  readonly etape?: 'rendez_vous' | 'travaux_realises';
}): Promise<{ jeton: string; demandeId: string; entrepriseId: string }> {
  const entrepriseId = options.surForfait ? proForfaitId : proFactureId;

  const demande = await prisma.demande.create({
    data: {
      reference: `${MARQUE}-${dossiers.length}-${Date.now()}`,
      type: 'partagee',
      statut: 'en_distribution',
      metierId,
      communeId: '75111',
      description: 'Dossier de test pour le recrédit.',
      urgence: 'normale',
      clientPrenom: 'Camille',
      clientEmail: 'camille@exemple.test',
      clientTelephone: '+33699999993',
      telephoneVerifieLe: new Date(),
      consentementTexte: 'Consentement de test.',
      consentementDonneLe: new Date(),
      objectifPros: 3,
    },
    select: { id: true },
  });
  dossiers.push(demande.id);

  await prisma.distribution.create({
    data: {
      demandeId: demande.id,
      entrepriseId,
      rang: 1,
      tour: 1,
      raisonRang: 'score_et_proximite',
      statut: 'acceptee',
      echeanceLe: new Date(Date.now() + 3_600_000),
      repondueLe: new Date(Date.now() - options.minutes * MINUTE),
      montantHT: options.surForfait ? 0 : 12,
      consommeForfait: options.surForfait,
    },
  });

  if (options.appelRepondu === true) {
    await prisma.appelSuivi.create({
      data: { demandeId: demande.id, entrepriseId, repondu: true },
    });
  }
  if (options.etape !== undefined) {
    await prisma.suiviDemande.create({
      data: { demandeId: demande.id, entrepriseId, etape: options.etape },
    });
  }

  const jeton = (await creeLien(demande.id, 'voir_pros')).jeton;
  return { jeton, demandeId: demande.id, entrepriseId };
}

async function recreditsDe(demandeId: string) {
  return prisma.contestation.findMany({
    where: { demandeId },
    select: { motif: true, statut: true, tranchePar: true, recredit: true },
  });
}

beforeAll(async () => {
  process.env['SECRET_VERIFICATION'] ??= 'secret-de-test-strictement-local-et-assez-long';
  await nettoieLesDonneesDeTest(MARQUE);

  const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });
  metierId = metier.id;

  for (const [cle, cible] of [
    ['forfait', 'proForfait'],
    ['facture', 'proFacture'],
  ] as const) {
    const entreprise = await prisma.entreprise.create({
      data: {
        nom: `${MARQUE} ${cle}`,
        slug: `${MARQUE}-${cle}`,
        source: 'manuelle',
        agences: { create: { adresse: '6 rue du test', codePostal: '75011', communeId: '75111' } },
      },
      select: { id: true },
    });
    if (cible === 'proForfait') proForfaitId = entreprise.id;
    else proFactureId = entreprise.id;
  }
});

afterEach(async () => {
  await prisma.quotaMensuel.deleteMany({
    where: { entrepriseId: { in: [proForfaitId, proFactureId] } },
  });
});

afterAll(async () => {
  await prisma.recredit.deleteMany({
    where: { contestation: { demandeId: { in: dossiers } } },
  });
  await prisma.contestation.deleteMany({ where: { demandeId: { in: dossiers } } });
  await prisma.appelSuivi.deleteMany({ where: { demandeId: { in: dossiers } } });
  await prisma.suiviDemande.deleteMany({ where: { demandeId: { in: dossiers } } });
  await prisma.lienAction.deleteMany({ where: { demandeId: { in: dossiers } } });
  await prisma.distribution.deleteMany({ where: { demandeId: { in: dossiers } } });
  await prisma.demande.deleteMany({ where: { id: { in: dossiers } } });
  await prisma.quotaMensuel.deleteMany({
    where: { entrepriseId: { in: [proForfaitId, proFactureId] } },
  });
  await prisma.entreprise.deleteMany({ where: { id: { in: [proForfaitId, proFactureId] } } });
  await prisma.$disconnect();
});

describe('annulation dans l’heure, avant tout contact', () => {
  it('rend l’argent au pro facturé, et le trace', async () => {
    const mois = new Date().toISOString().slice(0, 7);
    const { jeton, demandeId } = await dossier({ minutes: 10, surForfait: false });
    await prisma.quotaMensuel.create({
      data: {
        entrepriseId: proFactureId,
        mois,
        formule: 'premium',
        demandesIncluses: 5,
        demandesAcceptees: 5,
        depenseHT: 12,
      },
    });

    const reponse = await agit(...requete(jeton, { action: 'annuler' }));
    expect(reponse.status).toBe(200);

    const contestations = await recreditsDe(demandeId);
    expect(contestations).toHaveLength(1);
    expect(contestations[0]?.motif).toBe('annulation_immediate');
    expect(contestations[0]?.statut).toBe('acceptee');
    expect(contestations[0]?.tranchePar).toBe('Le Renom (automatique)');
    expect(Number(contestations[0]?.recredit?.montantHT)).toBe(12);
    expect(contestations[0]?.recredit?.rendAuForfait).toBe(false);

    // La dépense du mois est ramenée à zéro, et le forfait n'est pas touché : on rend ce qui
    // a été pris, pas autre chose.
    const quota = await prisma.quotaMensuel.findFirstOrThrow({
      where: { entrepriseId: proFactureId, mois },
    });
    expect(Number(quota.depenseHT)).toBe(0);
    expect(quota.demandesAcceptees).toBe(5);
  });

  it('rend l’unité de forfait au pro qui l’avait consommée', async () => {
    const mois = new Date().toISOString().slice(0, 7);
    const { jeton, demandeId } = await dossier({ minutes: 5, surForfait: true });
    await prisma.quotaMensuel.create({
      data: {
        entrepriseId: proForfaitId,
        mois,
        formule: 'premium',
        demandesIncluses: 5,
        demandesAcceptees: 3,
      },
    });

    await agit(...requete(jeton, { action: 'annuler' }));

    const contestations = await recreditsDe(demandeId);
    expect(contestations[0]?.recredit?.rendAuForfait).toBe(true);
    expect(Number(contestations[0]?.recredit?.montantHT)).toBe(0);

    const quota = await prisma.quotaMensuel.findFirstOrThrow({
      where: { entrepriseId: proForfaitId, mois },
    });
    expect(quota.demandesAcceptees).toBe(2);
  });

  it('marque la distribution recréditée, pour qu’elle ne le soit pas deux fois', async () => {
    const { jeton, demandeId } = await dossier({ minutes: 3, surForfait: false });
    await agit(...requete(jeton, { action: 'annuler' }));

    const distribution = await prisma.distribution.findFirstOrThrow({ where: { demandeId } });
    expect(distribution.recredite).toBe(true);
  });
});

describe('ce qui n’ouvre pas droit à recrédit', () => {
  it('ne rend rien quand le pro a déjà joint le client', async () => {
    const { jeton, demandeId } = await dossier({
      minutes: 5,
      surForfait: false,
      appelRepondu: true,
    });
    await agit(...requete(jeton, { action: 'annuler' }));
    expect(await recreditsDe(demandeId)).toHaveLength(0);
  });

  it('ne rend rien quand un rendez-vous était déjà pris', async () => {
    const { jeton, demandeId } = await dossier({
      minutes: 5,
      surForfait: false,
      etape: 'rendez_vous',
    });
    await agit(...requete(jeton, { action: 'annuler' }));
    expect(await recreditsDe(demandeId)).toHaveLength(0);
  });

  it('ne rend rien au-delà du délai : le pro a eu le temps d’appeler', async () => {
    const { jeton, demandeId } = await dossier({ minutes: 180, surForfait: false });
    await agit(...requete(jeton, { action: 'annuler' }));
    expect(await recreditsDe(demandeId)).toHaveLength(0);
  });

  it('n’annule pas l’annulation si le recrédit échoue : le client reste prioritaire', async () => {
    const { jeton, demandeId } = await dossier({ minutes: 5, surForfait: false });
    const reponse = await agit(...requete(jeton, { action: 'annuler' }));
    expect(reponse.status).toBe(200);

    const demande = await prisma.demande.findUniqueOrThrow({
      where: { id: demandeId },
      select: { statut: true, annuleeLe: true },
    });
    expect(demande.statut).toBe('annulee');
    expect(demande.annuleeLe).not.toBeNull();
  });
});
