/**
 * Les lectures du site public.
 *
 * Ces fonctions lisent la base et rien d'autre : elles ne décident de rien. Le classement, les
 * emplacements payés, les quotas et les prix viennent de `@lerenom/core`, à qui elles passent
 * les lignes lues et les paramètres.
 *
 * Elles sont mises en cache par requête (`cache` de React) : une page qui affiche le menu, le
 * fil d'Ariane et la liste des résultats ne doit pas interroger trois fois le même catalogue.
 */

import { cache } from 'react';
import { prisma } from '@lerenom/db';
import type { CandidatClassement } from '@lerenom/core';
import { PARAMETRES_PAR_DEFAUT, classePageResultats } from '@lerenom/core';

/* ------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* ------------------------------------------------------------------------- */

export const catalogue = cache(async () => {
  const univers = await prisma.univers.findMany({
    where: { masque: false },
    orderBy: { rang: 'asc' },
    include: {
      metiers: {
        where: { masque: false },
        orderBy: { rang: 'asc' },
        include: {
          prestations: { where: { masque: false }, orderBy: { rang: 'asc' } },
        },
      },
    },
  });

  // Les compteurs affichés sur le site sont calculés, jamais écrits en dur : si Arcel ajoute
  // un métier, le site affiche le nouveau total sans qu'une ligne de code change.
  const nombreMetiers = univers.reduce((somme, u) => somme + u.metiers.length, 0);
  const nombrePrestations = univers.reduce(
    (somme, u) => somme + u.metiers.reduce((s, m) => s + m.prestations.length, 0),
    0,
  );

  return {
    univers,
    comptes: {
      univers: univers.length,
      metiers: nombreMetiers,
      prestations: nombrePrestations,
    },
  };
});

export const metierParSlug = cache(async (slug: string) =>
  prisma.metier.findUnique({
    where: { slug },
    include: {
      univers: true,
      prestations: {
        where: { masque: false },
        orderBy: { rang: 'asc' },
        include: { prixPrestation: true },
      },
      prixMetier: true,
    },
  }),
);

/* ------------------------------------------------------------------------- */
/* Géographie                                                                 */
/* ------------------------------------------------------------------------- */

export const departements = cache(async () =>
  prisma.departement.findMany({
    orderBy: { code: 'asc' },
    include: { _count: { select: { communes: true } } },
  }),
);

export const communeParSlug = cache(async (slug: string) =>
  prisma.commune.findUnique({ where: { slug }, include: { departement: true } }),
);

export const communesOuvertes = cache(async () =>
  prisma.commune.findMany({
    where: { statut: { in: ['ouvert', 'bientot'] } },
    orderBy: [{ statut: 'asc' }, { population: 'desc' }],
    include: { departement: true },
  }),
);

export const communesLesPlusPeuplees = cache(async (limite = 12) =>
  prisma.commune.findMany({
    orderBy: { population: 'desc' },
    take: limite,
    include: { departement: true },
  }),
);

/* ------------------------------------------------------------------------- */
/* Résultats métier × ville                                                   */
/* ------------------------------------------------------------------------- */

export interface ProAffiche {
  readonly id: string;
  readonly nom: string;
  readonly slug: string;
  readonly formule: 'gratuit' | 'essentiel' | 'premium' | 'exclusif';
  readonly note: number | null;
  readonly nombreAvis: number;
  readonly description: string | null;
  readonly completude: number;
  readonly rang: number;
  readonly sponsorise: boolean;
  readonly raison: 'emplacement-exclusif' | 'emplacement-premium' | 'classement-naturel';
  readonly communeAgence: string | null;
}

/**
 * La page de résultats d'un métier dans une ville.
 *
 * La base fournit les entreprises éligibles, leur score du soir et leurs emplacements payés ;
 * `classePageResultats` décide de l'ordre. Aucun tri n'est fait en SQL : la règle d'affichage
 * est une règle métier, elle vit dans `packages/core` et nulle part ailleurs.
 */
export const resultats = cache(async (slugMetier: string, slugCommune: string) => {
  const [metier, commune] = await Promise.all([
    prisma.metier.findUnique({
      where: { slug: slugMetier },
      include: {
        univers: true,
        prestations: { where: { masque: false }, orderBy: { rang: 'asc' } },
      },
    }),
    prisma.commune.findUnique({ where: { slug: slugCommune }, include: { departement: true } }),
  ]);

  if (metier === null || commune === null) return null;

  const jour = new Date().toISOString().slice(0, 10);

  const entreprises = await prisma.entreprise.findMany({
    where: {
      suspendue: false,
      retireeLe: null,
      metiers: { some: { metierId: metier.id } },
      zones: { some: { communeId: commune.code } },
    },
    include: {
      fiche: true,
      agences: { include: { commune: true }, take: 1 },
      emplacements: { where: { metierId: metier.id, communeId: commune.code } },
      abonnements: { where: { statut: 'actif' }, take: 1 },
      scores: { where: { jour }, take: 1 },
      exclusivites: {
        where: { metierId: metier.id, communeId: commune.code, active: true },
        take: 1,
      },
    },
  });

  const candidats: CandidatClassement[] = entreprises.map((entreprise) => ({
    entrepriseId: entreprise.id,
    formule: entreprise.abonnements[0]?.formule ?? 'gratuit',
    // Sans score du soir, l'entreprise part de zéro : elle apparaît, en fin de classement.
    score: entreprise.scores[0]?.score ?? 0,
    note: entreprise.noteMoyenne,
    titulaireExclusivite: entreprise.exclusivites.length > 0,
  }));

  const page = classePageResultats(candidats, PARAMETRES_PAR_DEFAUT, compteurAffichage());
  const parId = new Map(entreprises.map((e) => [e.id, e]));

  const pros: ProAffiche[] = page.lignes.flatMap((ligne) => {
    const entreprise = parId.get(ligne.entrepriseId);
    if (entreprise === undefined) return [];
    return [
      {
        id: entreprise.id,
        nom: entreprise.nom,
        slug: entreprise.slug,
        formule: entreprise.abonnements[0]?.formule ?? 'gratuit',
        note: entreprise.noteMoyenne,
        nombreAvis: entreprise.nombreAvis,
        description: entreprise.fiche?.description ?? null,
        completude: entreprise.fiche?.completude ?? 0,
        rang: ligne.rang,
        sponsorise: ligne.sponsorise,
        raison: ligne.raison,
        communeAgence: entreprise.agences[0]?.commune.nom ?? null,
      },
    ];
  });

  return { metier, commune, pros, dernierRangSponsorise: page.dernierRangSponsorise };
});

/**
 * Le compteur qui fait tourner les Premium.
 *
 * Il change à chaque minute : sur un cycle, chaque abonné reçoit sa part exacte, et deux
 * visiteurs de la même minute voient la même page — ce qui garde les captures reproductibles
 * et le cache utile.
 */
function compteurAffichage(): number {
  return Math.floor(Date.now() / 60_000);
}

/* ------------------------------------------------------------------------- */
/* Fiche entreprise                                                           */
/* ------------------------------------------------------------------------- */

export const entrepriseParSlug = cache(async (slug: string) =>
  prisma.entreprise.findUnique({
    where: { slug },
    include: {
      fiche: { include: { photos: { orderBy: { rang: 'asc' } } } },
      agences: { include: { commune: true } },
      metiers: { include: { metier: { include: { univers: true } } } },
      prestations: { include: { prestation: { include: { prixPrestation: true } } } },
      abonnements: { where: { statut: 'actif' }, take: 1 },
      avis: {
        where: { statut: 'publie' },
        orderBy: { creeLe: 'desc' },
        take: 20,
        include: { reponse: true },
      },
      zones: { include: { commune: true } },
    },
  }),
);

/** Le nombre de pros référencés par métier dans une ville, pour les vitrines. */
export const compteProsParMetier = cache(async (codeCommune: string) => {
  const lignes = await prisma.metierPro.groupBy({
    by: ['metierId'],
    where: { entreprise: { zones: { some: { communeId: codeCommune } }, suspendue: false } },
    _count: { metierId: true },
  });
  return new Map(lignes.map((l) => [l.metierId, l._count.metierId]));
});
