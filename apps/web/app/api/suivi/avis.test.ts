/**
 * Le dépôt d'un avis, de l'invitation à la pile de modération.
 *
 * Trois promesses publiques sont vérifiées ici, et chacune ne peut l'être que contre une vraie
 * base :
 *   * un avis **ne peut venir que d'une intervention réellement effectuée** — c'est ce qui
 *     autorise la mention « avis vérifié » ;
 *   * un lien de suivi ne dépose pas d'avis, et un lien d'avis n'annule rien ;
 *   * **aucun avis n'est publié d'emblée** : il entre en attente, et il est relu.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@lerenom/db';
import { creeLien } from '@lerenom/liens';
import { contexteAvis } from '@/lib/avis';
import { POST as agit } from './[jeton]/route';

const MARQUE = 'test-avis';

let demandeId = '';
let proId = '';
let autreProId = '';
let jetonAvis = '';
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

async function creeUnPro(cle: string): Promise<string> {
  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} ${cle}`,
      slug: `${MARQUE}-${cle}`,
      source: 'manuelle',
      agences: { create: { adresse: '3 rue du test', codePostal: '75011', communeId: '75111' } },
    },
    select: { id: true },
  });
  return entreprise.id;
}

beforeAll(async () => {
  process.env['SECRET_VERIFICATION'] ??= 'secret-de-test-strictement-local-et-assez-long';

  const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });
  proId = await creeUnPro('intervenu');
  autreProId = await creeUnPro('jamais-venu');

  const demande = await prisma.demande.create({
    data: {
      reference: `${MARQUE}-${Date.now()}`,
      type: 'partagee',
      statut: 'complete',
      metierId: metier.id,
      communeId: '75111',
      description: 'Serrure changée après effraction.',
      urgence: 'normale',
      clientPrenom: 'Camille',
      clientEmail: 'camille@exemple.test',
      clientTelephone: '+33699999997',
      telephoneVerifieLe: new Date(),
      consentementTexte: 'Consentement de test.',
      consentementDonneLe: new Date(),
      objectifPros: 3,
    },
    select: { id: true },
  });
  demandeId = demande.id;

  await prisma.distribution.create({
    data: {
      demandeId,
      entrepriseId: proId,
      rang: 1,
      tour: 1,
      raisonRang: 'score_et_proximite',
      statut: 'acceptee',
      echeanceLe: new Date(Date.now() + 3_600_000),
      repondueLe: new Date(),
    },
  });

  jetonAvis = (await creeLien(demandeId, 'deposer_avis', proId)).jeton;
  jetonSuivi = (await creeLien(demandeId, 'voir_pros')).jeton;
});

afterAll(async () => {
  await prisma.tacheAValider.deleteMany({
    where: {
      objetId: {
        in: (await prisma.avis.findMany({ where: { demandeId }, select: { id: true } })).map(
          (a) => a.id,
        ),
      },
    },
  });
  await prisma.avis.deleteMany({ where: { demandeId } });
  await prisma.lienAction.deleteMany({ where: { demandeId } });
  await prisma.suiviDemande.deleteMany({ where: { demandeId } });
  await prisma.distribution.deleteMany({ where: { demandeId } });
  await prisma.demande.deleteMany({ where: { id: demandeId } });
  await prisma.entreprise.deleteMany({ where: { id: { in: [proId, autreProId] } } });
  await prisma.$disconnect();
});

describe('avant les travaux', () => {
  it('refuse le dépôt tant que l’intervention n’est pas déclarée réalisée', async () => {
    const reponse = await agit(...requete(jetonAvis, { action: 'deposer-avis', note: 5 }));
    expect(reponse.status).toBe(409);
    expect(await prisma.avis.count({ where: { demandeId } })).toBe(0);
  });

  it('le dit aussi à la page, plutôt que d’afficher un formulaire inutile', async () => {
    const contexte = await contexteAvis(demandeId, proId);
    expect(contexte?.droit).toEqual({ issue: 'travaux-non-realises' });
  });

  it('ne connaît pas un professionnel qui n’est jamais intervenu', async () => {
    expect(await contexteAvis(demandeId, autreProId)).toBeNull();
  });
});

describe('après les travaux', () => {
  beforeAll(async () => {
    await prisma.suiviDemande.create({
      data: { demandeId, entrepriseId: proId, etape: 'travaux_realises' },
    });
  });

  it('ouvre le formulaire sur le bon professionnel', async () => {
    const contexte = await contexteAvis(demandeId, proId);
    expect(contexte?.droit).toEqual({ issue: 'peut-deposer' });
    expect(contexte?.nomPro).toBe(`${MARQUE} intervenu`);
    expect(contexte?.prenom).toBe('Camille');
  });

  it('refuse une note hors bornes', async () => {
    const reponse = await agit(...requete(jetonAvis, { action: 'deposer-avis', note: 9 }));
    expect(reponse.status).toBe(400);
  });

  it('refuse qu’un lien d’avis serve à annuler la demande', async () => {
    const reponse = await agit(...requete(jetonAvis, { action: 'annuler' }));
    expect(reponse.status).toBe(403);
    const demande = await prisma.demande.findUniqueOrThrow({
      where: { id: demandeId },
      select: { annuleeLe: true },
    });
    expect(demande.annuleeLe).toBeNull();
  });

  it('refuse qu’un lien de suivi serve à déposer un avis', async () => {
    const reponse = await agit(...requete(jetonSuivi, { action: 'deposer-avis', note: 5 }));
    expect(reponse.status).toBe(403);
    expect(await prisma.avis.count({ where: { demandeId } })).toBe(0);
  });

  it('enregistre l’avis en attente, jamais publié d’emblée', async () => {
    const reponse = await agit(
      ...requete(jetonAvis, {
        action: 'deposer-avis',
        note: 4,
        criteres: { qualite: 5, delai: 3, proprete: 4, prix: 4 },
        commentaire: 'Intervention rapide, travail soigné, un peu de retard le matin.',
      }),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ depose: true });

    const avis = await prisma.avis.findUniqueOrThrow({ where: { demandeId } });
    expect(avis.statut).toBe('en_attente');
    expect(avis.publieLe).toBeNull();
    expect(avis.note).toBe(4);
    expect(avis.entrepriseId).toBe(proId);
    expect(avis.auteurPrenom).toBe('Camille');
    expect(avis.criteres).toEqual({ qualite: 5, delai: 3, proprete: 4, prix: 4 });

    // Une tâche attend un relecteur : aucun avis ne passe sans œil humain.
    const tache = await prisma.tacheAValider.findFirstOrThrow({
      where: { type: 'avis_a_moderer', objetId: avis.id },
    });
    expect(tache.explication).toContain('Aucun signal automatique');

    // Le lien est consommé : un avis ne se dépose pas deux fois.
    const lien = await prisma.lienAction.findFirstOrThrow({
      where: { demandeId, action: 'deposer_avis' },
    });
    expect(lien.utiliseLe).not.toBeNull();
  });

  it('ferme le lien après usage : on ne revient pas changer sa note', async () => {
    const reponse = await agit(...requete(jetonAvis, { action: 'deposer-avis', note: 2 }));
    // Le lien est consommé : la porte se ferme avant même d'examiner la saisie.
    expect(reponse.status).toBe(410);
    expect(await prisma.avis.count({ where: { demandeId } })).toBe(1);
    const avis = await prisma.avis.findUniqueOrThrow({ where: { demandeId } });
    expect(avis.note).toBe(4);
  });

  it('résiste à deux envois simultanés, avant même que le lien soit consommé', async () => {
    // Le garde du lien ne suffit pas : deux requêtes parties ensemble le franchissent toutes
    // les deux. C'est « une demande, un avis » en base qui tranche, et la réponse reste
    // aimable — un double clic n'est pas une faute du client.
    const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });
    const demande = await prisma.demande.create({
      data: {
        reference: `${MARQUE}-course-${Date.now()}`,
        type: 'partagee',
        statut: 'complete',
        metierId: metier.id,
        communeId: '75111',
        description: 'Dossier de test pour le double clic.',
        urgence: 'normale',
        clientPrenom: 'Alix',
        clientEmail: 'alix@exemple.test',
        clientTelephone: '+33699999995',
        telephoneVerifieLe: new Date(),
        consentementTexte: 'Consentement de test.',
        consentementDonneLe: new Date(),
        objectifPros: 3,
      },
      select: { id: true },
    });
    await prisma.distribution.create({
      data: {
        demandeId: demande.id,
        entrepriseId: proId,
        rang: 1,
        tour: 1,
        raisonRang: 'score_et_proximite',
        statut: 'acceptee',
        echeanceLe: new Date(Date.now() + 3_600_000),
        repondueLe: new Date(),
      },
    });
    await prisma.suiviDemande.create({
      data: { demandeId: demande.id, entrepriseId: proId, etape: 'travaux_realises' },
    });

    const jeton = (await creeLien(demande.id, 'deposer_avis', proId)).jeton;
    await agit(...requete(jeton, { action: 'deposer-avis', note: 5 }));

    // On rouvre le lien pour rejouer exactement la seconde requête de la paire.
    await prisma.lienAction.updateMany({
      where: { demandeId: demande.id, action: 'deposer_avis' },
      data: { utiliseLe: null },
    });

    const seconde = await agit(...requete(jeton, { action: 'deposer-avis', note: 1 }));
    expect(seconde.status).toBe(200);
    expect(await seconde.json()).toMatchObject({ dejaDepose: true });
    expect(await prisma.avis.count({ where: { demandeId: demande.id } })).toBe(1);

    const avis = await prisma.avis.findUniqueOrThrow({ where: { demandeId: demande.id } });
    expect(avis.note).toBe(5);

    await prisma.tacheAValider.deleteMany({ where: { objetId: avis.id } });
    await prisma.avis.deleteMany({ where: { demandeId: demande.id } });
    await prisma.lienAction.deleteMany({ where: { demandeId: demande.id } });
    await prisma.suiviDemande.deleteMany({ where: { demandeId: demande.id } });
    await prisma.distribution.deleteMany({ where: { demandeId: demande.id } });
    await prisma.demande.deleteMany({ where: { id: demande.id } });
  });
});

describe('signaux de modération', () => {
  it('consigne ce qui mérite un œil, sans rien refuser automatiquement', async () => {
    // Un second dossier, pour un avis chargé en signaux.
    const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });
    const demande = await prisma.demande.create({
      data: {
        reference: `${MARQUE}-signaux-${Date.now()}`,
        type: 'partagee',
        statut: 'complete',
        metierId: metier.id,
        communeId: '75111',
        description: 'Second dossier de test.',
        urgence: 'normale',
        clientPrenom: 'Dominique',
        clientEmail: 'dominique@exemple.test',
        clientTelephone: '+33699999996',
        telephoneVerifieLe: new Date(),
        consentementTexte: 'Consentement de test.',
        consentementDonneLe: new Date(),
        objectifPros: 3,
      },
      select: { id: true },
    });

    await prisma.distribution.create({
      data: {
        demandeId: demande.id,
        entrepriseId: proId,
        rang: 1,
        tour: 1,
        raisonRang: 'score_et_proximite',
        statut: 'acceptee',
        echeanceLe: new Date(Date.now() + 3_600_000),
        repondueLe: new Date(),
      },
    });
    await prisma.suiviDemande.create({
      data: { demandeId: demande.id, entrepriseId: proId, etape: 'travaux_realises' },
    });

    const jeton = (await creeLien(demande.id, 'deposer_avis', proId)).jeton;
    const reponse = await agit(
      ...requete(jeton, {
        action: 'deposer-avis',
        note: 1,
        commentaire: 'Une arnaque, appelez-moi au 06 12 34 56 78 pour que je vous raconte.',
      }),
    );
    expect(reponse.status).toBe(200);

    const avis = await prisma.avis.findUniqueOrThrow({ where: { demandeId: demande.id } });
    // L'avis est enregistré malgré les signaux : c'est un humain qui tranchera.
    expect(avis.statut).toBe('en_attente');

    const tache = await prisma.tacheAValider.findFirstOrThrow({
      where: { type: 'avis_a_moderer', objetId: avis.id },
    });
    expect(tache.explication).toContain('accusation-grave');
    expect(tache.explication).toContain('coordonnees-telephoniques');

    await prisma.tacheAValider.deleteMany({ where: { objetId: avis.id } });
    await prisma.avis.deleteMany({ where: { demandeId: demande.id } });
    await prisma.lienAction.deleteMany({ where: { demandeId: demande.id } });
    await prisma.suiviDemande.deleteMany({ where: { demandeId: demande.id } });
    await prisma.distribution.deleteMany({ where: { demandeId: demande.id } });
    await prisma.demande.deleteMany({ where: { id: demande.id } });
  });
});
