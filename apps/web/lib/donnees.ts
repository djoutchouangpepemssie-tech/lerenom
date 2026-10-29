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
  readonly disponible: boolean;
  readonly interventionUrgente: boolean;
  readonly delaiReponseMinutes: number | null;
  readonly decennaleVerifiee: boolean;
}

/**
 * La page de résultats d'un métier dans une ville.
 *
 * La base fournit les entreprises éligibles, leur score du soir et leurs emplacements payés ;
 * `classePageResultats` décide de l'ordre. Aucun tri n'est fait en SQL : la règle d'affichage
 * est une règle métier, elle vit dans `packages/core` et nulle part ailleurs.
 */
export interface FiltresResultats {
  /** Intervient en urgence, sous 2 heures. */
  readonly urgence?: boolean;
  /** S'est déclaré disponible. */
  readonly disponible?: boolean;
  /** Note d'au moins 4,5 sur 5. */
  readonly bienNote?: boolean;
  /** Partenaires de Le Renom : Essentiel, Premium ou Exclusif. */
  readonly partenaires?: boolean;
  /** Assurance décennale vérifiée. */
  readonly decennale?: boolean;
  /** Une prestation précise du métier. */
  readonly prestation?: string;
  readonly tri?: 'pertinence' | 'note' | 'avis';
}

/** Un filtre est-il actif ? Une page filtrée n'est jamais indexée. */
export function filtresActifs(filtres: FiltresResultats): boolean {
  return (
    filtres.urgence === true ||
    filtres.disponible === true ||
    filtres.bienNote === true ||
    filtres.partenaires === true ||
    filtres.decennale === true ||
    filtres.prestation !== undefined ||
    (filtres.tri !== undefined && filtres.tri !== 'pertinence')
  );
}

/**
 * La page de résultats d'un métier dans une ville.
 *
 * Les filtres s'appliquent **avant** le classement, pas après : un partenaire Premium écarté
 * par un filtre ne doit pas occuper une place payée que personne ne voit. C'est aussi pour cela
 * que le tri par note ou par nombre d'avis ne touche que le classement naturel — les
 * emplacements payés restent en tête, c'est ce qui a été vendu, et ils restent étiquetés.
 *
 * La base fournit les entreprises éligibles, leur score du soir et leurs emplacements payés ;
 * `classePageResultats` décide de l'ordre. Aucun tri n'est fait en SQL : la règle d'affichage
 * est une règle métier, elle vit dans `packages/core` et nulle part ailleurs.
 */
export const resultats = cache(
  async (slugMetier: string, slugCommune: string, filtres: FiltresResultats = {}) => {
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
        ...(filtres.urgence === true ? { interventionUrgente: true } : {}),
        ...(filtres.disponible === true ? { disponible: true } : {}),
        ...(filtres.bienNote === true ? { noteMoyenne: { gte: 4.5 } } : {}),
        ...(filtres.partenaires === true ? { abonnements: { some: { statut: 'actif' } } } : {}),
        ...(filtres.decennale === true ? { fiche: { decennaleVerifieeLe: { not: null } } } : {}),
        ...(filtres.prestation !== undefined
          ? { prestations: { some: { prestation: { slug: filtres.prestation } } } }
          : {}),
      },
      include: {
        fiche: true,
        agences: { include: { commune: true }, take: 1 },
        // Seuls les emplacements qui courent encore : un emplacement résilié garde sa ligne
        // pour l'historique, il ne doit plus placer personne.
        emplacements: {
          where: {
            metierId: metier.id,
            communeId: commune.code,
            OR: [{ finitLe: null }, { finitLe: { gt: new Date() } }],
          },
          take: 1,
        },
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
      // **L'emplacement, pas l'abonnement.** Un emplacement Premium se vend par métier et par
      // ville, et le nombre en est limité — c'est ce qui en fait la valeur. Classer d'après
      // l'abonnement donnait une place sponsorisée dans *toutes* les villes et *tous* les
      // métiers de l'entreprise : on distribuait gratuitement ce qu'on vend à l'unité, et le
      // plafond par métier × ville ne tenait plus.
      //
      // L'abonnement reste la condition : un emplacement dont l'abonnement est résilié ne
      // place plus personne. Les deux doivent être vrais, et chacun pour sa raison.
      formule:
        entreprise.abonnements.length > 0
          ? (entreprise.emplacements[0]?.formule ?? 'gratuit')
          : 'gratuit',
      // Sans score du soir, l'entreprise part de zéro : elle apparaît, en fin de classement.
      score: entreprise.scores[0]?.score ?? 0,
      note: entreprise.noteMoyenne,
      titulaireExclusivite: entreprise.exclusivites.length > 0,
    }));

    const page = classePageResultats(candidats, PARAMETRES_PAR_DEFAUT, compteurAffichage());
    const parId = new Map(entreprises.map((e) => [e.id, e]));

    let pros: ProAffiche[] = page.lignes.flatMap((ligne) => {
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
          disponible: entreprise.disponible,
          interventionUrgente: entreprise.interventionUrgente,
          delaiReponseMinutes: entreprise.delaiReponseMinutes,
          decennaleVerifiee: entreprise.fiche?.decennaleVerifieeLe != null,
        },
      ];
    });

    // Le tri demandé ne réordonne que le classement naturel : les emplacements payés gardent
    // leur place, c'est exactement ce qui a été vendu.
    if (filtres.tri === 'note' || filtres.tri === 'avis') {
      const payes = pros.filter((p) => p.sponsorise);
      const naturels = pros.filter((p) => !p.sponsorise);
      naturels.sort((a, b) =>
        filtres.tri === 'note'
          ? (b.note ?? 0) - (a.note ?? 0) || b.nombreAvis - a.nombreAvis
          : b.nombreAvis - a.nombreAvis || (b.note ?? 0) - (a.note ?? 0),
      );
      pros = [...payes, ...naturels].map((pro, index) => ({ ...pro, rang: index + 1 }));
    }

    return { metier, commune, pros, dernierRangSponsorise: page.dernierRangSponsorise };
  },
);

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
