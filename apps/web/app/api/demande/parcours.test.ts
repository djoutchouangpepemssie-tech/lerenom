/**
 * Le parcours complet d'une demande, de son dépôt au départ de la cascade.
 *
 * Ce test est d'intégration : vraie base, vrai Redis, vrais gestionnaires de route. Il vérifie
 * la seule chose que les tests unitaires ne peuvent pas prouver — que la barrière tient de bout
 * en bout : rien ne part avant la vérification du mobile, et tout part juste après.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@lerenom/db';
import { fermeFiles, fileCascade } from '@lerenom/files';
import { TENTATIVES_MAX } from '@lerenom/core';
import { POST as deposeDemande } from './route';
import { POST as verifie, PUT as renvoieCode } from './verification/route';

const TELEPHONE = '0612000042';
const CONSENTEMENT =
  "J'accepte que mes coordonnées soient transmises à trois professionnels au maximum.";

let prestationSlug: string;
let communeCode: string;

/** Lit le dernier code envoyé à notre numéro de test, tel qu'il part réellement par SMS. */
async function dernierCodeEnvoye(): Promise<string> {
  const message = await prisma.messageSortant.findFirst({
    where: { destinataire: { contains: '612000042' }, modele: 'verification-demande' },
    orderBy: { creeLe: 'desc' },
    select: { corps: true },
  });
  expect(message).not.toBeNull();
  const trouve = /est (\d{6})\./.exec(message?.corps ?? '');
  expect(trouve, `aucun code dans « ${message?.corps ?? ''} »`).not.toBeNull();
  return trouve?.[1] ?? '';
}

function requete(corps: unknown): Request {
  return new Request('http://localhost/api/demande', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });
}

async function depose(): Promise<{ reference: string }> {
  const reponse = await deposeDemande(
    requete({
      prestationSlug,
      communeCode,
      description: "Le robinet de la cuisine fuit depuis ce matin, l'eau coule en continu.",
      urgence: 'normale',
      clientPrenom: 'Camille',
      clientEmail: 'camille.test@exemple.fr',
      clientTelephone: TELEPHONE,
      consentementTexte: CONSENTEMENT,
    }),
  );
  expect(reponse.status).toBe(200);
  const corps = (await reponse.json()) as { reference: string; statut: string };
  expect(corps.statut).toBe('brouillon');
  return corps;
}

async function nettoie(): Promise<void> {
  const demandes = await prisma.demande.findMany({
    where: { clientTelephone: { contains: '612000042' } },
    select: { id: true },
  });
  const ids = demandes.map((demande) => demande.id);
  if (ids.length > 0) {
    await prisma.distribution.deleteMany({ where: { demandeId: { in: ids } } });
    await prisma.demande.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.messageSortant.deleteMany({ where: { destinataire: { contains: '612000042' } } });
  await fileCascade().drain(true);
}

beforeAll(async () => {
  process.env['SECRET_VERIFICATION'] ??= 'secret-de-test-strictement-local-et-assez-long';

  // Une ville ouverte et une prestation réelles : le test ne doit rien inventer du catalogue.
  const commune = await prisma.commune.findFirst({
    where: { statut: 'ouvert' },
    select: { code: true },
  });
  const prestation = await prisma.prestation.findFirst({
    where: { metier: { slug: 'serrurier' } },
    select: { slug: true },
  });
  expect(commune, 'aucune commune ouverte en base : lancer le semis').not.toBeNull();
  expect(prestation, 'aucune prestation de serrurier en base : lancer le semis').not.toBeNull();
  communeCode = commune?.code ?? '';
  prestationSlug = prestation?.slug ?? '';

  await nettoie();
});

afterEach(nettoie);

afterAll(async () => {
  await fermeFiles();
  await prisma.$disconnect();
});

describe('dépôt de la demande', () => {
  it('laisse la demande en brouillon et ne programme aucune cascade', async () => {
    const { reference } = await depose();

    const demande = await prisma.demande.findUniqueOrThrow({
      where: { reference },
      select: { statut: true, telephoneVerifieLe: true, codeVerificationHash: true },
    });

    expect(demande.statut).toBe('brouillon');
    expect(demande.telephoneVerifieLe).toBeNull();
    // Le code est en base, mais haché : jamais en clair.
    expect(demande.codeVerificationHash).not.toBeNull();
    expect(demande.codeVerificationHash).not.toContain(await dernierCodeEnvoye());

    expect(await fileCascade().getJobCountByTypes('waiting', 'delayed', 'active')).toBe(0);
  });

  it('normalise le mobile et refuse le doublon de la semaine', async () => {
    await depose();
    const seconde = await deposeDemande(
      requete({
        prestationSlug,
        communeCode,
        description: 'Même fuite, même semaine : la demande ne doit pas repartir deux fois.',
        urgence: 'normale',
        clientPrenom: 'Camille',
        clientEmail: 'camille.test@exemple.fr',
        clientTelephone: '+33 6 12 00 00 42',
        consentementTexte: CONSENTEMENT,
      }),
    );
    expect(seconde.status).toBe(409);
  });
});

describe('vérification du mobile', () => {
  it('ouvre la distribution et programme la cascade avec le bon code', async () => {
    const { reference } = await depose();
    const code = await dernierCodeEnvoye();

    const reponse = await verifie(requete({ reference, code }));
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ statut: 'en_distribution', villeOuverte: true });

    const demande = await prisma.demande.findUniqueOrThrow({
      where: { reference },
      select: { statut: true, telephoneVerifieLe: true, codeVerificationHash: true },
    });
    expect(demande.statut).toBe('en_distribution');
    expect(demande.telephoneVerifieLe).not.toBeNull();
    // Le code a servi : il est effacé, il ne resservira pas.
    expect(demande.codeVerificationHash).toBeNull();

    const taches = await fileCascade().getJobs(['waiting', 'delayed', 'active']);
    expect(taches).toHaveLength(1);
    const demandeEnBase = await prisma.demande.findUniqueOrThrow({
      where: { reference },
      select: { id: true },
    });
    expect(taches[0]?.data).toEqual({ demandeId: demandeEnBase.id });
  });

  it('compte les tentatives, puis bloque et exige un nouveau code', async () => {
    const { reference } = await depose();
    const vrai = await dernierCodeEnvoye();
    const faux = vrai === '000000' ? '111111' : '000000';

    for (let essai = 1; essai <= TENTATIVES_MAX; essai += 1) {
      const reponse = await verifie(requete({ reference, code: faux }));
      expect(reponse.status).toBe(400);
      expect(await reponse.json()).toEqual({
        erreur: 'Ce code ne correspond pas.',
        tentativesRestantes: TENTATIVES_MAX - essai,
      });
    }

    // Même le bon code ne passe plus : la limite protège le numéro, pas le code.
    const bloquee = await verifie(requete({ reference, code: vrai }));
    expect(bloquee.status).toBe(429);
    expect(await fileCascade().getJobCountByTypes('waiting', 'delayed', 'active')).toBe(0);

    // Le renvoi remet le compteur à zéro, et le nouveau code fonctionne.
    const renvoi = await renvoieCode(requete({ reference }));
    expect(renvoi.status).toBe(200);
    const nouveau = await dernierCodeEnvoye();
    expect(nouveau).not.toBe(vrai);

    const reussie = await verifie(requete({ reference, code: nouveau }));
    expect(reussie.status).toBe(200);
    expect(await fileCascade().getJobCountByTypes('waiting', 'delayed', 'active')).toBe(1);
  });

  it('rend le code précédent inutilisable après un renvoi', async () => {
    const { reference } = await depose();
    const premier = await dernierCodeEnvoye();

    await renvoieCode(requete({ reference }));
    const second = await dernierCodeEnvoye();
    expect(second).not.toBe(premier);

    const reponse = await verifie(requete({ reference, code: premier }));
    expect(reponse.status).toBe(400);
  });

  it('refuse une référence inconnue sans dire si elle existe', async () => {
    const reponse = await verifie(requete({ reference: 'DEM-2026-000000', code: '123456' }));
    expect(reponse.status).toBe(404);
    expect(await reponse.json()).toEqual({
      erreur: 'Cette demande est introuvable ou déjà traitée.',
    });
  });

  it('refuse un code mal formé sans le compter comme une tentative', async () => {
    const { reference } = await depose();

    const reponse = await verifie(requete({ reference, code: '12a4' }));
    expect(reponse.status).toBe(400);

    const demande = await prisma.demande.findUniqueOrThrow({
      where: { reference },
      select: { tentativesVerification: true },
    });
    expect(demande.tentativesVerification).toBe(0);
  });

  it('reste idempotent : vérifier deux fois ne relance pas la cascade', async () => {
    const { reference } = await depose();
    const code = await dernierCodeEnvoye();

    await verifie(requete({ reference, code }));
    const seconde = await verifie(requete({ reference, code }));

    expect(seconde.status).toBe(200);
    expect(await seconde.json()).toEqual({ statut: 'en_distribution', dejaVerifie: true });
    expect(await fileCascade().getJobCountByTypes('waiting', 'delayed', 'active')).toBe(1);
  });
});
