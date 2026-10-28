/**
 * « L'intervention a-t-elle eu lieu ? », du clic du client à l'avis.
 *
 * C'est le verrou qui manquait : sans cette question, seul le professionnel pouvait déclarer
 * ses chantiers, et celui qui ne déclarait jamais rien n'avait jamais de mauvais avis. Ce test
 * vérifie que le chemin existe, qu'il est tracé, et qu'il ne s'ouvre pas plus large qu'il ne
 * faut.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { creeLien, resoudLien } from '@lerenom/liens';
import { POST as agit } from './[jeton]/route';

const MARQUE = 'test-confirmation';

let demandeId = '';
let proId = '';
let distributionId = '';

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

/** Un lien de confirmation neuf : chaque scénario repart d'une porte ouverte. */
async function jetonNeuf(): Promise<string> {
  return (await creeLien(demandeId, 'confirmer_intervention', proId)).jeton;
}

beforeAll(async () => {
  process.env['SECRET_VERIFICATION'] ??= 'secret-de-test-strictement-local-et-assez-long';
  await nettoieLesDonneesDeTest(MARQUE);

  const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });

  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} pro`,
      slug: `${MARQUE}-pro`,
      source: 'manuelle',
      agences: { create: { adresse: '5 rue du test', codePostal: '75011', communeId: '75111' } },
    },
    select: { id: true },
  });
  proId = entreprise.id;

  const demande = await prisma.demande.create({
    data: {
      reference: `${MARQUE}-${Date.now()}`,
      type: 'partagee',
      statut: 'complete',
      metierId: metier.id,
      communeId: '75111',
      description: 'Serrure à changer après effraction.',
      urgence: 'normale',
      clientPrenom: 'Camille',
      clientEmail: 'camille@exemple.test',
      clientTelephone: '+33699999994',
      telephoneVerifieLe: new Date(),
      consentementTexte: 'Consentement de test.',
      consentementDonneLe: new Date(),
      objectifPros: 3,
    },
    select: { id: true },
  });
  demandeId = demande.id;

  const distribution = await prisma.distribution.create({
    data: {
      demandeId,
      entrepriseId: proId,
      rang: 1,
      tour: 1,
      raisonRang: 'score_et_proximite',
      statut: 'acceptee',
      echeanceLe: new Date(Date.now() + 3_600_000),
      repondueLe: new Date(Date.now() - 8 * 24 * 3_600_000),
    },
    select: { id: true },
  });
  distributionId = distribution.id;
});

beforeEach(async () => {
  // Chaque scénario part d'un dossier vierge de toute déclaration.
  await prisma.suiviDemande.deleteMany({ where: { demandeId } });
  await prisma.alerte.deleteMany({ where: { objetId: distributionId } });
  await prisma.avis.deleteMany({ where: { demandeId } });
  await prisma.lienAction.deleteMany({ where: { demandeId } });
});

afterAll(async () => {
  await prisma.alerte.deleteMany({ where: { objetId: distributionId } });
  await prisma.avis.deleteMany({ where: { demandeId } });
  await prisma.lienAction.deleteMany({ where: { demandeId } });
  await prisma.suiviDemande.deleteMany({ where: { demandeId } });
  await prisma.distribution.deleteMany({ where: { demandeId } });
  await prisma.demande.deleteMany({ where: { id: demandeId } });
  await prisma.entreprise.deleteMany({ where: { id: proId } });
  await prisma.$disconnect();
});

describe('réponse « oui »', () => {
  it('déclare les travaux au nom du client, et ouvre le dépôt d’avis', async () => {
    const jeton = await jetonNeuf();
    const reponse = await agit(
      ...requete(jeton, { action: 'confirmer-intervention', reponse: 'oui' }),
    );
    expect(reponse.status).toBe(200);

    const corps = (await reponse.json()) as { enregistre: boolean; jetonAvis?: string };
    expect(corps.enregistre).toBe(true);
    expect(corps.jetonAvis).toBeDefined();

    const suivi = await prisma.suiviDemande.findFirstOrThrow({ where: { demandeId } });
    expect(suivi.etape).toBe('travaux_realises');
    // L'origine de la déclaration est tracée : c'est elle qui fait foi dans un litige.
    expect(suivi.declarePar).toBe('client');

    // Le jeton rendu ouvre bien le dépôt d'avis, et rien d'autre.
    const resolu = await resoudLien(corps.jetonAvis ?? '');
    expect(resolu.issue).toBe('valide');
    if (resolu.issue !== 'valide') return;
    expect(resolu.lien.action).toBe('deposer_avis');
    expect(resolu.lien.demandeId).toBe(demandeId);
    expect(resolu.lien.cibleId).toBe(proId);
  });

  it('enchaîne réellement sur un avis déposable', async () => {
    const jeton = await jetonNeuf();
    const reponse = await agit(
      ...requete(jeton, { action: 'confirmer-intervention', reponse: 'oui' }),
    );
    const { jetonAvis } = (await reponse.json()) as { jetonAvis: string };

    const depot = await agit(
      ...requete(jetonAvis, {
        action: 'deposer-avis',
        note: 5,
        commentaire: 'Parfait du début à la fin.',
      }),
    );
    expect(depot.status).toBe(200);

    const avis = await prisma.avis.findUniqueOrThrow({ where: { demandeId } });
    expect(avis.statut).toBe('en_attente');
    expect(avis.entrepriseId).toBe(proId);
  });
});

describe('réponse « pas encore »', () => {
  it('ne déclare rien : le worker reposera la question', async () => {
    const jeton = await jetonNeuf();
    const reponse = await agit(
      ...requete(jeton, { action: 'confirmer-intervention', reponse: 'pas-encore' }),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ enregistre: true });

    expect(await prisma.suiviDemande.count({ where: { demandeId } })).toBe(0);
  });
});

describe('réponse « non »', () => {
  it('marque le dossier perdu et alerte le back-office', async () => {
    const jeton = await jetonNeuf();
    const reponse = await agit(
      ...requete(jeton, {
        action: 'confirmer-intervention',
        reponse: 'non',
        motif: 'Il n’est jamais venu malgré deux rendez-vous.',
      }),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ enregistre: true });

    const suivi = await prisma.suiviDemande.findFirstOrThrow({ where: { demandeId } });
    expect(suivi.etape).toBe('perdue');
    expect(suivi.declarePar).toBe('client');
    expect(suivi.commentaire).toContain('jamais venu');

    const alerte = await prisma.alerte.findFirstOrThrow({
      where: { type: 'intervention_non_realisee', objetId: distributionId },
    });
    expect(alerte.gravite).toBe('moyenne');
    expect(alerte.explication).toContain('jamais venu');
  });

  it('ne rouvre pas le dépôt d’avis : rien n’a eu lieu, il n’y a rien à noter', async () => {
    const jeton = await jetonNeuf();
    const reponse = await agit(
      ...requete(jeton, { action: 'confirmer-intervention', reponse: 'non' }),
    );
    const corps = (await reponse.json()) as { jetonAvis?: string };
    expect(corps.jetonAvis).toBeUndefined();
  });
});

describe('portée du lien', () => {
  it('refuse qu’un lien de confirmation serve à annuler la demande', async () => {
    const jeton = await jetonNeuf();
    const reponse = await agit(...requete(jeton, { action: 'annuler' }));
    expect(reponse.status).toBe(403);
  });

  it('refuse qu’un lien de suivi serve à confirmer une intervention', async () => {
    const suivi = (await creeLien(demandeId, 'voir_pros')).jeton;
    const reponse = await agit(
      ...requete(suivi, { action: 'confirmer-intervention', reponse: 'oui' }),
    );
    expect(reponse.status).toBe(403);
    expect(await prisma.suiviDemande.count({ where: { demandeId } })).toBe(0);
  });

  it('refuse une réponse qui n’est pas l’une des trois', async () => {
    const jeton = await jetonNeuf();
    const reponse = await agit(
      ...requete(jeton, { action: 'confirmer-intervention', reponse: 'peut-etre' }),
    );
    expect(reponse.status).toBe(400);
  });

  it('se ferme après usage : on ne revient pas changer sa réponse', async () => {
    const jeton = await jetonNeuf();
    await agit(...requete(jeton, { action: 'confirmer-intervention', reponse: 'oui' }));
    const seconde = await agit(
      ...requete(jeton, { action: 'confirmer-intervention', reponse: 'non' }),
    );
    expect(seconde.status).toBe(410);

    const suivi = await prisma.suiviDemande.findFirstOrThrow({ where: { demandeId } });
    expect(suivi.etape).toBe('travaux_realises');
  });
});
