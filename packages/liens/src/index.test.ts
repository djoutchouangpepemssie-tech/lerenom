/**
 * Les liens d'action, et la frontière entre agir et lire.
 *
 * Ce paquet n'avait aucun test, alors qu'il tient la sécurité de tout ce qui se fait sans mot
 * de passe : signer un devis, accepter un rendez-vous, déposer un avis. Ces tests commencent
 * par la règle la plus facile à casser par inadvertance — **un lien à usage unique ne sert
 * qu'une fois** — et par celle qu'on vient d'ajouter à côté d'elle : _ne plus pouvoir agir_
 * n'est pas _ne plus pouvoir lire_.
 *
 * Le danger d'une lecture permissive est réel : si `resoudLienPourLecture` servait un jour à
 * une page qui agit, la protection du lien à usage unique tomberait sans bruit. D'où le test
 * qui vérifie qu'elle refuse l'expiration — la seule borne qu'elle conserve.
 */

import process from 'node:process';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@lerenom/db';
import { consommeLien, creeLien, resoudLien, resoudLienPourLecture } from './index.ts';

const aUneBase = (process.env['DATABASE_URL'] ?? '') !== '';
const decrire = aUneBase ? describe : describe.skip;

const MARQUE = 'test-liens';
let devisId = '';

/** Un devis à viser, pour que la cible du lien existe vraiment. */
beforeEach(async () => {
  if (!aUneBase) return;
  await prisma.entreprise.deleteMany({ where: { slug: { startsWith: MARQUE } } });

  const entreprise = await prisma.entreprise.create({
    data: {
      nom: `${MARQUE} Entreprise`,
      slug: `${MARQUE}-entreprise`,
      source: 'inscription',
      devis: { create: { statut: 'envoye' } },
    },
    include: { devis: true },
  });
  devisId = entreprise.devis[0]?.id ?? '';
});

afterAll(async () => {
  if (!aUneBase) return;
  await prisma.entreprise.deleteMany({ where: { slug: { startsWith: MARQUE } } });
  await prisma.$disconnect();
});

/** Le jeton en clair d'un lien neuf. Il n'existe qu'ici : la base n'en garde que l'empreinte. */
async function jetonNeuf(): Promise<{ jeton: string; id: string }> {
  const lien = await creeLien(null, 'signer_devis', devisId);
  const jeton = lien.url.split('/').pop() ?? '';
  const enBase = await prisma.lienAction.findFirstOrThrow({
    where: { cibleId: devisId },
    orderBy: { creeLe: 'desc' },
    select: { id: true },
  });
  return { jeton, id: enBase.id };
}

decrire('resoudLien', () => {
  it('retrouve un lien neuf et sa cible', async () => {
    const { jeton } = await jetonNeuf();
    const resolution = await resoudLien(jeton);

    expect(resolution.issue).toBe('valide');
    if (resolution.issue !== 'valide') return;
    expect(resolution.lien.action).toBe('signer_devis');
    expect(resolution.lien.cibleId).toBe(devisId);
  });

  it('ferme un lien consommé', async () => {
    // La règle qui protège une boîte mail compromise : signer une fois, pas deux.
    const { jeton, id } = await jetonNeuf();
    await consommeLien(id);

    expect((await resoudLien(jeton)).issue).toBe('deja-utilise');
  });

  it('ne reconnaît pas un jeton mal formé, sans interroger la base', async () => {
    expect((await resoudLien('pas-un-jeton')).issue).toBe('inconnu');
    expect((await resoudLien('')).issue).toBe('inconnu');
  });

  it('ne reconnaît pas un jeton bien formé mais inconnu', async () => {
    const { jeton } = await jetonNeuf();
    // Un jeton de la bonne longueur, dans le bon alphabet, mais qui n'est émis par personne.
    const faux = `${jeton.slice(0, -4)}aaaa`;
    const resolution = await resoudLien(faux);
    expect(['inconnu', 'valide']).toContain(resolution.issue);
    if (resolution.issue === 'valide') {
      // Le hasard a reproduit le jeton : improbable, mais le test ne doit pas mentir dessus.
      expect(resolution.lien.cibleId).toBe(devisId);
    }
  });
});

decrire('resoudLienPourLecture', () => {
  it('ouvre un lien neuf, comme l’autre', async () => {
    const { jeton } = await jetonNeuf();
    const resolution = await resoudLienPourLecture(jeton);

    expect(resolution.issue).toBe('valide');
    if (resolution.issue !== 'valide') return;
    expect(resolution.lien.cibleId).toBe(devisId);
  });

  it('ouvre encore un lien consommé : le devis signé reste l’exemplaire du client', async () => {
    const { jeton, id } = await jetonNeuf();
    await consommeLien(id);

    const resolution = await resoudLienPourLecture(jeton);
    expect(resolution.issue).toBe('valide');
    if (resolution.issue !== 'valide') return;
    expect(resolution.lien.cibleId).toBe(devisId);
    expect(resolution.lien.utiliseLe).not.toBeNull();
  });

  it('refuse un lien expiré, consommé ou non', async () => {
    // L'expiration est la seule borne que la lecture conserve. Si elle tombait, un lien
    // vieux de deux ans rouvrirait un document que personne ne croyait encore accessible.
    const { jeton, id } = await jetonNeuf();
    await prisma.lienAction.update({
      where: { id },
      data: { expireLe: new Date(Date.now() - 1000) },
    });
    expect((await resoudLienPourLecture(jeton)).issue).toBe('expire');

    await consommeLien(id);
    expect((await resoudLienPourLecture(jeton)).issue).toBe('expire');
  });

  it('ne reconnaît pas un jeton mal formé', async () => {
    expect((await resoudLienPourLecture('pas-un-jeton')).issue).toBe('inconnu');
  });

  it('ne consomme rien : relire ne consume pas le droit de signer', async () => {
    const { jeton, id } = await jetonNeuf();
    await resoudLienPourLecture(jeton);
    await resoudLienPourLecture(jeton);

    const lien = await prisma.lienAction.findUniqueOrThrow({ where: { id } });
    expect(lien.utiliseLe).toBeNull();
    expect((await resoudLien(jeton)).issue).toBe('valide');
  });
});
