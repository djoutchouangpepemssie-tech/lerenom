/**
 * Le devis vu et accepté par le client.
 *
 * Jusqu'ici, « Envoyer au client » attribuait un numéro et ne partait nulle part. Ce que ces
 * tests gardent, c'est que le verbe dit vrai, et que ce qu'il ouvre reste étroit :
 *
 *   * **l'envoi met réellement des messages en file**, avec un lien qui ouvre ce devis-là ;
 *   * **le lien ne donne accès qu'à son devis** : pas à un autre, pas au suivi d'une demande ;
 *   * **un devis périmé ne s'accepte pas**, même si son lien vit encore — les deux durées
 *     sont indépendantes et c'est la plus courte qui gagne ;
 *   * **accepter ne se refait pas** : le lien est consommé, et le devis déjà signé refuse.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { creeLien } from '@lerenom/liens';
import { POST as cree } from '../pro/devis/route';
import { PUT as enregistre } from '../pro/devis/[id]/route';
import { POST as envoie } from '../pro/devis/[id]/envoi/route';
import { POST as accepte } from './[jeton]/acceptation/route';
import { devisPourClient } from '@/lib/devis-client';
import { listeFactures } from '@/lib/factures-pro';

const MARQUE = 'test-devis-client';
const EMAIL_CLIENT = `${MARQUE}@exemple.test`;
const MOBILE_CLIENT = '0611223344';
/** Fictif, et hors de la plage que le semis occupe : deux jeux de données se gênent vite. */
const SIRET = '80000009900012';

let entrepriseId = '';
let clientId = '';

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

function contexte(valeur: string) {
  return { params: Promise.resolve({ id: valeur, jeton: valeur }) };
}

function saisieDevis(acomptePourcent = 30, validiteJours = 30): Request {
  return new Request('http://localhost/api/pro/devis', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientId,
      type: 'estimatif',
      lignes: [
        {
          type: 'prestation',
          designation: 'Recherche de fuite',
          detail: '',
          unite: 'forfait',
          quantite: 1,
          prixUnitaireHT: 200,
          tauxTva: 10,
        },
      ],
      remisePourcent: 0,
      acomptePourcent,
      validiteJours,
      fraisDeplacementTTC: 0,
      devisPayant: false,
      piecesRemplaceesGardees: true,
      mentionRetractation: false,
    }),
  });
}

function vide(): Request {
  return new Request('http://localhost', { method: 'POST' });
}

/** Un devis envoyé, et le jeton du lien parti au client. */
async function devisEnvoye(acomptePourcent = 30, validiteJours = 30) {
  const id = ((await (await cree()).json()) as { id: string }).id;
  await enregistre(saisieDevis(acomptePourcent, validiteJours), contexte(id));
  const reponse = await envoie(vide(), contexte(id));
  expect(reponse.status).toBe(200);

  const message = await prisma.messageSortant.findFirstOrThrow({
    where: { modele: 'devis-envoye', canal: 'sms', destinataire: MOBILE_CLIENT },
    orderBy: { creeLe: 'desc' },
  });
  const trouve = /\/devis\/([A-Za-z0-9_-]+)/.exec(message.corps);
  if (trouve?.[1] === undefined) throw new Error(`lien introuvable dans : ${message.corps}`);
  return { id, jeton: trouve[1] };
}

beforeAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
});

beforeEach(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.messageSortant.deleteMany({
    where: { destinataire: { in: [EMAIL_CLIENT, MOBILE_CLIENT] } },
  });

  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} Entreprise`,
      slug: `${MARQUE}-entreprise`,
      source: 'inscription',
      siret: SIRET,
      clients: {
        create: { nom: 'Madame Dupuis', email: EMAIL_CLIENT, telephone: MOBILE_CLIENT },
      },
    },
    include: { clients: true },
  });
  entrepriseId = entreprise.id;
  clientId = entreprise.clients[0]?.id ?? '';
  session.courante = { entrepriseId };
});

afterAll(async () => {
  await prisma.messageSortant.deleteMany({
    where: { destinataire: { in: [EMAIL_CLIENT, MOBILE_CLIENT] } },
  });
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

describe('envoi', () => {
  it('met en file un courriel et un SMS portant le lien', async () => {
    const { jeton } = await devisEnvoye();
    const messages = await prisma.messageSortant.findMany({
      where: { modele: 'devis-envoye' },
    });
    expect(messages.map((m) => m.canal).toSorted()).toEqual(['email', 'sms']);
    expect(messages.every((m) => m.corps.includes(jeton))).toBe(true);
  });

  it('annonce par quels canaux il est parti', async () => {
    const id = ((await (await cree()).json()) as { id: string }).id;
    await enregistre(saisieDevis(), contexte(id));
    const corps = (await (await envoie(vide(), contexte(id))).json()) as {
      canaux: readonly string[];
    };
    expect(corps.canaux.toSorted()).toEqual(['email', 'sms']);
  });

  it('n’envoie rien, et le dit, quand le client n’a aucune coordonnée', async () => {
    // Le devis part quand même : il porte son numéro et il est immuable. Mentir sur ce point
    // laisserait le professionnel croire que son client a reçu quelque chose.
    await prisma.clientPro.update({
      where: { id: clientId },
      data: { email: null, telephone: null },
    });
    const id = ((await (await cree()).json()) as { id: string }).id;
    await enregistre(saisieDevis(), contexte(id));

    const reponse = await envoie(vide(), contexte(id));
    expect(reponse.status).toBe(200);
    expect(((await reponse.json()) as { canaux: readonly string[] }).canaux).toEqual([]);

    const devis = await prisma.devis.findUniqueOrThrow({ where: { id } });
    expect(devis.statut).toBe('envoye');
    expect(devis.numero).not.toBeNull();
  });
});

describe('la page du client', () => {
  it('montre le devis entier et qui l’engage', async () => {
    const { id } = await devisEnvoye();
    const devis = await devisPourClient(id);

    expect(devis?.numero).toMatch(/^DV-\d{4}-0001$/);
    expect(devis?.lignes).toHaveLength(1);
    expect(devis?.totaux.totalTTC).toBeCloseTo(220, 2);
    expect(devis?.entreprise.siret).toBe(SIRET);
    expect(devis?.clientNom).toBe('Madame Dupuis');
  });

  it('chiffre l’acompte réellement demandé', async () => {
    const { id } = await devisEnvoye(30);
    expect((await devisPourClient(id))?.acompteTTC).toBeCloseTo(66, 2);
  });

  it('ne montre pas un brouillon, même si on devine son identifiant', async () => {
    const id = ((await (await cree()).json()) as { id: string }).id;
    await enregistre(saisieDevis(), contexte(id));
    expect(await devisPourClient(id)).toBeNull();
  });

  it('dit pourquoi un devis périmé ne s’accepte plus', async () => {
    const { id } = await devisEnvoye(30, 15);
    await prisma.devis.update({
      where: { id },
      data: { envoyeLe: new Date(Date.now() - 16 * 86_400_000) },
    });

    const devis = await devisPourClient(id);
    expect(devis?.acceptable).toBe(false);
    expect(devis?.raisonRefus).toContain('durée de validité');
  });
});

describe('acceptation', () => {
  it('signe le devis et prépare les factures', async () => {
    const { id, jeton } = await devisEnvoye(30);
    const reponse = await accepte(vide(), contexte(jeton));
    expect(reponse.status).toBe(200);
    expect(((await reponse.json()) as { factures: number }).factures).toBe(2);

    const devis = await prisma.devis.findUniqueOrThrow({ where: { id } });
    expect(devis.statut).toBe('signe');
    expect((await listeFactures(entrepriseId)).map((f) => f.type).toSorted()).toEqual([
      'acompte',
      'solde',
    ]);
  });

  it('consomme le lien : accepter ne se refait pas', async () => {
    const { jeton } = await devisEnvoye();
    expect((await accepte(vide(), contexte(jeton))).status).toBe(200);
    expect((await accepte(vide(), contexte(jeton))).status).toBe(404);
    expect(await prisma.facture.count({ where: { entrepriseId } })).toBe(2);
  });

  it('refuse un devis périmé, même avec un lien encore valide', async () => {
    // Les deux durées sont indépendantes : le lien vit trente jours, le devis quinze.
    const { id, jeton } = await devisEnvoye(30, 15);
    await prisma.devis.update({
      where: { id },
      data: { envoyeLe: new Date(Date.now() - 16 * 86_400_000) },
    });

    const reponse = await accepte(vide(), contexte(jeton));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { erreur: string }).erreur).toContain('validité');
    expect(await prisma.facture.count({ where: { entrepriseId } })).toBe(0);
  });

  it('refuse un jeton inconnu sans dire si un devis existe', async () => {
    const reponse = await accepte(vide(), contexte('pas-un-jeton'));
    expect(reponse.status).toBe(404);
  });

  it('refuse un lien qui porte une autre action', async () => {
    // Un lien de suivi qui traîne dans une boîte mail ne doit engager personne.
    const { id } = await devisEnvoye();
    const autre = await creeLien(null, 'voir_pros', id);
    expect((await accepte(vide(), contexte(autre.jeton))).status).toBe(404);
    expect(await prisma.facture.count({ where: { entrepriseId } })).toBe(0);
  });

  it('un lien n’ouvre que son propre devis', async () => {
    const premier = await devisEnvoye();
    const second = await devisEnvoye();
    expect(premier.jeton).not.toBe(second.jeton);

    await accepte(vide(), contexte(premier.jeton));
    const restant = await prisma.devis.findUniqueOrThrow({ where: { id: second.id } });
    expect(restant.statut).toBe('envoye');
  });
});
