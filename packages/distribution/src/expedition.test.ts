/**
 * L'expéditeur, contre la vraie base.
 *
 * Deux choses sont gardées ici, et elles comptent plus que les autres.
 *
 * **Sans fournisseur, rien n'est marqué envoyé.** C'est l'état réel du produit aujourd'hui, et
 * un travail qui marquerait les messages comme partis ferait disparaître la seule preuve que
 * rien ne fonctionne.
 *
 * **Un message périmé est abandonné, pas envoyé.** La file dort depuis des semaines ; le jour
 * du raccordement, sans cette règle, tout partirait d'un coup.
 *
 * **Ces tests mettent la file ambiante de côté, et la remettent.** L'expéditeur est global
 * par nature : il vide la file entière, dans l'ordre d'ancienneté et par lots bornés. Les
 * messages de démonstration qui y dorment faisaient échouer les tests de deux façons — le
 * fournisseur d'essai les envoyait tous, et, devenus plus nombreux que la taille d'un lot, ils
 * repoussaient les messages du test hors de la fenêtre. Un test de videur de file a besoin
 * d'une file à lui.
 *
 * La mise de côté est **exacte** : on note les identifiants avant, on restaure ceux-là et pas
 * d'autres. Une restauration qui redeviendrait « tout remettre en attente » écraserait l'état
 * réel de lignes qu'on n'a pas touchées — c'est le piège qui avait déjà coûté les coordonnées
 * de quatre arrondissements.
 *
 * Les assertions portent par ailleurs sur **les lignes de ce test**, jamais sur les compteurs
 * du bilan : la première version attendait `envoyes === 1` et en a trouvé cent quatre-vingt-dix.
 */

import process from 'node:process';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@lerenom/db';
import type { ResultatEnvoi } from '@lerenom/core';
import {
  expedieLesMessages,
  fileEnAttente,
  oublieLesFournisseurs,
  raccordeFournisseur,
  type Fournisseur,
  type MessageAEnvoyer,
} from './expedition.ts';

const aUneBase = (process.env['DATABASE_URL'] ?? '') !== '';
const decrire = aUneBase ? describe : describe.skip;

const MARQUE = 'test-expedition';
const MOBILE = '0677112233';

const MAINTENANT = new Date();

function ilYA(heures: number): Date {
  return new Date(MAINTENANT.getTime() - heures * 3_600_000);
}

/** Un message en attente, avec l'âge qu'on lui donne. */
async function enAttente(
  modification: Partial<{
    canal: 'sms' | 'email';
    destinataire: string;
    creeLe: Date;
    tentatives: number;
    derniereTentativeLe: Date;
  }> = {},
): Promise<string> {
  const message = await prisma.messageSortant.create({
    data: {
      canal: modification.canal ?? 'sms',
      modele: MARQUE,
      destinataire: modification.destinataire ?? MOBILE,
      corps: 'Un message de test.',
      statut: 'en_attente',
      creeLe: modification.creeLe ?? ilYA(0.1),
      tentatives: modification.tentatives ?? 0,
      ...(modification.derniereTentativeLe !== undefined
        ? { derniereTentativeLe: modification.derniereTentativeLe }
        : {}),
    },
    select: { id: true },
  });
  return message.id;
}

async function relu(id: string) {
  return prisma.messageSortant.findUniqueOrThrow({ where: { id } });
}

/** Les messages de ce test parmi tous ceux qu'un fournisseur a reçus. */
function miens(fournisseur: { recus: MessageAEnvoyer[] }): MessageAEnvoyer[] {
  return fournisseur.recus.filter((message) => message.modele === MARQUE);
}

/** Un fournisseur d'essai : il note ce qu'on lui donne et rend ce qu'on lui dit de rendre. */
function fournisseurDEssai(
  resultat: ResultatEnvoi = { ok: true, fournisseurId: 'essai-1' },
  canaux: readonly ('sms' | 'email')[] = ['sms', 'email'],
): Fournisseur & { recus: MessageAEnvoyer[] } {
  const recus: MessageAEnvoyer[] = [];
  return {
    nom: 'essai',
    canaux,
    recus,
    envoie: (message) => {
      recus.push(message);
      return Promise.resolve(resultat);
    },
  };
}

/** Les messages qui attendaient avant nous, et qu'il faudra remettre exactement comme ils étaient. */
let misDeCote: string[] = [];

beforeAll(async () => {
  if (!aUneBase) return;
  const ambiants = await prisma.messageSortant.findMany({
    where: { statut: 'en_attente', modele: { not: MARQUE } },
    select: { id: true },
  });
  misDeCote = ambiants.map((message) => message.id);
  await prisma.messageSortant.updateMany({
    where: { id: { in: misDeCote } },
    data: { statut: 'echec', erreur: 'mis de côté par les tests' },
  });
});

beforeEach(async () => {
  if (!aUneBase) return;
  oublieLesFournisseurs();
  await prisma.messageSortant.deleteMany({ where: { modele: MARQUE } });
});

afterAll(async () => {
  if (!aUneBase) return;
  oublieLesFournisseurs();
  await prisma.messageSortant.deleteMany({ where: { modele: MARQUE } });
  await prisma.messageSortant.updateMany({
    where: { id: { in: misDeCote } },
    data: { statut: 'en_attente', erreur: null },
  });
  await prisma.$disconnect();
});

decrire('expedieLesMessages sans fournisseur', () => {
  it('ne marque rien comme envoyé', async () => {
    // L'état d'aujourd'hui. Mentir ici ferait disparaître la preuve que rien ne part.
    const id = await enAttente();
    const bilan = await expedieLesMessages(MAINTENANT);

    expect(bilan.envoyes).toBe(0);
    expect(bilan.sansFournisseur).toBeGreaterThanOrEqual(1);

    const message = await relu(id);
    expect(message.statut).toBe('en_attente');
    expect(message.envoyeLe).toBeNull();
    expect(message.tentatives).toBe(0);
  });

  it('abandonne quand même ce qui est périmé', async () => {
    // Sinon la file enfle indéfiniment, et le jour du raccordement tout part d'un coup.
    const id = await enAttente({ creeLe: ilYA(72) });
    await expedieLesMessages(MAINTENANT);

    const message = await relu(id);
    expect(message.statut).toBe('echec');
    expect(message.erreur).toContain('périmé');
    expect(message.envoyeLe).toBeNull();
  });

  it('ne sert pas un canal qu’aucun fournisseur ne couvre', async () => {
    const fournisseur = fournisseurDEssai({ ok: true, fournisseurId: 'x' }, ['email']);
    raccordeFournisseur(fournisseur);
    const id = await enAttente({ canal: 'sms' });
    const bilan = await expedieLesMessages(MAINTENANT);

    expect(bilan.sansFournisseur).toBeGreaterThanOrEqual(1);
    expect(miens(fournisseur)).toHaveLength(0);
    expect((await relu(id)).statut).toBe('en_attente');
  });
});

decrire('expedieLesMessages avec un fournisseur', () => {
  it('envoie, horodate et garde l’identifiant du fournisseur', async () => {
    const fournisseur = fournisseurDEssai();
    raccordeFournisseur(fournisseur);
    const id = await enAttente();

    await expedieLesMessages(MAINTENANT);

    const message = await relu(id);
    expect(message.statut).toBe('envoye');
    expect(message.envoyeLe).not.toBeNull();
    expect(message.fournisseurId).toBe('essai-1');
    expect(message.tentatives).toBe(1);
    expect(miens(fournisseur).map((m) => m.id)).toEqual([id]);
  });

  it('n’envoie jamais deux fois le même message', async () => {
    // Un doublon sur un canal payant coûte de l'argent et de la confiance.
    const fournisseur = fournisseurDEssai();
    raccordeFournisseur(fournisseur);
    const id = await enAttente();

    await expedieLesMessages(MAINTENANT);
    await expedieLesMessages(new Date(MAINTENANT.getTime() + 3_600_000));

    expect(miens(fournisseur).filter((m) => m.id === id)).toHaveLength(1);
  });

  it('laisse en attente un échec passager, et réessaie plus tard', async () => {
    raccordeFournisseur(
      fournisseurDEssai({ ok: false, erreur: 'temps dépassé', definitif: false }),
    );
    const id = await enAttente();

    await expedieLesMessages(MAINTENANT);
    const apres = await relu(id);
    expect(apres.statut).toBe('en_attente');
    expect(apres.erreur).toBe('temps dépassé');
    expect(apres.tentatives).toBe(1);

    // Tout de suite après, l'attente n'est pas écoulée : on ne martèle pas.
    await expedieLesMessages(new Date(MAINTENANT.getTime() + 10_000));
    expect((await relu(id)).tentatives).toBe(1);
  });

  it('clôt un échec définitif sans réessayer', async () => {
    const fournisseur = fournisseurDEssai({
      ok: false,
      erreur: 'numéro inexistant',
      definitif: true,
    });
    raccordeFournisseur(fournisseur);
    const id = await enAttente();

    await expedieLesMessages(MAINTENANT);
    await expedieLesMessages(new Date(MAINTENANT.getTime() + 86_400_000));

    expect(miens(fournisseur).filter((m) => m.id === id)).toHaveLength(1);
    const message = await relu(id);
    expect(message.statut).toBe('echec');
    expect(message.erreur).toBe('numéro inexistant');
  });

  it('traite une exception d’adaptateur comme un échec passager', async () => {
    // On ne sait pas distinguer un bogue d'une panne réseau ; fermer sur un doute perdrait
    // le message pour de bon.
    raccordeFournisseur({
      nom: 'cassé',
      canaux: ['sms'],
      envoie: () => Promise.reject(new Error('boum')),
    });
    const id = await enAttente();

    await expedieLesMessages(MAINTENANT);

    const message = await relu(id);
    expect(message.statut).toBe('en_attente');
    expect(message.erreur).toBe('boum');
  });

  it('abandonne un destinataire vide sans appeler le fournisseur', async () => {
    const fournisseur = fournisseurDEssai();
    raccordeFournisseur(fournisseur);
    const id = await enAttente({ destinataire: '   ' });

    await expedieLesMessages(MAINTENANT);

    expect(miens(fournisseur)).toHaveLength(0);
    expect((await relu(id)).erreur).toContain('destinataire');
  });

  it('prend les messages du plus ancien au plus récent', async () => {
    // Inverser ferait arriver la relance avant la proposition qu'elle relance.
    const fournisseur = fournisseurDEssai();
    raccordeFournisseur(fournisseur);
    await prisma.messageSortant.create({
      data: {
        canal: 'sms',
        modele: MARQUE,
        destinataire: MOBILE,
        corps: 'récent',
        creeLe: ilYA(1),
      },
    });
    await prisma.messageSortant.create({
      data: {
        canal: 'sms',
        modele: MARQUE,
        destinataire: MOBILE,
        corps: 'ancien',
        creeLe: ilYA(5),
      },
    });

    await expedieLesMessages(MAINTENANT);
    expect(miens(fournisseur).map((m) => m.corps)).toEqual(['ancien', 'récent']);
  });

  it('borne le lot : une file énorme ne tient pas la base ouverte', async () => {
    const fournisseur = fournisseurDEssai();
    raccordeFournisseur(fournisseur);
    for (let i = 0; i < 5; i += 1) await enAttente();

    const bilan = await expedieLesMessages(MAINTENANT, 2);
    expect(bilan.examines).toBe(2);
    expect(fournisseur.recus.length).toBeLessThanOrEqual(2);
  });

  it('abandonne un message périmé sans l’envoyer, fournisseur ou non', async () => {
    // Le cœur de la protection : le raccordement d'un opérateur ne doit pas réveiller la file
    // dormante.
    const fournisseur = fournisseurDEssai();
    raccordeFournisseur(fournisseur);
    const id = await enAttente({ creeLe: ilYA(48) });

    await expedieLesMessages(MAINTENANT);

    expect(miens(fournisseur)).toHaveLength(0);
    expect((await relu(id)).statut).toBe('echec');
  });
});

decrire('fileEnAttente', () => {
  it('compte ce qui attend et donne le plus ancien', async () => {
    await enAttente({ creeLe: ilYA(2) });
    await enAttente({ creeLe: ilYA(8) });

    const file = await fileEnAttente();
    expect(file.nombre).toBeGreaterThanOrEqual(2);
    expect(file.plusAncien).not.toBeNull();
  });
});
