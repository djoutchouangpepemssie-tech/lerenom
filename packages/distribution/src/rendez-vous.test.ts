/**
 * Les relances et les rappels de rendez-vous.
 *
 * Ce que ces tests gardent :
 *
 *   * **on relance une fois, jamais deux.** Harceler quelqu'un qui ne répond pas ne le fait
 *     pas répondre ;
 *   * **on ne relance pas sur une proposition expirée** : son créneau est déjà rendu, et
 *     réveiller quelqu'un pour un horaire perdu est pire que le silence ;
 *   * **le rappel proche prime sur celui de la veille**, et aucun ne part deux fois ;
 *   * **un rendez-vous annulé ne reçoit rien.**
 *
 * Les assertions portent sur les **effets sur les lignes de ce test**, jamais sur les
 * compteurs du bilan. Ces compteurs sont globaux, et la base de démonstration contient des
 * rendez-vous confirmés dans les trente heures à venir : un bilan à `1` deviendrait `2` le
 * jour où le semis place un rendez-vous de plus dans la fenêtre. Un test qui dépend du
 * voisinage ne garde rien.
 */

import process from 'node:process';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { rappelleLesRendezVous, relanceLesPropositions } from './rendez-vous.ts';

const aUneBase = (process.env['DATABASE_URL'] ?? '') !== '';
const decrire = aUneBase ? describe : describe.skip;

const MARQUE = 'test-rappels';
const EMAIL = `${MARQUE}@exemple.test`;
const MOBILE = '0677889900';

let entrepriseId = '';
let clientId = '';

/** L'instant de référence : tout se place par rapport à lui. */
const MAINTENANT = new Date();

function dans(heures: number): Date {
  return new Date(MAINTENANT.getTime() + heures * 3_600_000);
}

/** Une proposition créée il y a `ageHeures`, pour un créneau dans `dansHeures`. */
async function proposition(ageHeures: number, dansHeures = 72): Promise<string> {
  const plage = await prisma.creneau.create({
    data: {
      entrepriseId,
      type: 'propose',
      debutLe: dans(dansHeures),
      finLe: dans(dansHeures + 1),
      propose: true,
      expireLe: dans(48 - ageHeures),
      creeLe: new Date(MAINTENANT.getTime() - ageHeures * 3_600_000),
      rendezVous: { create: { statut: 'propose', clientId } },
    },
    select: { id: true },
  });
  return plage.id;
}

/** Un rendez-vous confirmé pour dans `dansHeures`. */
async function confirme(dansHeures: number): Promise<string> {
  const plage = await prisma.creneau.create({
    data: {
      entrepriseId,
      type: 'intervention',
      debutLe: dans(dansHeures),
      finLe: dans(dansHeures + 1),
      rendezVous: { create: { statut: 'confirme', clientId, confirmeLe: MAINTENANT } },
    },
    select: { rendezVous: { select: { id: true } } },
  });
  const id = plage.rendezVous?.id;
  if (id === undefined) throw new Error('rendez-vous non créé');
  return id;
}

/** Les rappels déjà envoyés pour ce rendez-vous. */
async function rappels(id: string): Promise<{ veille: boolean; proche: boolean }> {
  const rdv = await prisma.rendezVous.findUniqueOrThrow({ where: { id } });
  return { veille: rdv.rappelVeilleLe !== null, proche: rdv.rappel2hLe !== null };
}

/** La relance déjà envoyée pour cette plage. */
async function relancee(id: string): Promise<boolean> {
  const plage = await prisma.creneau.findUniqueOrThrow({ where: { id } });
  return plage.relanceeLe !== null;
}

async function messages(modele: string): Promise<number> {
  return prisma.messageSortant.count({ where: { modele, destinataire: { in: [EMAIL, MOBILE] } } });
}

beforeAll(async () => {
  if (!aUneBase) return;
  await nettoieLesDonneesDeTest(MARQUE);
});

beforeEach(async () => {
  if (!aUneBase) return;
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.messageSortant.deleteMany({ where: { destinataire: { in: [EMAIL, MOBILE] } } });

  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} Entreprise`,
      slug: `${MARQUE}-entreprise`,
      source: 'inscription',
      clients: { create: { nom: 'Madame Dupuis', email: EMAIL, telephone: MOBILE } },
    },
    include: { clients: true },
  });
  entrepriseId = entreprise.id;
  clientId = entreprise.clients[0]?.id ?? '';
});

afterAll(async () => {
  if (!aUneBase) return;
  await prisma.messageSortant.deleteMany({ where: { destinataire: { in: [EMAIL, MOBILE] } } });
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

decrire('relanceLesPropositions', () => {
  it('relance une proposition sans réponse depuis vingt-quatre heures', async () => {
    const id = await proposition(25);
    await relanceLesPropositions(MAINTENANT);

    expect(await relancee(id)).toBe(true);
    expect(await messages('rendez-vous-relance')).toBe(2);
  });

  it('ne relance pas avant l’heure', async () => {
    const id = await proposition(12);
    await relanceLesPropositions(MAINTENANT);

    expect(await relancee(id)).toBe(false);
    expect(await messages('rendez-vous-relance')).toBe(0);
  });

  it('ne relance jamais deux fois', async () => {
    await proposition(25);
    await relanceLesPropositions(MAINTENANT);
    await relanceLesPropositions(new Date(MAINTENANT.getTime() + 3_600_000));

    // Deux messages, pas quatre : un courriel et un SMS, une seule fois.
    expect(await messages('rendez-vous-relance')).toBe(2);
  });

  it('ne relance pas sur une proposition expirée', async () => {
    // Son créneau est déjà rendu : réveiller le client pour un horaire perdu serait pire
    // que le silence.
    const id = await proposition(25);
    await prisma.creneau.update({
      where: { id },
      data: { expireLe: new Date(MAINTENANT.getTime() - 1000) },
    });
    await relanceLesPropositions(MAINTENANT);

    expect(await relancee(id)).toBe(false);
    expect(await messages('rendez-vous-relance')).toBe(0);
  });

  it('ne relance pas une proposition déjà acceptée', async () => {
    const id = await proposition(25);
    await prisma.rendezVous.updateMany({ where: { creneauId: id }, data: { statut: 'confirme' } });
    await relanceLesPropositions(MAINTENANT);

    expect(await relancee(id)).toBe(false);
    expect(await messages('rendez-vous-relance')).toBe(0);
  });

  it('envoie un lien neuf : le jeton d’origine n’a jamais été gardé en clair', async () => {
    await proposition(25);
    await relanceLesPropositions(MAINTENANT);

    const message = await prisma.messageSortant.findFirstOrThrow({
      where: { modele: 'rendez-vous-relance', canal: 'sms', destinataire: MOBILE },
    });
    expect(message.corps).toMatch(/\/suivi\/[A-Za-z0-9_-]{20,}/);
  });
});

decrire('rappelleLesRendezVous', () => {
  it('rappelle la veille', async () => {
    const id = await confirme(20);
    await rappelleLesRendezVous(MAINTENANT);

    expect(await rappels(id)).toEqual({ veille: true, proche: false });
    expect(await messages('rendez-vous-rappel-veille')).toBe(2);
  });

  it('rappelle deux heures avant', async () => {
    const id = await confirme(1.5);
    await rappelleLesRendezVous(MAINTENANT);

    expect(await rappels(id)).toEqual({ veille: false, proche: true });
    expect(await messages('rendez-vous-rappel-proche')).toBe(2);
  });

  it('ne rappelle rien trop tôt', async () => {
    const id = await confirme(72);
    await rappelleLesRendezVous(MAINTENANT);

    expect(await rappels(id)).toEqual({ veille: false, proche: false });
    expect(await messages('rendez-vous-rappel-veille')).toBe(0);
  });

  it('n’envoie pas deux fois le même rappel', async () => {
    await confirme(20);
    await rappelleLesRendezVous(MAINTENANT);
    await rappelleLesRendezVous(new Date(MAINTENANT.getTime() + 3_600_000));

    expect(await messages('rendez-vous-rappel-veille')).toBe(2);
  });

  it('envoie quand même le rappel proche après celui de la veille', async () => {
    const id = await confirme(1.5);
    await prisma.rendezVous.update({ where: { id }, data: { rappelVeilleLe: MAINTENANT } });
    await rappelleLesRendezVous(MAINTENANT);

    expect((await rappels(id)).proche).toBe(true);
    expect(await messages('rendez-vous-rappel-proche')).toBe(2);
  });

  it('ne rappelle rien pour un rendez-vous annulé', async () => {
    const id = await confirme(20);
    const rdv = await prisma.rendezVous.findUniqueOrThrow({ where: { id } });
    await prisma.creneau.update({ where: { id: rdv.creneauId }, data: { annuleLe: MAINTENANT } });
    await rappelleLesRendezVous(MAINTENANT);

    expect(await rappels(id)).toEqual({ veille: false, proche: false });
    expect(await messages('rendez-vous-rappel-veille')).toBe(0);
  });

  it('ne rappelle rien pour un rendez-vous non confirmé', async () => {
    const id = await confirme(20);
    await prisma.rendezVous.update({ where: { id }, data: { statut: 'propose' } });
    await rappelleLesRendezVous(MAINTENANT);

    expect(await rappels(id)).toEqual({ veille: false, proche: false });
  });

  it('ne rappelle rien pour un rendez-vous passé', async () => {
    const id = await confirme(-2);
    await rappelleLesRendezVous(MAINTENANT);

    expect(await rappels(id)).toEqual({ veille: false, proche: false });
  });
});
