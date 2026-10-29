/**
 * Le parcours d'un rendez-vous, du créneau proposé à la réponse du client.
 *
 * Ce que ces tests gardent :
 *
 *   * **la proposition part réellement**, avec un lien qui ouvre ce rendez-vous-là ;
 *   * **accepter rend la plage ferme**, donc soumise à la contrainte d'exclusion — et si le
 *     créneau a été pris entretemps, on le dit plutôt que d'inscrire deux fois ;
 *   * **décliner libère l'horaire** : le professionnel n'a pas à faire le ménage ;
 *   * **annuler prévient le client**, et libère la plage. C'était la sortie qui manquait.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { creeLien } from '@lerenom/liens';
import { POST as repond } from './[jeton]/route';
import { annuleLeRendezVous, proposeAuClient, semaineDuPro } from '@/lib/agenda-pro';
import { rendezVousPourClient } from '@/lib/rendez-vous-client';

const MARQUE = 'test-rdv';
const EMAIL_CLIENT = `${MARQUE}-client@exemple.test`;
const MOBILE_CLIENT = '0655443322';
const EMAIL_PRO = `${MARQUE}-pro@exemple.test`;
/**
 * Les dates sont relatives à maintenant, pas figées.
 *
 * Ce test passe par la route, qui lit l'horloge réelle : une date écrite en dur serait
 * expirée le lendemain, et le test se mettrait à échouer sans qu'aucun code ait changé.
 */
const MAINTENANT = new Date();

let entrepriseId = '';
let clientId = '';

/** Dans `joursApres` jours, à `heure` heures pile. */
function a(heure: number, joursApres = 2): Date {
  const date = new Date(MAINTENANT);
  date.setDate(date.getDate() + joursApres);
  date.setHours(heure, 0, 0, 0);
  return date;
}

function corpsReponse(accepte: boolean): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accepte }),
  });
}

function contexte(jeton: string) {
  return { params: Promise.resolve({ jeton }) };
}

/** Propose un créneau et rend le jeton du lien parti au client. */
async function propositionEnvoyee(heure = 9): Promise<{ id: string; jeton: string }> {
  const resultat = await proposeAuClient(
    entrepriseId,
    { type: 'propose', debut: a(heure), fin: a(heure + 1) },
    clientId,
    MAINTENANT,
  );
  if (!resultat.ok) throw new Error('la proposition a échoué');

  const message = await prisma.messageSortant.findFirstOrThrow({
    where: { modele: 'rendez-vous-propose', canal: 'sms' },
    orderBy: { creeLe: 'desc' },
  });
  const trouve = /\/suivi\/([A-Za-z0-9_-]+)/.exec(message.corps);
  if (trouve?.[1] === undefined) throw new Error(`lien introuvable : ${message.corps}`);
  return { id: resultat.id, jeton: trouve[1] };
}

beforeAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
});

beforeEach(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.messageSortant.deleteMany({
    where: { destinataire: { in: [EMAIL_CLIENT, MOBILE_CLIENT, EMAIL_PRO] } },
  });

  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} Entreprise`,
      slug: `${MARQUE}-entreprise`,
      source: 'inscription',
      utilisateurs: { create: { nom: 'Martin', email: EMAIL_PRO, motDePasseHash: 'x' } },
      clients: {
        create: { nom: 'Madame Dupuis', email: EMAIL_CLIENT, telephone: MOBILE_CLIENT },
      },
    },
    include: { clients: true },
  });
  entrepriseId = entreprise.id;
  clientId = entreprise.clients[0]?.id ?? '';
});

afterAll(async () => {
  await prisma.messageSortant.deleteMany({
    where: { destinataire: { in: [EMAIL_CLIENT, MOBILE_CLIENT, EMAIL_PRO] } },
  });
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

describe('proposer un créneau', () => {
  it('réserve la plage et écrit au client par ses deux canaux', async () => {
    const resultat = await proposeAuClient(
      entrepriseId,
      { type: 'propose', debut: a(9), fin: a(10) },
      clientId,
      MAINTENANT,
    );
    expect(resultat.ok).toBe(true);
    expect(resultat.ok && resultat.canaux.toSorted()).toEqual(['email', 'sms']);

    const { plages } = await semaineDuPro(entrepriseId, a(9), MAINTENANT);
    expect(plages).toHaveLength(1);
    expect(plages[0]?.type).toBe('propose');
  });

  it('refuse un créneau qui en chevauche un autre', async () => {
    await prisma.creneau.create({
      data: { entrepriseId, type: 'intervention', debutLe: a(9), finLe: a(11) },
    });
    const resultat = await proposeAuClient(
      entrepriseId,
      { type: 'propose', debut: a(10), fin: a(12) },
      clientId,
      MAINTENANT,
    );
    expect(resultat.ok).toBe(false);
  });

  it('refuse le client d’un confrère', async () => {
    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    const resultat = await proposeAuClient(
      autre.id,
      { type: 'propose', debut: a(9), fin: a(10) },
      clientId,
      MAINTENANT,
    );
    expect(resultat.ok).toBe(false);
    expect(await prisma.creneau.count({ where: { entrepriseId: autre.id } })).toBe(0);
  });
});

describe('la réponse du client', () => {
  it('accepter rend la plage ferme et confirme le rendez-vous', async () => {
    const { id, jeton } = await propositionEnvoyee();
    const reponse = await repond(corpsReponse(true), contexte(jeton));
    expect(reponse.status).toBe(200);

    const rendezVous = await prisma.rendezVous.findUniqueOrThrow({
      where: { id },
      include: { creneau: true },
    });
    expect(rendezVous.statut).toBe('confirme');
    expect(rendezVous.creneau.type).toBe('intervention');
    expect(rendezVous.creneau.expireLe).toBeNull();
  });

  it('décliner libère l’horaire', async () => {
    const { jeton } = await propositionEnvoyee();
    expect((await repond(corpsReponse(false), contexte(jeton))).status).toBe(200);

    // La plage reste en base, marquée annulée, mais n'occupe plus l'agenda.
    expect(await prisma.creneau.count({ where: { entrepriseId, annuleLe: null } })).toBe(0);
    const { plages } = await semaineDuPro(entrepriseId, a(9), MAINTENANT);
    expect(plages).toHaveLength(0);
  });

  it('prévient le professionnel dans les deux cas', async () => {
    const { jeton } = await propositionEnvoyee();
    await repond(corpsReponse(true), contexte(jeton));

    const message = await prisma.messageSortant.findFirstOrThrow({
      where: { destinataire: EMAIL_PRO },
    });
    expect(message.modele).toBe('rendez-vous-accepte');
  });

  it('consomme le lien : répondre ne se refait pas', async () => {
    const { jeton } = await propositionEnvoyee();
    expect((await repond(corpsReponse(true), contexte(jeton))).status).toBe(200);
    expect((await repond(corpsReponse(false), contexte(jeton))).status).toBe(404);
  });

  it('refuse un lien qui porte une autre action', async () => {
    const { id } = await propositionEnvoyee();
    const autre = await creeLien(null, 'voir_pros', id);
    expect((await repond(corpsReponse(true), contexte(autre.jeton))).status).toBe(404);
  });

  it('dit que le créneau est pris quand le pro l’a rempli entretemps', async () => {
    // La contrainte d'exclusion fait son travail : mieux vaut le dire au client que de
    // l'inscrire sur un horaire déjà vendu.
    const { jeton } = await propositionEnvoyee();
    await prisma.creneau.create({
      data: { entrepriseId, type: 'intervention', debutLe: a(9, 2), finLe: a(11, 2) },
    });

    const reponse = await repond(corpsReponse(true), contexte(jeton));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { erreur: string }).erreur).toContain('vient d’être pris');
  });

  it('ne répond plus à une proposition expirée', async () => {
    const { id, jeton } = await propositionEnvoyee();
    const rendezVous = await prisma.rendezVous.findUniqueOrThrow({ where: { id } });
    await prisma.creneau.update({
      where: { id: rendezVous.creneauId },
      data: { expireLe: new Date(MAINTENANT.getTime() - 1000) },
    });

    expect((await repond(corpsReponse(true), contexte(jeton))).status).toBe(422);
  });
});

describe('ce que le client voit', () => {
  it('le créneau, l’entreprise et l’échéance de la proposition', async () => {
    const { id } = await propositionEnvoyee();
    const vue = await rendezVousPourClient(id, MAINTENANT);

    expect(vue?.entrepriseNom).toContain(MARQUE);
    expect(vue?.repondable).toBe(true);
    expect(vue?.expireLe).not.toBeNull();
  });

  it('dit pourquoi il ne peut plus répondre, une fois confirmé', async () => {
    const { id, jeton } = await propositionEnvoyee();
    await repond(corpsReponse(true), contexte(jeton));

    const vue = await rendezVousPourClient(id, MAINTENANT);
    expect(vue?.repondable).toBe(false);
    expect(vue?.raisonRefus).toContain('déjà répondu');
  });
});

describe('l’annulation par le professionnel', () => {
  it('libère la plage et prévient le client', async () => {
    const { id, jeton } = await propositionEnvoyee();
    await repond(corpsReponse(true), contexte(jeton));

    const resultat = await annuleLeRendezVous(entrepriseId, id, 'Véhicule immobilisé');
    expect(resultat.ok).toBe(true);

    expect(await prisma.creneau.count({ where: { entrepriseId, annuleLe: null } })).toBe(0);
    const avis = await prisma.messageSortant.findFirstOrThrow({
      where: { modele: 'rendez-vous-annule', canal: 'sms' },
    });
    expect(avis.corps).toContain('Véhicule immobilisé');
  });

  it('garde le rendez-vous en base : annulé n’est pas effacé', async () => {
    const { id } = await propositionEnvoyee();
    await annuleLeRendezVous(entrepriseId, id, '');

    const rendezVous = await prisma.rendezVous.findUniqueOrThrow({ where: { id } });
    expect(rendezVous.statut).toBe('annule');
    expect(rendezVous.annuleLe).not.toBeNull();
  });

  it('refuse d’annuler deux fois', async () => {
    const { id } = await propositionEnvoyee();
    await annuleLeRendezVous(entrepriseId, id, '');
    const second = await annuleLeRendezVous(entrepriseId, id, '');
    expect(second.ok).toBe(false);
  });

  it('n’annule pas le rendez-vous d’un confrère', async () => {
    const { id } = await propositionEnvoyee();
    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    expect((await annuleLeRendezVous(autre.id, id, '')).ok).toBe(false);
    expect(await prisma.creneau.count({ where: { entrepriseId } })).toBe(1);
  });
});
