/**
 * Les coordonnées bancaires d'un professionnel.
 *
 * C'est le compte sur lequel ses clients virent l'argent, donc la cible d'une fraude banale :
 * prendre la main sur un espace professionnel pour y détourner les encaissements. Ce que ces
 * tests gardent découle entièrement de là.
 *
 *   * **Le code part au numéro déjà enregistré**, pas à un numéro fourni dans la requête —
 *     sans quoi la confirmation ne prouverait rien.
 *   * **Tant que le code n'est pas saisi, l'ancien compte reste actif.** Un attaquant qui
 *     n'aboutit pas ne doit même pas pouvoir couper les encaissements de sa victime.
 *   * **Un RIB ne se supprime pas** : les factures émises le désignent, figé à l'émission.
 *   * **Un seul compte actif**, et la base le tient par un index partiel.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { TENTATIVES_MAX } from '@lerenom/core';
import { empreinteCode } from '@lerenom/securite';
import { POST as saisit } from './rib/route';
import { POST as confirme } from './rib/[id]/confirmation/route';
import { etatBancaire } from '@/lib/rib-pro';

const MARQUE = 'test-rib';
const IBAN = 'FR7630001007941234567890185';
const AUTRE_IBAN = 'FR7630004000031234567890143';
const MOBILE = '0612345678';
const SECRET = process.env['SECRET_VERIFICATION'] ?? '';

let entrepriseId = '';

const session = vi.hoisted(() => ({ courante: null as null | { entrepriseId: string } }));

vi.mock('@/lib/session-pro', () => ({
  proConnecte: () =>
    Promise.resolve(
      session.courante === null
        ? null
        : {
            utilisateurId: 'u',
            entrepriseId: session.courante.entrepriseId,
            nom: 'Test',
            email: 'test@exemple.test',
            entreprise: 'Test',
            sessionId: 's',
          },
    ),
  ouvreSession: () => Promise.resolve(),
  fermeSession: () => Promise.resolve(),
}));

function contexte(id: string) {
  return { params: Promise.resolve({ id }) };
}

function saisieRib(modifications: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/pro/rib', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      titulaire: 'Plomberie Martin',
      iban: IBAN,
      bic: 'BNPAFRPP',
      banque: 'Banque fictive',
      ...modifications,
    }),
  });
}

function saisieCode(code: string): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

/**
 * Le code envoyé, lu depuis le SMS en file.
 *
 * Le code n'est stocké que haché : le lire dans le message est le seul moyen honnête de le
 * connaître — et c'est exactement ce que fait le professionnel.
 */
async function codeEnvoye(): Promise<string> {
  const message = await prisma.messageSortant.findFirstOrThrow({
    where: { modele: 'rib-confirmation', destinataire: MOBILE },
    orderBy: { creeLe: 'desc' },
  });
  const trouve = /code (\d{6})/.exec(message.corps);
  if (trouve?.[1] === undefined) throw new Error(`code introuvable dans : ${message.corps}`);
  return trouve[1];
}

/** Enregistre un compte et le confirme : l'état de départ de la plupart des scénarios. */
async function compteActif(iban = IBAN): Promise<string> {
  const reponse = await saisit(saisieRib({ iban }));
  expect(reponse.status).toBe(200);
  const { ribId } = (await reponse.json()) as { ribId: string };
  expect((await confirme(saisieCode(await codeEnvoye()), contexte(ribId))).status).toBe(200);
  return ribId;
}

beforeAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
});

beforeEach(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.messageSortant.deleteMany({ where: { destinataire: MOBILE } });

  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} Entreprise`,
      slug: `${MARQUE}-entreprise`,
      source: 'inscription',
      utilisateurs: {
        create: {
          nom: 'Martin',
          email: `${MARQUE}@exemple.test`,
          telephone: MOBILE,
          motDePasseHash: 'x',
        },
      },
    },
  });
  entrepriseId = entreprise.id;
  session.courante = { entrepriseId };
});

afterAll(async () => {
  await prisma.messageSortant.deleteMany({ where: { destinataire: MOBILE } });
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

describe('saisie', () => {
  it('enregistre le compte sans l’activer, et envoie un code', async () => {
    const reponse = await saisit(saisieRib());
    expect(reponse.status).toBe(200);
    // Les séparateurs sont insécables : le masque ne doit pas se couper en fin de ligne.
    expect(((await reponse.json()) as { mobileMasque: string }).mobileMasque).toBe(
      '••\u00a0••\u00a0••\u00a0••\u00a078',
    );

    const etat = await etatBancaire(entrepriseId);
    expect(etat.actif).toBeNull();
    expect(etat.enAttente?.iban).toBe(IBAN);

    const message = await prisma.messageSortant.findFirstOrThrow({
      where: { modele: 'rib-confirmation' },
    });
    expect(message.canal).toBe('sms');
    expect(message.destinataire).toBe(MOBILE);
  });

  it('envoie le code au numéro enregistré, jamais à un numéro fourni dans la requête', async () => {
    // Le cœur de la parade : sinon l'escroc indiquerait son propre mobile et se confirmerait
    // à lui-même le changement.
    await saisit(saisieRib({ telephone: '0799999999', destinataire: '0799999999' }));
    const message = await prisma.messageSortant.findFirstOrThrow({
      where: { modele: 'rib-confirmation' },
    });
    expect(message.destinataire).toBe(MOBILE);
  });

  it('ne stocke jamais le code en clair', async () => {
    await saisit(saisieRib());
    const rib = await prisma.rib.findFirstOrThrow({ where: { entrepriseId } });
    const code = await codeEnvoye();
    expect(rib.codeConfirmationHash).not.toBeNull();
    expect(rib.codeConfirmationHash).not.toContain(code);
    expect(rib.codeConfirmationHash).toBe(empreinteCode(code, rib.id, SECRET));
  });

  it('refuse une saisie invalide et rend tous les problèmes', async () => {
    const reponse = await saisit(saisieRib({ iban: 'FR00', bic: 'x', titulaire: '' }));
    expect(reponse.status).toBe(422);
    const { problemes } = (await reponse.json()) as { problemes: { champ: string }[] };
    expect(problemes.map((p) => p.champ).toSorted()).toEqual(['bic', 'iban', 'titulaire']);
    expect(await prisma.rib.count({ where: { entrepriseId } })).toBe(0);
  });

  it('refuse sans mobile enregistré : une confirmation sans second canal ne prouve rien', async () => {
    await prisma.utilisateurPro.updateMany({ where: { entrepriseId }, data: { telephone: null } });
    const reponse = await saisit(saisieRib());
    expect(reponse.status).toBe(422);
    const { problemes } = (await reponse.json()) as { problemes: { message: string }[] };
    expect(problemes[0]?.message).toContain('mobile');
  });

  it('refuse de refaire confirmer le compte déjà actif', async () => {
    await compteActif();
    const reponse = await saisit(saisieRib({ iban: 'fr76 3000 1007 9412 3456 7890 185' }));
    expect(reponse.status).toBe(422);
    const { problemes } = (await reponse.json()) as { problemes: { champ: string }[] };
    expect(problemes[0]?.champ).toBe('iban');
  });

  it('une seconde saisie remplace la tentative en attente', async () => {
    await saisit(saisieRib());
    await saisit(saisieRib({ iban: AUTRE_IBAN }));

    const etat = await etatBancaire(entrepriseId);
    expect(await prisma.rib.count({ where: { entrepriseId } })).toBe(1);
    expect(etat.enAttente?.iban).toBe(AUTRE_IBAN);
  });
});

describe('confirmation', () => {
  it('active le compte et le marque confirmé', async () => {
    const reponse = await saisit(saisieRib());
    const { ribId } = (await reponse.json()) as { ribId: string };
    expect((await confirme(saisieCode(await codeEnvoye()), contexte(ribId))).status).toBe(200);

    const etat = await etatBancaire(entrepriseId);
    expect(etat.actif?.iban).toBe(IBAN);
    expect(etat.actif?.confirmeParSmsLe).not.toBeNull();
    expect(etat.enAttente).toBeNull();
  });

  it('remplace l’ancien compte sans l’effacer', async () => {
    await compteActif();
    const reponse = await saisit(saisieRib({ iban: AUTRE_IBAN }));
    const { ribId } = (await reponse.json()) as { ribId: string };
    await confirme(saisieCode(await codeEnvoye()), contexte(ribId));

    const etat = await etatBancaire(entrepriseId);
    expect(etat.actif?.iban).toBe(AUTRE_IBAN);
    expect(etat.anciens).toHaveLength(1);
    expect(etat.anciens[0]?.iban).toBe(IBAN);
    expect(etat.anciens[0]?.remplaceLe).not.toBeNull();
  });

  it('laisse l’ancien compte actif tant que le code n’est pas saisi', async () => {
    // Un attaquant qui n'aboutit pas ne doit même pas pouvoir couper les encaissements.
    await compteActif();
    await saisit(saisieRib({ iban: AUTRE_IBAN }));

    const etat = await etatBancaire(entrepriseId);
    expect(etat.actif?.iban).toBe(IBAN);
    expect(etat.enAttente?.iban).toBe(AUTRE_IBAN);
  });

  it('refuse un code faux et décompte les essais', async () => {
    const reponse = await saisit(saisieRib());
    const { ribId } = (await reponse.json()) as { ribId: string };

    const refus = await confirme(saisieCode('000000'), contexte(ribId));
    expect(refus.status).toBe(422);
    expect(((await refus.json()) as { erreur: string }).erreur).toContain('essai');

    const etat = await etatBancaire(entrepriseId);
    expect(etat.actif).toBeNull();
  });

  it('bloque après la limite d’essais, même avec le bon code ensuite', async () => {
    const reponse = await saisit(saisieRib());
    const { ribId } = (await reponse.json()) as { ribId: string };

    for (let essai = 0; essai < TENTATIVES_MAX; essai += 1) {
      await confirme(saisieCode('000000'), contexte(ribId));
    }

    const apres = await confirme(saisieCode(await codeEnvoye()), contexte(ribId));
    expect(apres.status).toBe(422);
    expect(((await apres.json()) as { issue: string }).issue).toBe('trop-de-tentatives');
    expect((await etatBancaire(entrepriseId)).actif).toBeNull();
  });

  it('refuse un code expiré', async () => {
    const reponse = await saisit(saisieRib());
    const { ribId } = (await reponse.json()) as { ribId: string };
    const code = await codeEnvoye();

    await prisma.rib.update({
      where: { id: ribId },
      data: { codeExpireLe: new Date(Date.now() - 1000) },
    });

    const apres = await confirme(saisieCode(code), contexte(ribId));
    expect(((await apres.json()) as { issue: string }).issue).toBe('expire');
  });

  it('ne consomme pas d’essai sur un code mal formé', async () => {
    // La limite protège contre la force brute, pas contre un doigt qui glisse.
    const reponse = await saisit(saisieRib());
    const { ribId } = (await reponse.json()) as { ribId: string };

    for (const mauvais of ['12345', 'abcdef', '']) {
      expect((await confirme(saisieCode(mauvais), contexte(ribId))).status).toBe(422);
    }
    const rib = await prisma.rib.findUniqueOrThrow({ where: { id: ribId } });
    expect(rib.tentativesConfirmation).toBe(0);
  });

  it('le code ne sert qu’une fois', async () => {
    const reponse = await saisit(saisieRib());
    const { ribId } = (await reponse.json()) as { ribId: string };
    const code = await codeEnvoye();
    await confirme(saisieCode(code), contexte(ribId));

    const rejoue = await confirme(saisieCode(code), contexte(ribId));
    expect(((await rejoue.json()) as { issue: string }).issue).toBe('deja-verifie');
  });

  it('un code ne vaut pas pour un autre compte', async () => {
    // L'empreinte est salée par l'identifiant du RIB : elle ne sert donc que pour celui-là.
    const premier = await saisit(saisieRib());
    const { ribId } = (await premier.json()) as { ribId: string };
    const code = await codeEnvoye();

    // La seconde saisie remplace la première ; le code de la première ne doit rien ouvrir.
    const second = await saisit(saisieRib({ iban: AUTRE_IBAN }));
    const autre = (await second.json()) as { ribId: string };
    expect(autre.ribId).not.toBe(ribId);

    expect((await confirme(saisieCode(code), contexte(autre.ribId))).status).toBe(422);
    expect((await etatBancaire(entrepriseId)).actif).toBeNull();
  });
});

describe('la base tient la règle elle-même', () => {
  it('refuse deux comptes actifs', async () => {
    await compteActif();
    const second = await prisma.rib.create({
      data: {
        entrepriseId,
        titulaire: 'Plomberie Martin',
        iban: AUTRE_IBAN,
        bic: 'BNPAFRPP',
        actif: false,
      },
    });

    await expect(
      prisma.rib.update({ where: { id: second.id }, data: { actif: true } }),
    ).rejects.toThrow();
  });
});

describe('frontière', () => {
  it('ne confirme pas le compte d’un confrère', async () => {
    const reponse = await saisit(saisieRib());
    const { ribId } = (await reponse.json()) as { ribId: string };
    const code = await codeEnvoye();

    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    session.courante = { entrepriseId: autre.id };

    expect((await confirme(saisieCode(code), contexte(ribId))).status).toBe(422);
    expect((await etatBancaire(entrepriseId)).actif).toBeNull();
  });

  it('ne lit pas l’état bancaire d’un confrère', async () => {
    await compteActif();
    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    expect((await etatBancaire(autre.id)).actif).toBeNull();
  });

  it('refuse une requête sans session', async () => {
    session.courante = null;
    expect((await saisit(saisieRib())).status).toBe(401);
    expect((await confirme(saisieCode('123456'), contexte('x'))).status).toBe(401);
  });
});
