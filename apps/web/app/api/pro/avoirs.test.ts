/**
 * Les avoirs d'un professionnel.
 *
 * L'avoir est le seul moyen de corriger une facture émise. Ce que ce test garde :
 *
 *   * **on ne crédite jamais plus qu'on n'a facturé**, y compris en plusieurs avoirs — c'est
 *     ainsi que le dépassement arriverait vraiment ;
 *   * **un avoir qui couvre tout annule la facture**, sans l'effacer : elle reste au livre
 *     avec son avoir en face ;
 *   * **la base refuse de modifier ou de supprimer un avoir** — par déclencheur, pas par du
 *     code applicatif qui se contourne en SQL ;
 *   * **le garde-fou de la facture ne se contourne pas par l'annulation** : passer une
 *     facture à `annulee_par_avoir` n'autorise pas à en réécrire les montants au passage ;
 *   * **la numérotation est continue**, dans sa propre série, par entreprise.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { numerotationContinue } from '@lerenom/core';
import { POST as cree } from './devis/route';
import { PUT as enregistreDevis } from './devis/[id]/route';
import { POST as envoie } from './devis/[id]/envoi/route';
import { POST as signe } from './devis/[id]/signature/route';
import { POST as emet } from './factures/[id]/emission/route';
import { POST as crediteRoute } from './factures/[id]/avoir/route';
import { etatCreditFacture, listeAvoirs } from '@/lib/avoirs-pro';
import { listeFactures } from '@/lib/factures-pro';

const MARQUE = 'test-avoirs';
const MOTIF = 'Erreur de quantité sur la main-d’œuvre';

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

function saisieAvoir(montantTTC: unknown, motif: unknown = MOTIF): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ montantTTC, motif }),
  });
}

function saisieDevis(): Request {
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
      acomptePourcent: 0,
      validiteJours: 30,
      fraisDeplacementTTC: 0,
      devisPayant: false,
      piecesRemplaceesGardees: true,
      mentionRetractation: false,
    }),
  });
}

/** Une facture émise, à 220 € TTC, prête à être créditée. */
async function factureEmise(): Promise<{ id: string; montantTTC: number }> {
  const devisId = ((await (await cree()).json()) as { id: string }).id;
  await enregistreDevis(saisieDevis(), contexte(devisId));
  await envoie(vide(), contexte(devisId));
  await signe(vide(), contexte(devisId));

  const factures = await listeFactures(entrepriseId);
  const solde = factures.find((f) => f.type === 'solde' && f.statut === 'prete');
  if (solde === undefined) throw new Error('facture de solde manquante');
  expect((await emet(vide(), contexte(solde.id))).status).toBe(200);
  return { id: solde.id, montantTTC: solde.montantAPayerTTC };
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

describe('émission d’un avoir', () => {
  it('crédite partiellement sans annuler la facture', async () => {
    const facture = await factureEmise();
    const reponse = await crediteRoute(saisieAvoir(50), contexte(facture.id));
    expect(reponse.status).toBe(200);

    const corps = (await reponse.json()) as { numero: string; factureAnnulee: boolean };
    expect(corps.numero).toMatch(/^AV-\d{4}-0001$/);
    expect(corps.factureAnnulee).toBe(false);

    const apres = await prisma.facture.findUniqueOrThrow({ where: { id: facture.id } });
    expect(apres.statut).toBe('emise');
  });

  it('annule la facture quand l’avoir couvre tout, sans l’effacer', async () => {
    const facture = await factureEmise();
    const reponse = await crediteRoute(saisieAvoir(facture.montantTTC), contexte(facture.id));
    expect(((await reponse.json()) as { factureAnnulee: boolean }).factureAnnulee).toBe(true);

    // Annulée, pas supprimée : la facture reste au livre avec son avoir en face. C'est
    // exactement la différence entre annuler et supprimer.
    const apres = await prisma.facture.findUniqueOrThrow({ where: { id: facture.id } });
    expect(apres.statut).toBe('annulee_par_avoir');
    expect(Number(apres.montantAPayerTTC)).toBeCloseTo(facture.montantTTC, 2);
  });

  it('ne crédite pas plus que la facture, même en plusieurs fois', async () => {
    const facture = await factureEmise();
    expect((await crediteRoute(saisieAvoir(100), contexte(facture.id))).status).toBe(200);

    const trop = facture.montantTTC - 100 + 0.01;
    const reponse = await crediteRoute(saisieAvoir(trop), contexte(facture.id));
    expect(reponse.status).toBe(422);

    const { problemes } = (await reponse.json()) as { problemes: { champ: string }[] };
    expect(problemes.map((p) => p.champ)).toContain('montantTTC');
    expect(await prisma.avoir.count({ where: { entrepriseId } })).toBe(1);
  });

  it('refuse de créditer une facture pas encore émise', async () => {
    const devisId = ((await (await cree()).json()) as { id: string }).id;
    await enregistreDevis(saisieDevis(), contexte(devisId));
    await envoie(vide(), contexte(devisId));
    await signe(vide(), contexte(devisId));
    const prete = (await listeFactures(entrepriseId))[0];
    if (prete === undefined) throw new Error('facture manquante');

    const reponse = await crediteRoute(saisieAvoir(10), contexte(prete.id));
    expect(reponse.status).toBe(422);
    const { problemes } = (await reponse.json()) as { problemes: { message: string }[] };
    expect(problemes[0]?.message).toContain('corrigez-la directement');
  });

  it('exige un motif en forme de phrase', async () => {
    const facture = await factureEmise();
    const reponse = await crediteRoute(saisieAvoir(10, 'erreur'), contexte(facture.id));
    expect(reponse.status).toBe(422);
    const { problemes } = (await reponse.json()) as { problemes: { champ: string }[] };
    expect(problemes.map((p) => p.champ)).toEqual(['motif']);
  });

  it('traite une saisie malformée comme une saisie invalide, pas comme une panne', async () => {
    const facture = await factureEmise();
    for (const montant of ['50', null, [], Number.POSITIVE_INFINITY]) {
      const reponse = await crediteRoute(saisieAvoir(montant), contexte(facture.id));
      expect(reponse.status).toBe(422);
    }
    expect(await prisma.avoir.count({ where: { entrepriseId } })).toBe(0);
  });

  it('numérote sans trou ni doublon, dans sa propre série', async () => {
    const facture = await factureEmise();
    const numeros: string[] = [];
    for (let rang = 0; rang < 3; rang += 1) {
      const reponse = await crediteRoute(saisieAvoir(10), contexte(facture.id));
      numeros.push(((await reponse.json()) as { numero: string }).numero);
    }
    expect(new Set(numeros).size).toBe(3);
    expect(numerotationContinue(numeros)).toBe(true);
    // La série des avoirs est la sienne : elle ne suit pas celle des factures.
    expect(numeros[0]).toMatch(/^AV-/);
  });
});

describe('état du crédit d’une facture', () => {
  it('rend les avoirs, le total crédité et ce qu’il reste', async () => {
    const facture = await factureEmise();
    await crediteRoute(saisieAvoir(30), contexte(facture.id));
    await crediteRoute(saisieAvoir(20), contexte(facture.id));

    const etat = await etatCreditFacture(entrepriseId, facture.id);
    expect(etat?.dejaCrediteTTC).toBeCloseTo(50, 2);
    expect(etat?.resteACrediterTTC).toBeCloseTo(facture.montantTTC - 50, 2);
    expect(etat?.avoirs).toHaveLength(2);
    expect(etat?.avoirs[0]?.motif).toBe(MOTIF);
  });

  it('liste les avoirs avec le numéro de la facture qu’ils corrigent', async () => {
    const facture = await factureEmise();
    await crediteRoute(saisieAvoir(30), contexte(facture.id));

    const avoirs = await listeAvoirs(entrepriseId);
    expect(avoirs).toHaveLength(1);
    expect(avoirs[0]?.factureNumero).toMatch(/^FA-\d{4}-0001$/);
  });
});

describe('ce que la base refuse elle-même', () => {
  it('un avoir ne se modifie pas', async () => {
    // Le déclencheur est la vraie garantie : il tient même si quelqu'un écrit en SQL.
    const facture = await factureEmise();
    await crediteRoute(saisieAvoir(30), contexte(facture.id));
    const avoir = await prisma.avoir.findFirstOrThrow({ where: { entrepriseId } });

    await expect(
      prisma.avoir.update({ where: { id: avoir.id }, data: { montantTTC: 1 } }),
    ).rejects.toThrow(/définitif/i);
  });

  it('un avoir ne se supprime pas : ce serait un trou dans la série', async () => {
    const facture = await factureEmise();
    await crediteRoute(saisieAvoir(30), contexte(facture.id));
    const avoir = await prisma.avoir.findFirstOrThrow({ where: { entrepriseId } });

    await expect(prisma.avoir.delete({ where: { id: avoir.id } })).rejects.toThrow(/définitif/i);
  });

  it('annuler une facture n’autorise pas à en réécrire les montants', async () => {
    // La version précédente du déclencheur ne vérifiait plus rien dès lors que la facture
    // passait à `annulee_par_avoir` : il suffisait d'annuler et de réécrire les totaux dans
    // la même instruction pour contourner tout le dispositif.
    const facture = await factureEmise();

    await expect(
      prisma.facture.update({
        where: { id: facture.id },
        data: { statut: 'annulee_par_avoir', totalTTC: 1 },
      }),
    ).rejects.toThrow(/avoir/i);
  });

  it('une facture émise ne redevient pas un brouillon', async () => {
    const facture = await factureEmise();
    await expect(
      prisma.facture.update({ where: { id: facture.id }, data: { statut: 'prete' } }),
    ).rejects.toThrow(/brouillon/i);
  });
});

describe('frontière', () => {
  it('ne crédite pas la facture d’un confrère', async () => {
    const facture = await factureEmise();
    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    session.courante = { entrepriseId: autre.id };

    const reponse = await crediteRoute(saisieAvoir(10), contexte(facture.id));
    expect(reponse.status).toBe(422);
    expect(await prisma.avoir.count({ where: { entrepriseId } })).toBe(0);
  });

  it('ne lit pas l’état de crédit d’un confrère', async () => {
    const facture = await factureEmise();
    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    expect(await etatCreditFacture(autre.id, facture.id)).toBeNull();
  });

  it('refuse une requête sans session', async () => {
    session.courante = null;
    expect((await crediteRoute(saisieAvoir(10), contexte('x'))).status).toBe(401);
  });
});
