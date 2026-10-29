/**
 * La proximité joue-t-elle vraiment ?
 *
 * Pendant plusieurs phases, non : aucune commune n'avait de coordonnées, donc la distance
 * valait `null` pour tout le monde et le critère ne départageait personne. Le défaut était
 * consigné (`docs/QUESTIONS.md` Q26) mais rien ne l'aurait signalé s'il était réapparu —
 * un critère silencieusement neutre ne casse aucun test.
 *
 * Ce fichier est ce garde-fou. Il vérifie deux choses, et seulement elles :
 *
 *   * **une distance est calculée** pour un professionnel dont l'agence n'a pas été
 *     géocodée, par repli sur le point de sa commune ;
 *   * **elle ordonne** : à mérite égal par ailleurs, le plus proche passe devant.
 *
 * Il ne vérifie pas la précision des coordonnées : c'est le rôle des contrôles de
 * `scripts/coordonnees-communes.mjs`, au moment où la donnée entre dans le dépôt.
 */

import process from 'node:process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { avanceCascade } from './distribution.ts';

const aUneBase = (process.env['DATABASE_URL'] ?? '') !== '';
const decrire = aUneBase ? describe : describe.skip;

const MARQUE = 'test-proximite';

/**
 * Deux serruriers identiques en tout, sauf leur commune.
 *
 * Melun est à une soixantaine de kilomètres de Paris 11e, Montreuil à trois. Tout le reste
 * — note, score, formule, ancienneté — est volontairement égal : si l'ordre change, seule
 * la distance peut l'expliquer.
 */
const PROS = [
  { cle: 'loin', commune: '77288', codePostal: '77000' },
  { cle: 'proche', commune: '93048', codePostal: '93100' },
] as const;

const entreprises = new Map<string, string>();
let demandeId = '';

function id(cle: string): string {
  const valeur = entreprises.get(cle);
  if (valeur === undefined) throw new Error(`entreprise inconnue : ${cle}`);
  return valeur;
}

beforeAll(async () => {
  if (!aUneBase) return;
  await nettoieLesDonneesDeTest(MARQUE);

  const metier = await prisma.metier.findFirstOrThrow({ where: { slug: 'serrurier' } });
  const prestation = await prisma.prestation.findFirstOrThrow({
    where: { slug: 'serrurier--ouverture-de-porte-claquee' },
  });
  const jour = new Date().toISOString().slice(0, 10);

  for (const pro of PROS) {
    const entreprise = await prisma.entreprise.create({
      data: {
        nom: `${MARQUE} ${pro.cle}`,
        slug: `${MARQUE}-${pro.cle}`,
        source: 'manuelle',
        revendiquee: true,
        verifiee: true,
        noteMoyenne: 4.5,
        nombreAvis: 20,
        disponible: true,
        metiers: { create: { metierId: metier.id, principal: true } },
        // Les deux couvrent Paris 11e : c'est leur zone déclarée, pas leur adresse, qui
        // les rend candidats. La distance n'entre en jeu qu'ensuite, pour les classer.
        zones: { create: { communeId: '75111' } },
        agences: {
          create: {
            adresse: '1 rue de test',
            codePostal: pro.codePostal,
            communeId: pro.commune,
            // Large : le rayon ne doit écarter personne, sinon le test mesurerait un
            // filtrage et non un classement.
            rayonKm: 100,
          },
        },
        utilisateurs: { create: { email: `${MARQUE}-${pro.cle}@exemple.test`, nom: 'Test' } },
        scores: {
          create: {
            jour,
            score: 0.8,
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
  }

  const demande = await prisma.demande.create({
    data: {
      reference: `${MARQUE}-${String(Date.now())}`,
      type: 'partagee',
      statut: 'brouillon',
      metierId: metier.id,
      prestationId: prestation.id,
      communeId: '75111',
      description: 'Porte claquée, je suis sur le palier.',
      urgence: 'normale',
      clientPrenom: 'Test',
      clientEmail: `${MARQUE}@exemple.test`,
      clientTelephone: '+33600000000',
      telephoneVerifieLe: new Date(),
      consentementTexte: 'test',
      consentementDonneLe: new Date(),
      objectifPros: 2,
    },
  });
  demandeId = demande.id;
});

afterAll(async () => {
  if (!aUneBase) return;
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

decrire('la distance est connue et elle classe', () => {
  it('calcule une distance sans que l’agence soit géocodée', async () => {
    const resultat = await avanceCascade(demandeId);
    expect(resultat.envoyes).toHaveLength(2);

    const distributions = await prisma.distribution.findMany({
      where: { demandeId },
      select: { distanceKm: true },
    });
    // Le point est celui de la commune, pas celui de l'adresse : ce qui compte ici est
    // qu'une distance existe, là où elle valait `null` pour tout le monde.
    expect(distributions.every((ligne) => ligne.distanceKm !== null)).toBe(true);
  });

  it('met le plus proche devant, toutes choses égales par ailleurs', async () => {
    const distributions = await prisma.distribution.findMany({
      where: { demandeId },
      orderBy: { rang: 'asc' },
      select: { entrepriseId: true, rang: true, distanceKm: true },
    });

    expect(distributions).toHaveLength(2);
    expect(distributions[0]?.entrepriseId).toBe(id('proche'));
    expect(distributions[1]?.entrepriseId).toBe(id('loin'));
  });

  it('chiffre des distances qui ressemblent à la carte', async () => {
    const lignes = await prisma.distribution.findMany({
      where: { demandeId },
      select: { entrepriseId: true, distanceKm: true },
    });
    const parEntreprise = new Map<string, number>(
      lignes.map((ligne) => [ligne.entrepriseId, Number(ligne.distanceKm ?? 0)]),
    );

    // Montreuil est à quelques kilomètres de Paris 11e, Melun à une soixantaine. Les bornes
    // sont larges à dessein : ce test garde l'ordre de grandeur, pas la décimale — serrer
    // davantage ferait échouer le jour où la source gagne en précision, sans qu'un défaut
    // soit apparu.
    expect(parEntreprise.get(id('proche'))).toBeLessThan(10);
    expect(parEntreprise.get(id('loin'))).toBeGreaterThan(35);
    expect(parEntreprise.get(id('loin'))).toBeLessThan(80);
  });
});
