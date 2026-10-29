/**
 * L'agenda d'un professionnel.
 *
 * Ce que ces tests gardent, au-delà des règles déjà éprouvées dans `@lerenom/core` :
 *
 *   * **la base refuse elle-même deux plages qui se chevauchent** — le contrôle applicatif
 *     peut être franchi par deux requêtes simultanées, la contrainte d'exclusion non ;
 *   * **une proposition expirée libère son horaire** sans que personne ne fasse le ménage ;
 *   * **un rendez-vous confirmé ne se déplace ni ne s'efface** en silence : le client l'a noté.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nettoieLesDonneesDeTest, prisma } from '@lerenom/db';
import { deplaceLaPlage, poseLaPlage, retireLaPlage, semaineDuPro } from '@/lib/agenda-pro';

const MARQUE = 'test-agenda';
const MAINTENANT = new Date('2026-03-03T10:00:00');

let entrepriseId = '';

function a(heure: string, jour = '03'): Date {
  return new Date(`2026-03-${jour}T${heure}:00`);
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
});

afterAll(async () => {
  await nettoieLesDonneesDeTest(MARQUE);
  await prisma.$disconnect();
});

describe('poser une plage', () => {
  it('enregistre une intervention', async () => {
    const resultat = await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('14:00'), fin: a('15:30') },
      null,
      MAINTENANT,
    );
    expect(resultat.ok).toBe(true);

    const { plages } = await semaineDuPro(entrepriseId, a('14:00'), MAINTENANT);
    expect(plages).toHaveLength(1);
    expect(plages[0]?.type).toBe('intervention');
  });

  it('refuse un chevauchement en disant avec quoi', async () => {
    await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('09:00'), fin: a('10:00') },
      null,
      MAINTENANT,
    );
    const resultat = await poseLaPlage(
      entrepriseId,
      { type: 'visite', debut: a('09:30'), fin: a('10:30') },
      null,
      MAINTENANT,
    );

    expect(resultat.ok).toBe(false);
    expect(!resultat.ok && resultat.problemes[0]?.champ).toBe('chevauchement');
    expect(!resultat.ok && resultat.problemes[0]?.message).toContain('9 h');
  });

  it('laisse deux rendez-vous s’enchaîner bord à bord', async () => {
    await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('09:00'), fin: a('10:00') },
      null,
      MAINTENANT,
    );
    const suivant = await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('10:00'), fin: a('11:00') },
      null,
      MAINTENANT,
    );
    expect(suivant.ok).toBe(true);
  });

  it('marque une proposition et lui donne une échéance', async () => {
    const resultat = await poseLaPlage(
      entrepriseId,
      { type: 'propose', debut: a('16:00'), fin: a('17:00') },
      null,
      MAINTENANT,
    );
    expect(resultat.ok).toBe(true);

    const plage = await prisma.creneau.findFirstOrThrow({ where: { entrepriseId } });
    expect(plage.propose).toBe(true);
    expect(plage.expireLe).not.toBeNull();
  });

  it('n’enregistre rien quand la saisie ne tient pas', async () => {
    const resultat = await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('14:00'), fin: a('14:05') },
      null,
      MAINTENANT,
    );
    expect(resultat.ok).toBe(false);
    expect(await prisma.creneau.count({ where: { entrepriseId } })).toBe(0);
  });
});

describe('les propositions qui expirent', () => {
  /** Une proposition déjà périmée, posée directement pour ne pas attendre deux jours. */
  async function propositionMorte(): Promise<void> {
    await prisma.creneau.create({
      data: {
        entrepriseId,
        type: 'propose',
        debutLe: a('14:00'),
        finLe: a('15:00'),
        propose: true,
        expireLe: new Date(MAINTENANT.getTime() - 1000),
      },
    });
  }

  it('disparaît de la semaine sans que personne ne fasse le ménage', async () => {
    await propositionMorte();
    const { plages } = await semaineDuPro(entrepriseId, a('14:00'), MAINTENANT);
    expect(plages).toHaveLength(0);
  });

  it('reste en base : c’est la trace de ce qu’on a offert', async () => {
    await propositionMorte();
    expect(await prisma.creneau.count({ where: { entrepriseId } })).toBe(1);
  });

  it('libère son horaire pour une vraie intervention', async () => {
    await propositionMorte();
    const resultat = await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('14:00'), fin: a('15:00') },
      null,
      MAINTENANT,
    );
    expect(resultat.ok).toBe(true);
  });

  it('une proposition encore valable, elle, bloque', async () => {
    await poseLaPlage(
      entrepriseId,
      { type: 'propose', debut: a('14:00'), fin: a('15:00') },
      null,
      MAINTENANT,
    );
    const resultat = await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('14:30'), fin: a('15:30') },
      null,
      MAINTENANT,
    );
    expect(resultat.ok).toBe(false);
  });
});

describe('ce que la base refuse elle-même', () => {
  it('deux plages fermes qui se chevauchent', async () => {
    // Le contrôle applicatif peut être franchi par deux requêtes simultanées ; la contrainte
    // d'exclusion, non. C'est elle qui rend la règle vraie.
    await prisma.creneau.create({
      data: { entrepriseId, type: 'intervention', debutLe: a('09:00'), finLe: a('11:00') },
    });

    await expect(
      prisma.creneau.create({
        data: { entrepriseId, type: 'visite', debutLe: a('10:00'), finLe: a('12:00') },
      }),
    ).rejects.toThrow();
  });

  it('mais pas deux plages de professionnels différents', async () => {
    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });
    await prisma.creneau.create({
      data: { entrepriseId, type: 'intervention', debutLe: a('09:00'), finLe: a('11:00') },
    });

    await expect(
      prisma.creneau.create({
        data: {
          entrepriseId: autre.id,
          type: 'intervention',
          debutLe: a('09:00'),
          finLe: a('11:00'),
        },
      }),
    ).resolves.toBeDefined();
  });

  it('ni deux propositions, dont la validité dépend de l’heure qu’il est', async () => {
    await prisma.creneau.create({
      data: {
        entrepriseId,
        type: 'propose',
        debutLe: a('09:00'),
        finLe: a('11:00'),
        propose: true,
      },
    });
    await expect(
      prisma.creneau.create({
        data: {
          entrepriseId,
          type: 'propose',
          debutLe: a('10:00'),
          finLe: a('12:00'),
          propose: true,
        },
      }),
    ).resolves.toBeDefined();
  });
});

describe('déplacer et retirer', () => {
  async function avecRendezVous(statut: 'propose' | 'confirme'): Promise<string> {
    const plage = await prisma.creneau.create({
      data: {
        entrepriseId,
        type: 'intervention',
        debutLe: a('09:00'),
        finLe: a('10:00'),
        rendezVous: { create: { statut } },
      },
      select: { id: true },
    });
    return plage.id;
  }

  it('déplace une plage libre', async () => {
    const pose = await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('09:00'), fin: a('10:00') },
      null,
      MAINTENANT,
    );
    if (!pose.ok) throw new Error('la pose a échoué');

    const resultat = await deplaceLaPlage(
      entrepriseId,
      pose.id,
      { type: 'intervention', debut: a('11:00'), fin: a('12:00') },
      MAINTENANT,
    );
    expect(resultat.ok).toBe(true);

    const apres = await prisma.creneau.findUniqueOrThrow({ where: { id: pose.id } });
    expect(apres.debutLe.getHours()).toBe(11);
  });

  it('ne se compare pas à elle-même en se déplaçant d’une demi-heure', async () => {
    const pose = await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('09:00'), fin: a('10:00') },
      null,
      MAINTENANT,
    );
    if (!pose.ok) throw new Error('la pose a échoué');

    const resultat = await deplaceLaPlage(
      entrepriseId,
      pose.id,
      { type: 'intervention', debut: a('09:30'), fin: a('10:30') },
      MAINTENANT,
    );
    expect(resultat.ok).toBe(true);
  });

  it('refuse de déplacer un rendez-vous confirmé, et dit pourquoi', async () => {
    const id = await avecRendezVous('confirme');
    const resultat = await deplaceLaPlage(
      entrepriseId,
      id,
      { type: 'intervention', debut: a('14:00'), fin: a('15:00') },
      MAINTENANT,
    );
    expect(resultat.ok).toBe(false);
    expect(!resultat.ok && resultat.problemes[0]?.message).toContain('prévenu');
  });

  it('refuse d’effacer un rendez-vous confirmé', async () => {
    const id = await avecRendezVous('confirme');
    const resultat = await retireLaPlage(entrepriseId, id);
    expect(resultat.ok).toBe(false);
    expect(await prisma.creneau.count({ where: { entrepriseId } })).toBe(1);
  });

  it('efface une plage sans rendez-vous confirmé', async () => {
    const id = await avecRendezVous('propose');
    expect((await retireLaPlage(entrepriseId, id)).ok).toBe(true);
    expect(await prisma.creneau.count({ where: { entrepriseId } })).toBe(0);
  });
});

describe('frontière', () => {
  it('ne lit pas l’agenda d’un confrère', async () => {
    await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('09:00'), fin: a('10:00') },
      null,
      MAINTENANT,
    );
    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });

    const { plages } = await semaineDuPro(autre.id, a('09:00'), MAINTENANT);
    expect(plages).toHaveLength(0);
  });

  it('ne déplace ni n’efface la plage d’un confrère', async () => {
    const pose = await poseLaPlage(
      entrepriseId,
      { type: 'intervention', debut: a('09:00'), fin: a('10:00') },
      null,
      MAINTENANT,
    );
    if (!pose.ok) throw new Error('la pose a échoué');

    const autre = await prisma.entreprise.create({
      data: { nom: `${MARQUE} Autre`, slug: `${MARQUE}-autre`, source: 'inscription' },
    });

    expect(
      (
        await deplaceLaPlage(
          autre.id,
          pose.id,
          { type: 'intervention', debut: a('14:00'), fin: a('15:00') },
          MAINTENANT,
        )
      ).ok,
    ).toBe(false);
    expect((await retireLaPlage(autre.id, pose.id)).ok).toBe(false);
    expect(await prisma.creneau.count({ where: { entrepriseId } })).toBe(1);
  });
});
