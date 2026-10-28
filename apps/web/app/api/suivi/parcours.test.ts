/**
 * Le parcours du client après le dépôt : son lien de suivi, ce qu'il voit, ce qu'il peut faire.
 *
 * Deux promesses sont vérifiées ici, et elles ne peuvent l'être qu'avec une vraie base :
 *   * les coordonnées d'un professionnel **qui n'a pas accepté** ne sortent jamais de la
 *     requête — pas même pour être cachées à l'affichage ;
 *   * annuler retire les propositions en attente sans toucher à celles qui ont été acceptées,
 *     parce que ces dernières ont été facturées.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@lerenom/db';
import { creeLien, resoudLien } from '@lerenom/liens';
import { expirationLien } from '@lerenom/core';
import { empreinteJeton, tireJeton } from '@lerenom/securite';
import { suiviDeLaDemande } from '@/lib/suivi';
import { POST as agit } from './[jeton]/route';

const MARQUE = 'test-suivi';

let demandeId = '';
let proAccepteId = '';
let proEnAttenteId = '';
let jetonSuivi = '';

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

async function creeUnPro(cle: string, telephone: string): Promise<string> {
  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} ${cle}`,
      slug: `${MARQUE}-${cle}`,
      source: 'manuelle',
      revendiquee: true,
      noteMoyenne: 4.7,
      nombreAvis: 12,
      fiche: { create: { telephone, email: `${cle}@exemple.test` } },
      agences: {
        create: {
          adresse: '2 rue du test',
          codePostal: '75011',
          communeId: '75111',
          contactTelephone: telephone,
          contactEmail: `${cle}@exemple.test`,
        },
      },
    },
    select: { id: true },
  });
  return entreprise.id;
}

beforeAll(async () => {
  process.env['SECRET_VERIFICATION'] ??= 'secret-de-test-strictement-local-et-assez-long';

  const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });
  const prestation = await prisma.prestation.findFirstOrThrow({
    where: { slug: 'serrurier--ouverture-de-porte-claquee' },
  });

  proAccepteId = await creeUnPro('accepte', '+33611111111');
  proEnAttenteId = await creeUnPro('en-attente', '+33622222222');

  const demande = await prisma.demande.create({
    data: {
      reference: `${MARQUE}-${Date.now()}`,
      type: 'partagee',
      statut: 'en_distribution',
      metierId: metier.id,
      prestationId: prestation.id,
      communeId: '75111',
      description: 'Porte claquée, je suis sur le palier.',
      urgence: 'rapide',
      clientPrenom: 'Camille',
      clientEmail: 'camille@exemple.test',
      clientTelephone: '+33699999998',
      telephoneVerifieLe: new Date(),
      consentementTexte: 'Consentement de test.',
      consentementDonneLe: new Date(),
      objectifPros: 3,
    },
    select: { id: true },
  });
  demandeId = demande.id;

  const echeance = new Date(Date.now() + 2 * 3_600_000);
  await prisma.distribution.createMany({
    data: [
      {
        demandeId,
        entrepriseId: proAccepteId,
        rang: 1,
        tour: 1,
        raisonRang: 'score_et_proximite',
        statut: 'acceptee',
        echeanceLe: echeance,
        repondueLe: new Date(),
      },
      {
        demandeId,
        entrepriseId: proEnAttenteId,
        rang: 2,
        tour: 1,
        raisonRang: 'score_et_proximite',
        statut: 'envoyee',
        echeanceLe: echeance,
      },
    ],
  });

  jetonSuivi = (await creeLien(demandeId, 'voir_pros')).jeton;
});

afterAll(async () => {
  const ids = [proAccepteId, proEnAttenteId];
  await prisma.lienAction.deleteMany({ where: { demandeId } });
  await prisma.messageSortant.deleteMany({ where: { demandeId } });
  await prisma.distribution.deleteMany({ where: { demandeId } });
  await prisma.demande.deleteMany({ where: { id: demandeId } });
  await prisma.entreprise.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('le lien de suivi', () => {
  it('se résout, et désigne la bonne demande', async () => {
    const resolution = await resoudLien(jetonSuivi);
    expect(resolution.issue).toBe('valide');
    if (resolution.issue !== 'valide') return;
    expect(resolution.lien.demandeId).toBe(demandeId);
    expect(resolution.lien.action).toBe('voir_pros');
  });

  it('ne conserve jamais le jeton en clair en base', async () => {
    const lien = await prisma.lienAction.findFirstOrThrow({ where: { demandeId } });
    expect(lien.jeton).not.toBe(jetonSuivi);
    expect(lien.jeton).toHaveLength(64);
  });

  it('refuse un jeton mal formé sans toucher la base', async () => {
    expect(await resoudLien('pas-un-jeton')).toEqual({ issue: 'inconnu' });
  });

  it('refuse un jeton bien formé mais inconnu', async () => {
    expect(await resoudLien(tireJeton())).toEqual({ issue: 'inconnu' });
  });

  it('refuse un lien expiré', async () => {
    const jeton = tireJeton();
    await prisma.lienAction.create({
      data: {
        demandeId,
        jeton: empreinteJeton(jeton, process.env['SECRET_VERIFICATION'] ?? ''),
        action: 'voir_pros',
        expireLe: new Date(Date.now() - 1_000),
      },
    });
    expect(await resoudLien(jeton)).toEqual({ issue: 'expire' });
  });

  it('ouvre les liens de suivi longtemps, bien après la fenêtre d’annulation', () => {
    const maintenant = new Date();
    const suivi = expirationLien('voir_pros', maintenant).getTime();
    const annulation = expirationLien('annuler_demande', maintenant).getTime();
    expect(suivi).toBeGreaterThan(annulation);
  });
});

describe('ce que le client voit', () => {
  it('montre les coordonnées du pro qui a accepté', async () => {
    const suivi = await suiviDeLaDemande(demandeId);
    expect(suivi).not.toBeNull();
    expect(suivi?.pros).toHaveLength(1);
    expect(suivi?.pros[0]?.telephone).toBe('+33611111111');
    expect(suivi?.pros[0]?.note).toBe(4.7);
  });

  it('ne laisse pas fuiter le pro qui n’a pas encore répondu', async () => {
    const suivi = await suiviDeLaDemande(demandeId);
    const serialise = JSON.stringify(suivi);
    expect(serialise).not.toContain('+33622222222');
    expect(serialise).not.toContain(`${MARQUE} en-attente`);
    // Il est compté, mais jamais nommé : le client sait que ça avance, sans savoir qui.
    expect(suivi?.enAttenteDeReponse).toBe(1);
    expect(suivi?.nombreSollicites).toBe(2);
  });
});

describe('annulation', () => {
  it('refuse un jeton inconnu', async () => {
    const reponse = await agit(...requete(tireJeton(), { action: 'annuler' }));
    expect(reponse.status).toBe(410);
  });

  it('refuse une action qui n’existe pas', async () => {
    const reponse = await agit(...requete(jetonSuivi, { action: 'supprimer-tout' }));
    expect(reponse.status).toBe(400);
  });

  it('annule, retire les propositions en attente et laisse les acceptées', async () => {
    const reponse = await agit(
      ...requete(jetonSuivi, { action: 'annuler', motif: 'J’ai trouvé quelqu’un' }),
    );
    expect(reponse.status).toBe(200);

    const demande = await prisma.demande.findUniqueOrThrow({
      where: { id: demandeId },
      select: { statut: true, annuleeLe: true, motifAnnulation: true, clotureeLe: true },
    });
    expect(demande.statut).toBe('annulee');
    expect(demande.annuleeLe).not.toBeNull();
    expect(demande.clotureeLe).not.toBeNull();
    expect(demande.motifAnnulation).toBe('J’ai trouvé quelqu’un');

    const distributions = await prisma.distribution.findMany({
      where: { demandeId },
      select: { entrepriseId: true, statut: true },
    });
    const parPro = new Map(distributions.map((d) => [d.entrepriseId, d.statut]));
    // Le pro qui a accepté a payé : on ne lui reprend rien.
    expect(parPro.get(proAccepteId)).toBe('acceptee');
    // Celui qui n'a pas répondu n'a rien refusé : « retirée », pas « refusée ».
    expect(parPro.get(proEnAttenteId)).toBe('retiree');
  });

  it('reste idempotent : annuler deux fois ne casse rien', async () => {
    const reponse = await agit(...requete(jetonSuivi, { action: 'annuler' }));
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toMatchObject({ dejaAnnulee: true });
  });

  it('montre la demande annulée dans le suivi, sans perdre le pro qui a accepté', async () => {
    const suivi = await suiviDeLaDemande(demandeId);
    expect(suivi?.statut).toBe('annulee');
    expect(suivi?.annuleeLe).not.toBeNull();
    expect(suivi?.pros).toHaveLength(1);
  });
});
