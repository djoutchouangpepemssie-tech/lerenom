/**
 * Test d'intégration de la cascade de distribution, contre une vraie base.
 *
 * Ce que les tests unitaires de `packages/core` prouvent sur les règles, celui-ci le prouve sur
 * l'orchestration : les bonnes lignes écrites, dans le bon ordre, avec les bons montants. Il
 * crée son propre jeu de données, le nettoie à la fin, et ne touche à rien d'autre.
 *
 * Il est ignoré si `DATABASE_URL` n'est pas défini, pour ne pas rendre la suite dépendante
 * d'une base là où il n'y en a pas.
 */

import process from 'node:process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { accepte, avanceCascade, expire, refuse } from './distribution';

const aUneBase = (process.env['DATABASE_URL'] ?? '') !== '';
const decrire = aUneBase ? describe : describe.skip;

/** Préfixe des données créées par ce test : tout ce qui le porte est supprimé à la fin. */
const MARQUE = 'test-cascade';

decrire('cascade de distribution', () => {
  let metierId = '';
  let prestationId = '';
  let demandeId = '';
  const entreprises = new Map<string, string>();

  /** L'identifiant d'un pro du scénario. Une clé inconnue est une erreur de test. */
  function id(cle: string): string {
    const valeur = entreprises.get(cle);
    if (valeur === undefined) throw new Error(`Pro inconnu dans le scénario : ${cle}`);
    return valeur;
  }

  /** Les quatre pros du scénario, dans l'ordre où la cascade doit les servir. */
  const PROS = [
    { cle: 'exclusif', formule: 'exclusif' as const, note: 4.9, score: 0.92, dejaServi: 0 },
    { cle: 'premium-peu-servi', formule: 'premium' as const, note: 4.6, score: 0.7, dejaServi: 1 },
    {
      cle: 'premium-beaucoup-servi',
      formule: 'premium' as const,
      note: 4.8,
      score: 0.88,
      dejaServi: 4,
    },
    { cle: 'essentiel', formule: 'essentiel' as const, note: 4.5, score: 0.6, dejaServi: 0 },
    { cle: 'gratuit', formule: 'gratuit' as const, note: 4.4, score: 0.5, dejaServi: 0 },
    // Le sixième n'est là que pour prouver qu'on ne le sollicite jamais : trois professionnels
    // ont déjà obtenu la demande, il n'y a plus de place.
    { cle: 'gratuit-de-trop', formule: 'gratuit' as const, note: 4.3, score: 0.4, dejaServi: 0 },
  ];

  beforeAll(async () => {
    // L'acceptation crée désormais le lien de suivi du client, qui a besoin du secret.
    process.env['SECRET_VERIFICATION'] ??= 'secret-de-test-strictement-local-et-assez-long';

    // Un test interrompu laisse ses données derrière lui : on repart d'une table nette,
    // sinon la contrainte d'unicité sur le slug ferait échouer la relance.
    await nettoieLesDonneesDeTest(MARQUE);

    // Un métier sans données de démonstration : le scénario ne doit croiser aucune entreprise
    // qu'il n'a pas créée lui-même, et aucune exclusivité déjà vendue.
    const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });
    metierId = metier.id;
    const prestation = await prisma.prestation.findFirstOrThrow({
      where: { slug: 'serrurier--ouverture-de-porte-claquee' },
    });
    prestationId = prestation.id;

    const mois = new Date().toISOString().slice(0, 7);
    const jour = new Date().toISOString().slice(0, 10);

    for (const pro of PROS) {
      const entreprise = await prisma.entreprise.create({
        data: {
          nom: `${MARQUE} ${pro.cle}`,
          slug: `${MARQUE}-${pro.cle}`,
          source: 'manuelle',
          revendiquee: true,
          verifiee: true,
          noteMoyenne: pro.note,
          nombreAvis: 20,
          disponible: true,
          interventionUrgente: true,
          metiers: { create: { metierId, principal: true } },
          zones: { create: { communeId: '75111' } },
          agences: {
            create: {
              adresse: '1 rue de test',
              codePostal: '75011',
              communeId: '75111',
              rayonKm: 10,
            },
          },
          utilisateurs: {
            create: { email: `${MARQUE}-${pro.cle}@exemple.test`, nom: 'Test' },
          },
          scores: {
            create: {
              jour,
              score: pro.score,
              avis: 0.9,
              activite: 0.8,
              pertinence: 0.9,
              reactivite: 0.8,
              fraicheur: 0.9,
            },
          },
        },
      });
      entreprises.set(pro.cle, entreprise.id);

      if (pro.formule !== 'gratuit') {
        await prisma.abonnement.create({
          data: { entrepriseId: entreprise.id, formule: pro.formule, debuteLe: new Date() },
        });
      }
      if (pro.dejaServi > 0) {
        await prisma.quotaMensuel.create({
          data: {
            entrepriseId: entreprise.id,
            mois,
            formule: pro.formule,
            demandesIncluses: pro.formule === 'premium' ? 5 : 15,
            demandesAcceptees: pro.dejaServi,
          },
        });
      }
    }

    // L'exclusivité du métier sur Paris 11e, qui donne sa place n° 1 au titulaire.
    await prisma.exclusivite.create({
      data: {
        metierId,
        communeId: '75111',
        entrepriseId: id('exclusif'),
        finitLe: new Date(Date.now() + 365 * 24 * 3_600_000),
      },
    });

    const demande = await prisma.demande.create({
      data: {
        reference: `${MARQUE}-${Date.now()}`,
        type: 'partagee',
        statut: 'brouillon',
        metierId,
        prestationId,
        communeId: '75111',
        description: 'Porte claquée, je suis sur le palier avec mes courses.',
        urgence: 'rapide',
        clientPrenom: 'Camille',
        clientEmail: 'camille@exemple.test',
        clientTelephone: '+33699999999',
        telephoneVerifieLe: new Date(),
        consentementTexte: 'Consentement de test.',
        consentementDonneLe: new Date(),
        objectifPros: 3,
      },
    });
    demandeId = demande.id;
  });

  afterAll(async () => {
    // On supprime dans l'ordre des dépendances : rien de ce test ne doit survivre.
    const ids = [...entreprises.values()];
    await prisma.messageSortant.deleteMany({ where: { demandeId } });
    await prisma.lienAction.deleteMany({ where: { demandeId } });
    await prisma.suiviDemande.deleteMany({ where: { demandeId } });
    await prisma.distribution.deleteMany({ where: { demandeId } });
    await prisma.demande.deleteMany({ where: { id: demandeId } });
    await prisma.alerte.deleteMany({ where: { objetId: { in: [...ids, demandeId] } } });
    await prisma.tacheAValider.deleteMany({ where: { objetId: demandeId } });
    await prisma.exclusivite.deleteMany({ where: { entrepriseId: { in: ids } } });
    await prisma.entreprise.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('envoie d’abord à l’Exclusif de la zone, et à lui seul', async () => {
    const resultat = await avanceCascade(demandeId);

    expect(resultat.envoyes).toEqual([id('exclusif')]);
    expect(resultat.statut).toBe('en_distribution');

    const distribution = await prisma.distribution.findFirstOrThrow({ where: { demandeId } });
    expect(distribution.raisonRang).toBe('exclusif_de_la_zone');
    expect(distribution.tour).toBe(1);

    // 30 minutes de solitude : l'échéance le prouve, à la minute près.
    const minutes = (distribution.echeanceLe.getTime() - distribution.envoyeeLe.getTime()) / 60_000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThan(31);
  });

  it('n’envoie à personne d’autre tant que son délai court', async () => {
    const resultat = await avanceCascade(demandeId);
    expect(resultat.envoyes).toEqual([]);
    expect(await prisma.distribution.count({ where: { demandeId } })).toBe(1);
  });

  it('passe aux Premium quand l’Exclusif refuse, le moins servi d’abord', async () => {
    const distribution = await prisma.distribution.findFirstOrThrow({
      where: { demandeId, entrepriseId: id('exclusif') },
    });

    const resultat = await refuse(distribution.id, 'indisponible');

    expect(resultat?.envoyes).toHaveLength(2);
    const envoyees = await prisma.distribution.findMany({
      where: { demandeId, tour: 2 },
      orderBy: { rang: 'asc' },
    });
    expect(envoyees.map((d) => d.entrepriseId)).toEqual([
      // 1 demande sur 5 consommées passe devant 4 sur 5 : l'équité avant le score.
      id('premium-peu-servi'),
      id('premium-beaucoup-servi'),
    ]);
    expect(envoyees.every((d) => d.raisonRang === 'premium_le_moins_servi')).toBe(true);
  });

  it('ne facture ni ne décompte rien à un pro qui refuse', async () => {
    const refusee = await prisma.distribution.findFirstOrThrow({
      where: { demandeId, entrepriseId: id('exclusif') },
    });
    expect(refusee.statut).toBe('refusee');
    expect(Number(refusee.montantHT)).toBe(0);
    expect(refusee.consommeForfait).toBe(false);
  });

  it('décompte le forfait du Premium qui accepte, sans rien lui facturer', async () => {
    const distribution = await prisma.distribution.findFirstOrThrow({
      where: { demandeId, entrepriseId: id('premium-peu-servi') },
    });

    const cout = await accepte(distribution.id);

    expect(cout).toEqual({ montantHT: 0, consommeForfait: true });
    const quota = await prisma.quotaMensuel.findFirstOrThrow({
      where: { entrepriseId: id('premium-peu-servi') },
    });
    expect(quota.demandesAcceptees).toBe(2);
  });

  it('refuse une seconde acceptation de la même proposition', async () => {
    const distribution = await prisma.distribution.findFirstOrThrow({
      where: { demandeId, entrepriseId: id('premium-peu-servi') },
    });
    await expect(accepte(distribution.id)).rejects.toThrow(/déjà été acceptée/);
  });

  it('passe au suivant quand un Premium laisse expirer, sans le facturer', async () => {
    const distribution = await prisma.distribution.findFirstOrThrow({
      where: { demandeId, entrepriseId: id('premium-beaucoup-servi') },
    });

    const resultat = await expire(distribution.id);

    const expiree = await prisma.distribution.findUniqueOrThrow({ where: { id: distribution.id } });
    expect(expiree.statut).toBe('expiree');
    expect(Number(expiree.montantHT)).toBe(0);

    // Deux places restent à pourvoir : elles partent ensemble aux deux pros suivants, plutôt
    // que l'une après l'autre — le client n'a pas à attendre deux délais bout à bout.
    expect(resultat?.envoyes).toHaveLength(2);
    expect(resultat?.envoyes).toContain(id('essentiel'));
    expect(resultat?.envoyes).toContain(id('gratuit'));
  });

  it('facture 15 € à l’Essentiel, qui n’a pas de forfait', async () => {
    const distribution = await prisma.distribution.findFirstOrThrow({
      where: { demandeId, entrepriseId: id('essentiel') },
    });

    const cout = await accepte(distribution.id);

    expect(cout).toEqual({ montantHT: 15, consommeForfait: false });
  });

  it('propose la dernière place au pro suivant, une fois le deuxième accepté', async () => {
    const gratuit = await prisma.distribution.findFirst({
      where: { demandeId, entrepriseId: id('gratuit') },
    });
    expect(gratuit).not.toBeNull();
    expect(gratuit?.statut).toBe('envoyee');
  });

  it('facture 15 € à une fiche gratuite, qui n’a pas de forfait non plus', async () => {
    const distribution = await prisma.distribution.findFirstOrThrow({
      where: { demandeId, entrepriseId: id('gratuit') },
    });

    const cout = await accepte(distribution.id);

    expect(cout).toEqual({ montantHT: 15, consommeForfait: false });
  });

  it('clôt la demande à la troisième acceptation', async () => {
    const demande = await prisma.demande.findUniqueOrThrow({ where: { id: demandeId } });
    expect(demande.statut).toBe('complete');
    expect(demande.clotureeLe).not.toBeNull();

    const acceptees = await prisma.distribution.count({
      where: { demandeId, statut: 'acceptee' },
    });
    expect(acceptees).toBe(3);
  });

  it('ne sollicite jamais un professionnel de plus une fois les 3 places prises', async () => {
    const resultat = await avanceCascade(demandeId);
    expect(resultat.envoyes).toEqual([]);
    expect(resultat.statut).toBe('complete');

    const sollicites = await prisma.distribution.findMany({
      where: { demandeId },
      select: { entrepriseId: true },
    });
    expect(sollicites.map((d) => d.entrepriseId)).not.toContain(id('gratuit-de-trop'));
    // Cinq propositions pour trois places : deux refus ou expirations, et pas un de plus.
    expect(sollicites).toHaveLength(5);
  });

  it('a mis en file un message pour chaque professionnel sollicité', async () => {
    const messages = await prisma.messageSortant.findMany({ where: { demandeId } });
    const recues = messages.filter((m) => m.modele === 'demande-recue');
    // Un e-mail par professionnel sollicité ; les SMS attendent le numéro du destinataire.
    expect(recues.filter((m) => m.canal === 'email')).toHaveLength(5);
    expect(messages.every((m) => m.statut === 'en_attente')).toBe(true);
  });

  it('prévient le client à chaque acceptation, et lui donne un lien de suivi', async () => {
    const messages = await prisma.messageSortant.findMany({
      where: { demandeId, modele: 'pro-a-accepte' },
    });

    // Trois acceptations, un SMS et un courriel chacune, tous adressés au client.
    expect(messages.filter((m) => m.canal === 'sms')).toHaveLength(3);
    expect(messages.filter((m) => m.canal === 'email')).toHaveLength(3);
    expect(
      messages.every(
        (m) => m.destinataire.includes('99999999') || m.destinataire.includes('@exemple.test'),
      ),
    ).toBe(true);

    const liens = await prisma.lienAction.findMany({ where: { demandeId } });
    expect(liens).toHaveLength(3);
    expect(liens.every((lien) => lien.action === 'voir_pros')).toBe(true);
    // Chaque jeton est unique, et aucun n'est stocké en clair : 64 caractères d'empreinte.
    expect(new Set(liens.map((lien) => lien.jeton)).size).toBe(3);
    expect(liens.every((lien) => lien.jeton.length === 64)).toBe(true);

    // Le jeton en clair figure dans le message, et c'est le seul endroit où il existe.
    for (const message of messages) {
      expect(message.corps).toMatch(/\/suivi\/[A-Za-z0-9_-]{43}/);
    }
  });
});
