/**
 * Les invitations à déposer un avis : qui en reçoit une, quand, et combien de fois.
 *
 * La charte publique annonce « quinze jours après les travaux ». Ce test tient ce délai contre
 * une vraie base, et vérifie surtout ce qui ne doit **pas** arriver : pas d'invitation sans
 * travaux déclarés, pas de seconde invitation, pas d'invitation sur une demande annulée.
 */

import process from 'node:process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { demandeConfirmationIntervention, inviteAuxAvis } from './avis.ts';

const aUneBase = (process.env['DATABASE_URL'] ?? '') !== '';
const decrire = aUneBase ? describe : describe.skip;

const MARQUE = 'test-invitation-avis';
const JOUR = 24 * 3_600_000;

decrire('invitations à déposer un avis', () => {
  let proId = '';
  const demandes = new Map<string, string>();

  /** Crée une demande acceptée par le pro, avec ou sans travaux déclarés. */
  async function creeDossier(
    cle: string,
    options: {
      readonly travauxIlYAJours?: number;
      readonly annulee?: boolean;
      readonly accepteeIlYAJours?: number;
    } = {},
  ): Promise<string> {
    const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });
    const demande = await prisma.demande.create({
      data: {
        reference: `${MARQUE}-${cle}-${Date.now()}`,
        type: 'partagee',
        statut: options.annulee === true ? 'annulee' : 'complete',
        ...(options.annulee === true ? { annuleeLe: new Date() } : {}),
        metierId: metier.id,
        communeId: '75111',
        description: `Dossier ${cle}.`,
        urgence: 'normale',
        clientPrenom: 'Camille',
        clientEmail: `${cle}@exemple.test`,
        clientTelephone: '+33699999990',
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
        repondueLe: new Date(Date.now() - (options.accepteeIlYAJours ?? 0) * JOUR),
      },
    });

    if (options.travauxIlYAJours !== undefined) {
      await prisma.suiviDemande.create({
        data: {
          demandeId: demande.id,
          entrepriseId: proId,
          etape: 'travaux_realises',
          creeLe: new Date(Date.now() - options.travauxIlYAJours * JOUR),
        },
      });
    }

    demandes.set(cle, demande.id);
    return demande.id;
  }

  function id(cle: string): string {
    const valeur = demandes.get(cle);
    if (valeur === undefined) throw new Error(`Dossier inconnu : ${cle}`);
    return valeur;
  }

  async function invitations(cle: string): Promise<number> {
    return prisma.lienAction.count({ where: { demandeId: id(cle), action: 'deposer_avis' } });
  }

  beforeAll(async () => {
    process.env['SECRET_VERIFICATION'] ??= 'secret-de-test-strictement-local-et-assez-long';
    await nettoieLesDonneesDeTest(MARQUE);

    const entreprise = await prisma.entreprise.create({
      data: {
        nom: `${MARQUE} pro`,
        slug: `${MARQUE}-pro`,
        source: 'manuelle',
        agences: { create: { adresse: '4 rue du test', codePostal: '75011', communeId: '75111' } },
      },
      select: { id: true },
    });
    proId = entreprise.id;

    await creeDossier('mur', { travauxIlYAJours: 20 });
    await creeDossier('trop-recent', { travauxIlYAJours: 3 });
    await creeDossier('sans-travaux');
    await creeDossier('annule', { travauxIlYAJours: 20, annulee: true });
  });

  afterAll(async () => {
    const ids = [...demandes.values()];
    await prisma.lienAction.deleteMany({ where: { demandeId: { in: ids } } });
    await prisma.messageSortant.deleteMany({ where: { demandeId: { in: ids } } });
    await prisma.suiviDemande.deleteMany({ where: { demandeId: { in: ids } } });
    await prisma.distribution.deleteMany({ where: { demandeId: { in: ids } } });
    await prisma.demande.deleteMany({ where: { id: { in: ids } } });
    await prisma.entreprise.deleteMany({ where: { id: proId } });
    await prisma.$disconnect();
  });

  it('invite le dossier mûr, et lui seul', async () => {
    const bilan = await inviteAuxAvis();
    expect(bilan.envoyees).toBeGreaterThanOrEqual(1);

    expect(await invitations('mur')).toBe(1);
    expect(await invitations('trop-recent')).toBe(0);
    expect(await invitations('sans-travaux')).toBe(0);
    expect(await invitations('annule')).toBe(0);
  });

  it('envoie un SMS et un courriel, avec le lien en clair dans le message', async () => {
    const messages = await prisma.messageSortant.findMany({
      where: { demandeId: id('mur'), modele: 'invitation-avis' },
    });

    expect(messages.filter((m) => m.canal === 'sms')).toHaveLength(1);
    expect(messages.filter((m) => m.canal === 'email')).toHaveLength(1);
    for (const message of messages) {
      expect(message.corps).toMatch(/\/suivi\/[A-Za-z0-9_-]{43}/);
      expect(message.corps).toContain(`${MARQUE} pro`);
      expect(message.statut).toBe('en_attente');
    }
  });

  it('n’invite jamais deux fois, même relancé', async () => {
    await inviteAuxAvis();
    await inviteAuxAvis();

    expect(await invitations('mur')).toBe(1);
    const messages = await prisma.messageSortant.count({
      where: { demandeId: id('mur'), modele: 'invitation-avis' },
    });
    expect(messages).toBe(2);
  });

  it('n’invite pas non plus un avis déjà déposé', async () => {
    const demandeId = await creeDossier('deja-note', { travauxIlYAJours: 20 });
    const avis = await prisma.avis.create({
      data: {
        entrepriseId: proId,
        demandeId,
        note: 5,
        auteurPrenom: 'Camille',
        statut: 'publie',
      },
      select: { id: true },
    });

    await inviteAuxAvis();
    expect(await invitations('deja-note')).toBe(0);

    await prisma.avis.delete({ where: { id: avis.id } });
  });

  describe('confirmation de l’intervention par le client', () => {
    async function confirmations(cle: string): Promise<number> {
      return prisma.lienAction.count({
        where: { demandeId: id(cle), action: 'confirmer_intervention' },
      });
    }

    beforeAll(async () => {
      await creeDossier('muet', { accepteeIlYAJours: 10 });
      await creeDossier('accepte-hier', { accepteeIlYAJours: 1 });
      await creeDossier('deja-declare', { accepteeIlYAJours: 10, travauxIlYAJours: 2 });
      await creeDossier('abandonne', { accepteeIlYAJours: 10, annulee: true });
    });

    it('interroge le client quand le pro n’a rien déclaré', async () => {
      const bilan = await demandeConfirmationIntervention();
      expect(bilan.envoyees).toBeGreaterThanOrEqual(1);

      expect(await confirmations('muet')).toBe(1);
      // Trop tôt : le délai n'est pas écoulé.
      expect(await confirmations('accepte-hier')).toBe(0);
      // Le pro a déclaré : la question n'a pas lieu d'être.
      expect(await confirmations('deja-declare')).toBe(0);
      // Demande annulée : on ne réveille personne.
      expect(await confirmations('abandonne')).toBe(0);
    });

    it('met le lien en clair dans le SMS et le courriel', async () => {
      const messages = await prisma.messageSortant.findMany({
        where: { demandeId: id('muet'), modele: 'confirmation-intervention' },
      });
      expect(messages.filter((m) => m.canal === 'sms')).toHaveLength(1);
      expect(messages.filter((m) => m.canal === 'email')).toHaveLength(1);
      for (const message of messages) {
        expect(message.corps).toMatch(/\/suivi\/[A-Za-z0-9_-]{43}/);
        expect(message.corps).toContain(`${MARQUE} pro`);
      }
    });

    it('espace les relances au lieu de les empiler', async () => {
      await demandeConfirmationIntervention();
      await demandeConfirmationIntervention();
      expect(await confirmations('muet')).toBe(1);
    });

    it('relance après le délai, puis s’arrête : on interroge, on ne harcèle pas', async () => {
      const demandeId = id('muet');
      const jour = 24 * 3_600_000;

      // Deux relances espacées, puis une troisième tentative qui ne doit rien produire.
      for (const semaines of [1, 2, 3, 4]) {
        await prisma.demande.update({
          where: { id: demandeId },
          data: { derniereRelanceConfirmationLe: new Date(Date.now() - semaines * 8 * jour) },
        });
        await demandeConfirmationIntervention();
      }

      // Une question et deux relances au maximum, jamais davantage.
      expect(await confirmations('muet')).toBe(3);
    });
  });
});
