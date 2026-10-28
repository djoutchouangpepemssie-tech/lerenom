/**
 * Les devis d'un professionnel.
 *
 * Trois garanties sont tenues ici, et ce sont elles qui font qu'un devis est un engagement
 * plutôt qu'un brouillon partagé :
 *
 *   * **un devis envoyé ne se modifie plus.** Le client en a reçu un exemplaire ; le changer
 *     sous ses yeux n'est pas une correction, c'est une substitution. On duplique ;
 *   * **le numéro n'est attribué qu'à l'envoi.** Un brouillon abandonné ne consomme pas de
 *     numéro, et un trou dans une série est un défaut comptable ;
 *   * **un devis non conforme ne part pas.** Les mentions obligatoires d'un devis de dépannage
 *     à domicile protègent le professionnel autant que le client.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { numerotationContinue } from '@lerenom/core';
import { POST as cree } from './devis/route';
import { PUT as enregistre } from './devis/[id]/route';
import { POST as envoie } from './devis/[id]/envoi/route';
import { POST as duplique } from './devis/[id]/duplication/route';
import { devisDuPro, listeDevis } from '@/lib/devis-pro';

const MARQUE = 'test-devis';

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

function contexte(id: string) {
  return { params: Promise.resolve({ id }) };
}

function requete(corps: unknown): Request {
  return new Request('http://localhost/api/pro/devis', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });
}

function saisie(modifications: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clientId: null,
    type: 'estimatif',
    lignes: [
      {
        type: 'prestation',
        designation: 'Recherche de fuite',
        detail: 'Caméra thermique',
        unite: 'forfait',
        quantite: 1,
        prixUnitaireHT: 150,
        tauxTva: 10,
      },
      {
        type: 'prestation',
        designation: 'Main-d’œuvre',
        detail: '',
        unite: 'heure',
        quantite: 2,
        prixUnitaireHT: 60,
        tauxTva: 10,
      },
    ],
    remisePourcent: 0,
    acomptePourcent: 30,
    validiteJours: 30,
    fraisDeplacementTTC: 0,
    devisPayant: false,
    piecesRemplaceesGardees: true,
    mentionRetractation: false,
    ...modifications,
  };
}

/** Une ligne de prestation ordinaire, pour les tests qui n'en veulent qu'une. */
function ligne(modifications: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'prestation',
    designation: 'Recherche de fuite',
    detail: '',
    unite: 'forfait',
    quantite: 1,
    prixUnitaireHT: 150,
    tauxTva: 10,
    ...modifications,
  };
}

/** Crée un brouillon et rend son identifiant. */
async function nouveauDevis(): Promise<string> {
  const reponse = await cree();
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { id: string }).id;
}

beforeAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
});

beforeEach(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} Entreprise`,
      slug: `${MARQUE}-entreprise`,
      source: 'inscription',
      clients: { create: { nom: 'Madame Dupuis', telephone: '01 99 00 00 21' } },
    },
    include: { clients: true },
  });
  entrepriseId = entreprise.id;
  clientId = entreprise.clients[0]?.id ?? '';
  session.courante = { entrepriseId };
});

afterAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

describe('brouillon', () => {
  it('crée un devis sans numéro', async () => {
    const id = await nouveauDevis();
    const devis = await devisDuPro(entrepriseId, id);

    expect(devis?.numero).toBeNull();
    expect(devis?.statut).toBe('brouillon');
    expect(devis?.modifiable).toBe(true);
  });

  it('pose les frais de déplacement à zéro, et non à « non renseigné »', async () => {
    // La mention est obligatoire : « offert » est une réponse, l'absence n'en est pas une.
    const devis = await devisDuPro(entrepriseId, await nouveauDevis());
    expect(devis?.fraisDeplacementTTC).toBe(0);
  });

  it('enregistre les lignes et calcule les totaux', async () => {
    const id = await nouveauDevis();
    const reponse = await enregistre(requete(saisie()), contexte(id));
    expect(reponse.status).toBe(200);

    const corps = (await reponse.json()) as { totaux: { totalHT: number; totalTTC: number } };
    expect(corps.totaux.totalHT).toBe(270);
    expect(corps.totaux.totalTTC).toBe(297);

    const devis = await devisDuPro(entrepriseId, id);
    expect(devis?.lignes).toHaveLength(2);
    expect(devis?.totaux.totalTTC).toBe(297);
  });

  it('stocke les totaux pour que la liste n’ait pas à recalculer', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie()), contexte(id));

    const liste = await listeDevis(entrepriseId);
    expect(liste[0]?.totalTTC).toBe(297);
  });

  it('remplace les lignes au lieu de les additionner', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie()), contexte(id));
    await enregistre(requete(saisie({ lignes: [ligne()] })), contexte(id));

    const devis = await devisDuPro(entrepriseId, id);
    expect(devis?.lignes).toHaveLength(1);
  });

  it('applique la remise globale', async () => {
    const id = await nouveauDevis();
    const reponse = await enregistre(requete(saisie({ remisePourcent: 10 })), contexte(id));
    const corps = (await reponse.json()) as { totaux: { remiseHT: number; totalHT: number } };

    expect(corps.totaux.remiseHT).toBe(27);
    expect(corps.totaux.totalHT).toBe(243);
  });

  it('calcule l’acompte demandé', async () => {
    const id = await nouveauDevis();
    const reponse = await enregistre(requete(saisie({ acomptePourcent: 30 })), contexte(id));
    const corps = (await reponse.json()) as {
      totaux: { acompteTTC: number; soldeTTC: number; totalTTC: number };
    };

    expect(corps.totaux.acompteTTC + corps.totaux.soldeTTC).toBe(corps.totaux.totalTTC);
    expect(corps.totaux.acompteTTC).toBeGreaterThan(0);
  });

  it('rattache un client de l’entreprise', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie({ clientId })), contexte(id));
    expect((await devisDuPro(entrepriseId, id))?.clientId).toBe(clientId);
  });

  it('refuse un client qui n’est pas le sien', async () => {
    const autre = await prisma.entreprise.create({
      data: {
        nom: `${MARQUE} Autre`,
        slug: `${MARQUE}-autre`,
        source: 'inscription',
        clients: { create: { nom: 'Client d’un confrère' } },
      },
      include: { clients: true },
    });

    const id = await nouveauDevis();
    const reponse = await enregistre(
      requete(saisie({ clientId: autre.clients[0]?.id })),
      contexte(id),
    );
    expect(reponse.status).toBe(422);
  });

  it('refuse une ligne sans désignation', async () => {
    const id = await nouveauDevis();
    // Deux espaces passent le contrôle de forme — ils font bien un caractère — et c'est la
    // règle métier qui les refuse : 422, et non 400.
    const reponse = await enregistre(
      requete(saisie({ lignes: [ligne({ designation: '  ' })] })),
      contexte(id),
    );
    expect(reponse.status).toBe(422);
  });

  it('refuse une remise hors bornes', async () => {
    const id = await nouveauDevis();
    expect((await enregistre(requete(saisie({ remisePourcent: 150 })), contexte(id))).status).toBe(
      400,
    );
  });
});

describe('conformité', () => {
  it('refuse d’envoyer un devis sans ligne chiffrée', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie({ lignes: [] })), contexte(id));

    const reponse = await envoie(new Request('http://localhost'), contexte(id));
    expect(reponse.status).toBe(422);
    const corps = (await reponse.json()) as { manquants: string[] };
    expect(corps.manquants.join(' ')).toContain('ligne de prestation');
  });

  it('refuse d’envoyer sans frais de déplacement indiqués', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie({ fraisDeplacementTTC: null })), contexte(id));

    const reponse = await envoie(new Request('http://localhost'), contexte(id));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { manquants: string[] }).manquants.join(' ')).toContain(
      'déplacement',
    );
  });

  it('accepte des frais de déplacement à zéro', async () => {
    // « Déplacement offert » est une mention ; son absence n'en est pas une.
    const id = await nouveauDevis();
    await enregistre(requete(saisie({ fraisDeplacementTTC: 0 })), contexte(id));
    expect((await envoie(new Request('http://localhost'), contexte(id))).status).toBe(200);
  });

  it('refuse d’envoyer une ligne sans unité', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie({ lignes: [ligne({ unite: null })] })), contexte(id));
    const reponse = await envoie(new Request('http://localhost'), contexte(id));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { manquants: string[] }).manquants.join(' ')).toContain(
      'Unité',
    );
  });
});

describe('envoi', () => {
  it('attribue un numéro et rend le devis immuable', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie()), contexte(id));

    const reponse = await envoie(new Request('http://localhost'), contexte(id));
    expect(reponse.status).toBe(200);
    const corps = (await reponse.json()) as { numero: string };
    expect(corps.numero).toMatch(/^DV-\d{4}-0001$/);

    const devis = await devisDuPro(entrepriseId, id);
    expect(devis?.statut).toBe('envoye');
    expect(devis?.modifiable).toBe(false);
    expect(devis?.envoyeLe).not.toBe(null);
  });

  it('refuse toute modification après l’envoi', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie()), contexte(id));
    await envoie(new Request('http://localhost'), contexte(id));

    const reponse = await enregistre(requete(saisie({ remisePourcent: 50 })), contexte(id));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { erreur: string }).erreur).toContain('Dupliquez');

    // Et rien n'a bougé.
    expect((await devisDuPro(entrepriseId, id))?.remisePourcent).toBe(0);
  });

  it('refuse un second envoi', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie()), contexte(id));
    await envoie(new Request('http://localhost'), contexte(id));

    expect((await envoie(new Request('http://localhost'), contexte(id))).status).toBe(422);
  });

  it('numérote sans trou ni doublon', async () => {
    // Un trou dans une série de numéros est un défaut comptable.
    const numeros: string[] = [];
    for (let rang = 0; rang < 3; rang += 1) {
      const id = await nouveauDevis();
      await enregistre(requete(saisie()), contexte(id));
      const reponse = await envoie(new Request('http://localhost'), contexte(id));
      numeros.push(((await reponse.json()) as { numero: string }).numero);
    }

    expect(new Set(numeros).size).toBe(3);
    expect(numerotationContinue(numeros)).toBe(true);
  });

  it('ne consomme aucun numéro pour un brouillon abandonné', async () => {
    await nouveauDevis();
    await nouveauDevis();

    const id = await nouveauDevis();
    await enregistre(requete(saisie()), contexte(id));
    const reponse = await envoie(new Request('http://localhost'), contexte(id));
    expect(((await reponse.json()) as { numero: string }).numero).toMatch(/-0001$/);
  });

  it('suit le préfixe choisi par l’entreprise', async () => {
    await prisma.parametresDocuments.create({
      data: { entrepriseId, prefixeDevis: 'EST' },
    });

    const id = await nouveauDevis();
    await enregistre(requete(saisie()), contexte(id));
    const reponse = await envoie(new Request('http://localhost'), contexte(id));
    expect(((await reponse.json()) as { numero: string }).numero).toMatch(/^EST-/);
  });
});

describe('duplication', () => {
  it('copie un devis envoyé en un nouveau brouillon', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie({ remisePourcent: 5 })), contexte(id));
    await envoie(new Request('http://localhost'), contexte(id));

    const reponse = await duplique(new Request('http://localhost'), contexte(id));
    expect(reponse.status).toBe(201);
    const copieId = ((await reponse.json()) as { id: string }).id;

    const copie = await devisDuPro(entrepriseId, copieId);
    expect(copie?.statut).toBe('brouillon');
    expect(copie?.numero).toBeNull();
    expect(copie?.version).toBe(2);
    expect(copie?.lignes).toHaveLength(2);
    expect(copie?.remisePourcent).toBe(5);
  });

  it('laisse l’original intact', async () => {
    const id = await nouveauDevis();
    await enregistre(requete(saisie()), contexte(id));
    await envoie(new Request('http://localhost'), contexte(id));
    const avant = await devisDuPro(entrepriseId, id);

    await duplique(new Request('http://localhost'), contexte(id));

    const apres = await devisDuPro(entrepriseId, id);
    expect(apres?.numero).toBe(avant?.numero);
    expect(apres?.statut).toBe('envoye');
  });
});

describe('frontière', () => {
  it('ne lit pas le devis d’un confrère', async () => {
    const id = await nouveauDevis();
    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });

    expect(await devisDuPro(autre.id, id)).toBeNull();
  });

  it('n’enregistre pas sur le devis d’un confrère', async () => {
    const id = await nouveauDevis();
    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    session.courante = { entrepriseId: autre.id };

    const reponse = await enregistre(requete(saisie()), contexte(id));
    expect(reponse.status).toBe(422);
  });

  it('refuse une requête sans session', async () => {
    const id = await nouveauDevis();
    session.courante = null;
    expect((await enregistre(requete(saisie()), contexte(id))).status).toBe(401);
    expect((await envoie(new Request('http://localhost'), contexte(id))).status).toBe(401);
    expect((await cree()).status).toBe(401);
  });
});
