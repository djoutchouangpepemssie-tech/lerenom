/**
 * Le parcours d'un professionnel : connexion, demandes, acceptation, refus, déclaration.
 *
 * Ce que ce test protège avant tout, c'est la frontière des coordonnées : **elles ne sortent
 * de la base qu'après acceptation**. C'est la promesse faite au client au moment du dépôt, et
 * elle ne vaut que si elle tient dans la requête, pas seulement à l'affichage.
 *
 * Il vérifie aussi deux refus qui comptent autant que les succès : un professionnel ne peut
 * pas agir sur la demande d'un autre, et un compte inconnu reçoit exactement la même réponse
 * qu'un mot de passe faux.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { TENTATIVES_CONNEXION_MAX } from '@lerenom/core';
import { hacheMotDePasse } from '@lerenom/securite';
import { POST as connecte } from './connexion/route';
import { POST as agit } from './demandes/[id]/route';
import { demandesAcceptees, demandesEnAttente } from '@/lib/espace-pro';

const MARQUE = 'test-espace-pro';
const MOT_DE_PASSE = 'le chat dort sur le toit';

let metierId = '';
let proId = '';
let autreProId = '';
let utilisateurId = '';
let demandeId = '';
let distributionId = '';
let distributionAutre = '';

/** La session du professionnel connecté, simulée au niveau du module de session. */
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

function requeteAction(id: string, corps: unknown): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/pro/demandes/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps),
    }),
    { params: Promise.resolve({ id }) },
  ];
}

function requeteConnexion(corps: unknown): Request {
  return new Request('http://localhost/api/pro/connexion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });
}

async function creeUnPro(cle: string): Promise<string> {
  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} ${cle}`,
      slug: `${MARQUE}-${cle}`,
      source: 'manuelle',
      agences: { create: { adresse: '7 rue du test', codePostal: '75011', communeId: '75111' } },
    },
    select: { id: true },
  });
  return entreprise.id;
}

/** Une demande fraîche, proposée aux deux professionnels. */
async function creeUneDemande(): Promise<void> {
  const demande = await prisma.demande.create({
    data: {
      reference: `${MARQUE}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'partagee',
      statut: 'en_distribution',
      metierId,
      communeId: '75111',
      description: 'Serrure bloquée, porte d’entrée, impossible de rentrer.',
      urgence: 'rapide',
      clientPrenom: 'Camille',
      clientEmail: 'camille.pro@exemple.test',
      clientTelephone: '+33699999991',
      adresse: '12 rue de la Roquette',
      telephoneVerifieLe: new Date(),
      consentementTexte: 'Consentement de test.',
      consentementDonneLe: new Date(),
      objectifPros: 3,
    },
    select: { id: true },
  });
  demandeId = demande.id;

  const echeance = new Date(Date.now() + 2 * 3_600_000);
  const mienne = await prisma.distribution.create({
    data: {
      demandeId,
      entrepriseId: proId,
      rang: 1,
      tour: 1,
      raisonRang: 'score_et_proximite',
      echeanceLe: echeance,
    },
    select: { id: true },
  });
  distributionId = mienne.id;

  const autre = await prisma.distribution.create({
    data: {
      demandeId,
      entrepriseId: autreProId,
      rang: 2,
      tour: 1,
      raisonRang: 'score_et_proximite',
      echeanceLe: echeance,
    },
    select: { id: true },
  });
  distributionAutre = autre.id;
}

beforeAll(async () => {
  process.env['SECRET_VERIFICATION'] ??= 'secret-de-test-strictement-local-et-assez-long';
  await nettoieLesDonneesDeTest(MARQUE);

  const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });
  metierId = metier.id;

  proId = await creeUnPro('moi');
  autreProId = await creeUnPro('voisin');

  const utilisateur = await prisma.utilisateurPro.create({
    data: {
      entrepriseId: proId,
      email: `${MARQUE}@exemple.test`,
      nom: 'Jean Test',
      motDePasseHash: await hacheMotDePasse(MOT_DE_PASSE),
    },
    select: { id: true },
  });
  utilisateurId = utilisateur.id;
});

beforeEach(async () => {
  session.courante = { entrepriseId: proId };
  await prisma.suiviDemande.deleteMany({ where: { demandeId } });
  await prisma.distribution.deleteMany({ where: { demandeId } });
  await prisma.demande.deleteMany({ where: { id: demandeId } });
  await prisma.quotaMensuel.deleteMany({ where: { entrepriseId: { in: [proId, autreProId] } } });
  await creeUneDemande();
});

afterAll(async () => {
  await prisma.sessionPro.deleteMany({ where: { utilisateurId } });
  await prisma.utilisateurPro.deleteMany({ where: { entrepriseId: proId } });
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

describe('connexion', () => {
  it('refuse une adresse inconnue et un mot de passe faux avec le même message', async () => {
    const inconnue = await connecte(
      requeteConnexion({ email: 'personne@exemple.test', motDePasse: MOT_DE_PASSE }),
    );
    const fausse = await connecte(
      requeteConnexion({ email: `${MARQUE}@exemple.test`, motDePasse: 'je ne sais plus du tout' }),
    );

    expect(inconnue.status).toBe(401);
    expect(fausse.status).toBe(401);
    // Même message : on ne révèle pas qui est inscrit sur Le Renom.
    expect(await inconnue.json()).toEqual(await fausse.json());
  });

  it('verrouille après plusieurs échecs, puis le dit clairement', async () => {
    for (let essai = 0; essai < TENTATIVES_CONNEXION_MAX; essai += 1) {
      await connecte(
        requeteConnexion({ email: `${MARQUE}@exemple.test`, motDePasse: 'mauvais mot de passe' }),
      );
    }

    const bloquee = await connecte(
      requeteConnexion({ email: `${MARQUE}@exemple.test`, motDePasse: MOT_DE_PASSE }),
    );
    expect(bloquee.status).toBe(429);
    const corps = (await bloquee.json()) as { minutesRestantes: number };
    expect(corps.minutesRestantes).toBeGreaterThan(0);

    // Le verrou se lève tout seul : un compte bloqué pour de bon serait une arme contre son
    // titulaire. On simule l'attente en reculant la dernière tentative.
    await prisma.utilisateurPro.update({
      where: { id: utilisateurId },
      data: { derniereTentativeLe: new Date(Date.now() - 20 * 60_000) },
    });

    const reussie = await connecte(
      requeteConnexion({ email: `${MARQUE}@exemple.test`, motDePasse: MOT_DE_PASSE }),
    );
    expect(reussie.status).toBe(200);

    const apres = await prisma.utilisateurPro.findUniqueOrThrow({
      where: { id: utilisateurId },
      select: { tentativesConnexion: true },
    });
    expect(apres.tentativesConnexion).toBe(0);
  });

  it('refuse un compte dont l’entreprise est suspendue', async () => {
    await prisma.entreprise.update({ where: { id: proId }, data: { suspendue: true } });
    const reponse = await connecte(
      requeteConnexion({ email: `${MARQUE}@exemple.test`, motDePasse: MOT_DE_PASSE }),
    );
    expect(reponse.status).toBe(403);
    await prisma.entreprise.update({ where: { id: proId }, data: { suspendue: false } });
  });
});

describe('avant acceptation', () => {
  it('ne laisse sortir aucune coordonnée du client', async () => {
    const enAttente = await demandesEnAttente(proId);
    expect(enAttente).toHaveLength(1);

    const serialise = JSON.stringify(enAttente);
    expect(serialise).not.toContain('+33699999991');
    expect(serialise).not.toContain('camille.pro@exemple.test');
    expect(serialise).not.toContain('Camille');
    expect(serialise).not.toContain('12 rue de la Roquette');
  });

  it('montre tout de même ce qu’il faut pour décider', async () => {
    const [demande] = await demandesEnAttente(proId);
    expect(demande?.ville).toBe('Paris 11e');
    expect(demande?.description).toContain('Serrure bloquée');
    expect(demande?.raisonRang).toBe('Votre score et votre proximité');
  });
});

describe('acceptation et refus', () => {
  it('accepte, facture, et ouvre les coordonnées', async () => {
    const reponse = await agit(...requeteAction(distributionId, { action: 'accepter' }));
    expect(reponse.status).toBe(200);

    const acceptees = await demandesAcceptees(proId);
    expect(acceptees).toHaveLength(1);
    expect(acceptees[0]?.clientTelephone).toBe('+33699999991');
    expect(acceptees[0]?.clientPrenom).toBe('Camille');
    expect(acceptees[0]?.adresse).toBe('12 rue de la Roquette');

    // La demande sort de la boîte « à répondre ».
    expect(await demandesEnAttente(proId)).toHaveLength(0);
  });

  it('refuse une seconde acceptation de la même proposition', async () => {
    await agit(...requeteAction(distributionId, { action: 'accepter' }));
    const seconde = await agit(...requeteAction(distributionId, { action: 'accepter' }));
    expect(seconde.status).toBe(409);
  });

  it('refuse gratuitement, avec un motif, et sans rien facturer', async () => {
    const reponse = await agit(
      ...requeteAction(distributionId, { action: 'refuser', motif: 'trop-loin' }),
    );
    expect(reponse.status).toBe(200);

    const distribution = await prisma.distribution.findUniqueOrThrow({
      where: { id: distributionId },
    });
    expect(distribution.statut).toBe('refusee');
    expect(distribution.motifRefus).toBe('trop_loin');
    expect(Number(distribution.montantHT)).toBe(0);
    expect(distribution.consommeForfait).toBe(false);
  });

  it('exige un motif de refus connu', async () => {
    const reponse = await agit(
      ...requeteAction(distributionId, { action: 'refuser', motif: 'je ne veux pas' }),
    );
    expect(reponse.status).toBe(400);
  });
});

describe('cloisonnement entre professionnels', () => {
  it('ne laisse pas un pro agir sur la demande d’un autre', async () => {
    const reponse = await agit(...requeteAction(distributionAutre, { action: 'accepter' }));
    expect(reponse.status).toBe(404);

    const distribution = await prisma.distribution.findUniqueOrThrow({
      where: { id: distributionAutre },
    });
    expect(distribution.statut).toBe('envoyee');
  });

  it('refuse toute action sans session', async () => {
    session.courante = null;
    const reponse = await agit(...requeteAction(distributionId, { action: 'accepter' }));
    expect(reponse.status).toBe(401);
  });
});

describe('déclaration des travaux', () => {
  it('n’est possible qu’après acceptation', async () => {
    const avant = await agit(...requeteAction(distributionId, { action: 'declarer-travaux' }));
    expect(avant.status).toBe(409);

    await agit(...requeteAction(distributionId, { action: 'accepter' }));
    const apres = await agit(...requeteAction(distributionId, { action: 'declarer-travaux' }));
    expect(apres.status).toBe(200);

    const suivi = await prisma.suiviDemande.findFirstOrThrow({
      where: { demandeId, etape: 'travaux_realises' },
    });
    // L'origine est tracée : c'est elle qui fait foi pour la mention « avis vérifié ».
    expect(suivi.declarePar).toBe('pro');
  });

  it('ne déclare pas deux fois', async () => {
    await agit(...requeteAction(distributionId, { action: 'accepter' }));
    await agit(...requeteAction(distributionId, { action: 'declarer-travaux' }));
    await agit(...requeteAction(distributionId, { action: 'declarer-travaux' }));

    const suivis = await prisma.suiviDemande.count({
      where: { demandeId, etape: 'travaux_realises' },
    });
    expect(suivis).toBe(1);
  });
});
