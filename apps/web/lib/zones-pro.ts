import { prisma } from '@lerenom/db';
import { REGLES_VALIDEES, nombreDePages, type Formule } from '@lerenom/core';

/**
 * Les métiers et les villes d'un professionnel, depuis son espace.
 *
 * L'inscription fixe un périmètre ; la vie d'une entreprise le fait bouger. Cet écran est ce
 * qui permet d'ouvrir une ville, d'ajouter un métier ou de se replier — sans repasser par
 * l'inscription, qui n'existe qu'une fois.
 *
 * Deux refus sont posés ici, et ce sont eux qui méritent attention.
 *
 * **On ne retire jamais une ville en silence.** À l'inscription, les villes au-delà du
 * plafond étaient retirées automatiquement : le professionnel les avait vues partir à
 * l'écran avant de valider. Ici, personne ne regarde par-dessus son épaule. Dépasser le
 * plafond est donc refusé, avec le compte exact, plutôt que corrigé d'autorité.
 *
 * **On ne retire pas une ville qui porte un emplacement payé.** Une exclusivité ou un
 * emplacement en cours y est rattaché ; supprimer la zone laisserait un emplacement vendu
 * sans zone pour l'honorer. Le refus nomme la ville concernée.
 */

export interface MetierChoisissable {
  readonly slug: string;
  readonly nom: string;
  readonly universSlug: string;
  readonly universNom: string;
  readonly choisi: boolean;
  readonly principal: boolean;
}

export interface VilleChoisissable {
  readonly code: string;
  readonly nom: string;
  readonly departementCode: string;
  readonly departementNom: string;
  readonly statut: 'ouvert' | 'bientot' | 'annuaire';
  readonly choisie: boolean;
  /** Vrai quand un emplacement payé ou une exclusivité y est en cours. */
  readonly verrouillee: boolean;
}

export interface PerimetreDuPro {
  readonly formule: Formule;
  readonly villesMax: number | null;
  readonly metiers: readonly MetierChoisissable[];
  readonly villes: readonly VilleChoisissable[];
  readonly nombreDePages: number;
}

/** Le périmètre actuel, et tout ce parmi quoi choisir. */
export async function perimetreDuPro(entrepriseId: string): Promise<PerimetreDuPro | null> {
  const entreprise = await prisma.entreprise.findUnique({
    where: { id: entrepriseId },
    select: {
      metiers: { select: { metierId: true, principal: true } },
      zones: { select: { communeId: true } },
      abonnements: { where: { statut: 'actif' }, select: { formule: true }, take: 1 },
      exclusivites: { where: { active: true }, select: { communeId: true } },
      emplacements: { select: { communeId: true, finitLe: true } },
    },
  });
  if (entreprise === null) return null;

  const [metiers, communes] = await Promise.all([
    prisma.metier.findMany({
      where: { masque: false },
      orderBy: [{ univers: { rang: 'asc' } }, { rang: 'asc' }],
      select: { id: true, slug: true, nom: true, univers: { select: { slug: true, nom: true } } },
    }),
    prisma.commune.findMany({
      orderBy: [{ departementId: 'asc' }, { statut: 'asc' }, { population: 'desc' }],
      select: {
        code: true,
        nom: true,
        statut: true,
        departement: { select: { code: true, nom: true } },
      },
    }),
  ]);

  const choisis = new Map(entreprise.metiers.map((lien) => [lien.metierId, lien.principal]));
  const zones = new Set(entreprise.zones.map((zone) => zone.communeId));

  const maintenant = Date.now();
  const verrouillees = new Set<string>([
    ...entreprise.exclusivites.map((exclusivite) => exclusivite.communeId),
    ...entreprise.emplacements
      .filter(
        (emplacement) => emplacement.finitLe === null || emplacement.finitLe.getTime() > maintenant,
      )
      .map((emplacement) => emplacement.communeId),
  ]);

  const formule: Formule = entreprise.abonnements[0]?.formule ?? 'gratuit';

  return {
    formule,
    villesMax: REGLES_VALIDEES.villesMax[formule],
    metiers: metiers.map((metier) => ({
      slug: metier.slug,
      nom: metier.nom,
      universSlug: metier.univers.slug,
      universNom: metier.univers.nom,
      choisi: choisis.has(metier.id),
      principal: choisis.get(metier.id) === true,
    })),
    villes: communes.map((commune) => ({
      code: commune.code,
      nom: commune.nom,
      departementCode: commune.departement.code,
      departementNom: commune.departement.nom,
      statut: commune.statut,
      choisie: zones.has(commune.code),
      verrouillee: verrouillees.has(commune.code),
    })),
    nombreDePages: nombreDePages(zones.size, choisis.size),
  };
}

export interface SaisiePerimetre {
  readonly metiers: readonly string[];
  readonly metierPrincipal: string | null;
  readonly villes: readonly string[];
}

export type ResultatPerimetre =
  | { readonly ok: true; readonly nombreDePages: number }
  | { readonly ok: false; readonly message: string };

/** Enregistre le nouveau périmètre, ou dit précisément pourquoi il est refusé. */
export async function enregistrePerimetre(
  entrepriseId: string,
  saisie: SaisiePerimetre,
): Promise<ResultatPerimetre> {
  if (saisie.metiers.length === 0) {
    return {
      ok: false,
      message: 'Gardez au moins un métier : sans lui, votre fiche n’apparaît nulle part.',
    };
  }
  if (saisie.villes.length === 0) {
    return {
      ok: false,
      message: 'Gardez au moins une ville : sans zone, vous ne recevez aucune demande.',
    };
  }
  if (saisie.metierPrincipal === null || !saisie.metiers.includes(saisie.metierPrincipal)) {
    return {
      ok: false,
      message: 'Désignez un métier principal parmi les métiers que vous gardez.',
    };
  }

  const entreprise = await prisma.entreprise.findUnique({
    where: { id: entrepriseId },
    select: {
      zones: { select: { communeId: true } },
      abonnements: { where: { statut: 'actif' }, select: { formule: true }, take: 1 },
      exclusivites: { where: { active: true }, select: { communeId: true } },
      emplacements: { select: { communeId: true, finitLe: true } },
    },
  });
  if (entreprise === null) return { ok: false, message: 'Entreprise introuvable.' };

  const formule: Formule = entreprise.abonnements[0]?.formule ?? 'gratuit';
  const plafond = REGLES_VALIDEES.villesMax[formule];
  const demandees = new Set(saisie.villes);

  if (plafond !== null && demandees.size > plafond) {
    return {
      ok: false,
      message: `Votre formule ${formule} ouvre ${String(plafond)} villes, et vous en avez choisi ${String(demandees.size)}. Retirez-en ${String(demandees.size - plafond)}, ou changez de formule.`,
    };
  }

  const maintenant = Date.now();
  const verrouillees = new Set<string>([
    ...entreprise.exclusivites.map((exclusivite) => exclusivite.communeId),
    ...entreprise.emplacements
      .filter(
        (emplacement) => emplacement.finitLe === null || emplacement.finitLe.getTime() > maintenant,
      )
      .map((emplacement) => emplacement.communeId),
  ]);

  const retirees = [...verrouillees].filter((code) => !demandees.has(code));
  if (retirees.length > 0) {
    const noms = await prisma.commune.findMany({
      where: { code: { in: retirees } },
      select: { nom: true },
      orderBy: { nom: 'asc' },
    });
    const liste = noms.map((commune) => commune.nom).join(', ');
    return {
      ok: false,
      message: `Un emplacement payé ou une exclusivité est en cours à ${liste}. Retirer cette zone laisserait cet emplacement sans ville où l’honorer : écrivez-nous pour y mettre fin d’abord.`,
    };
  }

  const [metiers, communes] = await Promise.all([
    prisma.metier.findMany({
      where: { slug: { in: [...saisie.metiers] }, masque: false },
      select: { id: true, slug: true },
    }),
    prisma.commune.findMany({ where: { code: { in: [...demandees] } }, select: { code: true } }),
  ]);

  if (metiers.length !== new Set(saisie.metiers).size) {
    return { ok: false, message: 'Un des métiers choisis n’existe plus.' };
  }
  if (communes.length !== demandees.size) {
    return { ok: false, message: 'Une des villes choisies n’existe plus.' };
  }

  await prisma.$transaction(async (tx) => {
    // Remplacement complet plutôt que différentiel : le périmètre est un ensemble, et calculer
    // l'écart à la main serait une occasion de plus de se tromper.
    await tx.metierPro.deleteMany({ where: { entrepriseId } });
    await tx.metierPro.createMany({
      data: metiers.map((metier) => ({
        entrepriseId,
        metierId: metier.id,
        principal: metier.slug === saisie.metierPrincipal,
      })),
    });

    await tx.zonePro.deleteMany({ where: { entrepriseId } });
    await tx.zonePro.createMany({
      data: communes.map((commune) => ({ entrepriseId, communeId: commune.code })),
    });
  });

  return { ok: true, nombreDePages: nombreDePages(communes.length, metiers.length) };
}
