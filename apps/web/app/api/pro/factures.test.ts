/**
 * Les factures d'un professionnel.
 *
 * Elles ne se saisissent pas : elles sont préparées à partir du devis signé. Ce que ce test
 * garde, c'est ce qui rend une facture opposable :
 *
 *   * **une facture émise ne se modifie pas** — la base l'interdit par déclencheur, pas
 *     seulement le code. Ce test vérifie le garde-fou de la base, pas celui de l'application ;
 *   * **le RIB est figé à l'émission.** Un professionnel qui change de banque ne doit pas voir
 *     ses anciennes factures désigner un compte qu'il n'a plus ;
 *   * **le numéro est attribué à l'émission**, et la série ne comporte ni trou ni doublon ;
 *   * **l'acompte et le solde s'additionnent au total du devis**, sans centime perdu.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { numerotationContinue } from '@lerenom/core';
import { POST as cree } from './devis/route';
import { PUT as enregistreDevis } from './devis/[id]/route';
import { POST as envoie } from './devis/[id]/envoi/route';
import { POST as signe } from './devis/[id]/signature/route';
import { POST as emet } from './factures/[id]/emission/route';
import { factureDuPro, listeFactures } from '@/lib/factures-pro';

const MARQUE = 'test-factures';

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

function vide(): Request {
  return new Request('http://localhost');
}

function saisieDevis(acomptePourcent = 30): Request {
  return new Request('http://localhost/api/pro/devis', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientId: null,
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
      validiteJours: 30,
      fraisDeplacementTTC: 0,
      devisPayant: false,
      piecesRemplaceesGardees: true,
      mentionRetractation: false,
    }),
  });
}

/** Un devis envoyé, prêt à être déclaré signé. */
async function devisEnvoye(acomptePourcent = 30): Promise<string> {
  const id = ((await (await cree()).json()) as { id: string }).id;
  await enregistreDevis(saisieDevis(acomptePourcent), contexte(id));
  const reponse = await envoie(vide(), contexte(id));
  expect(reponse.status).toBe(200);
  return id;
}

beforeAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
});

beforeEach(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  const entreprise = await prisma.entreprise.create({
    data: { nom: `${MARQUE} Entreprise`, slug: `${MARQUE}-entreprise`, source: 'inscription' },
  });
  entrepriseId = entreprise.id;
  session.courante = { entrepriseId };
});

afterAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

describe('signature du devis', () => {
  it('prépare l’acompte et le solde', async () => {
    const devisId = await devisEnvoye(30);
    const reponse = await signe(vide(), contexte(devisId));
    expect(reponse.status).toBe(200);
    expect(((await reponse.json()) as { factures: number }).factures).toBe(2);

    const factures = await listeFactures(entrepriseId);
    expect(factures.map((f) => f.type).toSorted()).toEqual(['acompte', 'solde']);
    expect(factures.every((f) => f.statut === 'prete')).toBe(true);
    expect(factures.every((f) => f.numero === null)).toBe(true);
  });

  it('ne prépare qu’une facture quand le devis n’a pas d’acompte', async () => {
    const devisId = await devisEnvoye(0);
    await signe(vide(), contexte(devisId));

    const factures = await listeFactures(entrepriseId);
    expect(factures).toHaveLength(1);
    expect(factures[0]?.type).toBe('solde');
  });

  it('l’acompte et le solde s’additionnent au total du devis', async () => {
    // Sans ce test, un arrondi mal placé ferait payer un centime de trop ou de moins, et
    // personne ne le verrait avant la comptabilité.
    const devisId = await devisEnvoye(30);
    await signe(vide(), contexte(devisId));

    const factures = await listeFactures(entrepriseId);
    const somme = factures.reduce((total, f) => total + f.montantAPayerTTC, 0);
    const devis = await prisma.devis.findUniqueOrThrow({ where: { id: devisId } });
    expect(somme).toBeCloseTo(Number(devis.totalTTC), 2);
  });

  it('marque le devis comme signé', async () => {
    const devisId = await devisEnvoye();
    await signe(vide(), contexte(devisId));

    const devis = await prisma.devis.findUniqueOrThrow({ where: { id: devisId } });
    expect(devis.statut).toBe('signe');
    expect(devis.signeLe).not.toBeNull();
  });

  it('recopie les lignes du devis sur la facture', async () => {
    const devisId = await devisEnvoye(0);
    await signe(vide(), contexte(devisId));

    const factures = await listeFactures(entrepriseId);
    const premiere = factures[0];
    if (premiere === undefined) throw new Error('facture manquante');
    const facture = await factureDuPro(entrepriseId, premiere.id);
    expect(facture?.lignes).toHaveLength(1);
    expect(facture?.lignes[0]?.designation).toBe('Recherche de fuite');
  });

  it('refuse de signer un brouillon', async () => {
    const id = ((await (await cree()).json()) as { id: string }).id;
    await enregistreDevis(saisieDevis(), contexte(id));

    const reponse = await signe(vide(), contexte(id));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { erreur: string }).erreur).toContain('Envoyez');
  });

  it('refuse une seconde signature', async () => {
    const devisId = await devisEnvoye();
    await signe(vide(), contexte(devisId));
    expect((await signe(vide(), contexte(devisId))).status).toBe(422);
    expect(await prisma.facture.count({ where: { entrepriseId } })).toBe(2);
  });
});

describe('émission', () => {
  /** Signe un devis et rend l'identifiant de sa facture de solde. */
  async function factureDeSolde(): Promise<string> {
    const devisId = await devisEnvoye(0);
    await signe(vide(), contexte(devisId));
    const factures = await listeFactures(entrepriseId);
    const solde = factures.find((f) => f.type === 'solde');
    if (solde === undefined) throw new Error('facture de solde manquante');
    return solde.id;
  }

  it('attribue un numéro et une échéance', async () => {
    const id = await factureDeSolde();
    const reponse = await emet(vide(), contexte(id));
    expect(reponse.status).toBe(200);
    expect(((await reponse.json()) as { numero: string }).numero).toMatch(/^FA-\d{4}-0001$/);

    const facture = await prisma.facture.findUniqueOrThrow({ where: { id } });
    expect(facture.statut).toBe('emise');
    expect(facture.emiseLe).not.toBeNull();
    expect(facture.echeanceLe).not.toBeNull();
  });

  it('numérote sans trou ni doublon', async () => {
    const numeros: string[] = [];
    for (let rang = 0; rang < 3; rang += 1) {
      const id = await factureDeSolde();
      const reponse = await emet(vide(), contexte(id));
      numeros.push(((await reponse.json()) as { numero: string }).numero);
    }
    expect(new Set(numeros).size).toBe(3);
    expect(numerotationContinue(numeros)).toBe(true);
  });

  it('refuse une seconde émission', async () => {
    const id = await factureDeSolde();
    await emet(vide(), contexte(id));

    const reponse = await emet(vide(), contexte(id));
    expect(reponse.status).toBe(422);
    expect(((await reponse.json()) as { erreur: string }).erreur).toContain('avoir');
  });

  it('s’émet sans RIB actif : un client peut payer autrement', async () => {
    const id = await factureDeSolde();
    expect((await emet(vide(), contexte(id))).status).toBe(200);
    expect((await factureDuPro(entrepriseId, id))?.rib).toBeNull();
  });

  describe('RIB figé', () => {
    async function poseUnRib(iban: string, titulaire: string) {
      return prisma.rib.create({
        data: {
          entrepriseId,
          titulaire,
          iban,
          bic: 'ABCDFRPPXXX',
          banque: 'Banque fictive',
          actif: true,
          confirmeParSmsLe: new Date(),
        },
      });
    }

    it('recopie le RIB actif sur la facture émise', async () => {
      await poseUnRib('FR7630001007941234567890185', 'Plomberie Martin');
      const id = await factureDeSolde();
      await emet(vide(), contexte(id));

      const facture = await factureDuPro(entrepriseId, id);
      expect(facture?.rib?.iban).toBe('FR7630001007941234567890185');
    });

    it('garde l’ancien RIB sur une facture déjà émise', async () => {
      // Un client qui paie une facture de l'an dernier ne doit pas payer sur le compte
      // ouvert depuis.
      const ancien = await poseUnRib('FR7630001007941234567890185', 'Plomberie Martin');
      const id = await factureDeSolde();
      await emet(vide(), contexte(id));

      await prisma.rib.update({ where: { id: ancien.id }, data: { actif: false } });
      await poseUnRib('FR7630004000031234567890143', 'Plomberie Martin');

      const facture = await factureDuPro(entrepriseId, id);
      expect(facture?.rib?.iban).toBe('FR7630001007941234567890185');
    });

    it('montre le RIB du jour sur une facture pas encore émise', async () => {
      await poseUnRib('FR7630001007941234567890185', 'Plomberie Martin');
      const id = await factureDeSolde();

      const facture = await factureDuPro(entrepriseId, id);
      expect(facture?.rib?.iban).toBe('FR7630001007941234567890185');
      expect(facture?.emiseLe).toBeNull();
    });
  });

  it('la base elle-même refuse de modifier une facture émise', async () => {
    // Le déclencheur `factures_immuables` est la vraie garantie : il tient même si quelqu'un
    // écrit en SQL, là où un contrôle applicatif se contourne.
    const id = await factureDeSolde();
    await emet(vide(), contexte(id));

    await expect(prisma.facture.update({ where: { id }, data: { totalTTC: 1 } })).rejects.toThrow(
      /avoir/i,
    );
  });
});

describe('frontière', () => {
  it('ne lit pas la facture d’un confrère', async () => {
    const devisId = await devisEnvoye(0);
    await signe(vide(), contexte(devisId));
    const facture = (await listeFactures(entrepriseId))[0];
    if (facture === undefined) throw new Error('facture manquante');

    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    expect(await factureDuPro(autre.id, facture.id)).toBeNull();
  });

  it('n’émet pas la facture d’un confrère', async () => {
    const devisId = await devisEnvoye(0);
    await signe(vide(), contexte(devisId));
    const facture = (await listeFactures(entrepriseId))[0];
    if (facture === undefined) throw new Error('facture manquante');

    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    session.courante = { entrepriseId: autre.id };

    expect((await emet(vide(), contexte(facture.id))).status).toBe(422);
  });

  it('refuse une requête sans session', async () => {
    session.courante = null;
    expect((await signe(vide(), contexte('x'))).status).toBe(401);
    expect((await emet(vide(), contexte('x'))).status).toBe(401);
  });
});
