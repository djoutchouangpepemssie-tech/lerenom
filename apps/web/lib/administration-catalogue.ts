import { prisma } from '@lerenom/db';

/**
 * Le catalogue, vu du back-office.
 *
 * Dix-huit univers, soixante-neuf métiers, quatre cent soixante-dix-neuf prestations : tous
 * **reconstruits**, faute des fichiers d'origine annoncés et jamais fournis (`QUESTIONS.md`
 * §Q1). Chacun porte `aValider` tant que personne ne l'a relu, et c'est tout le sujet de ce
 * module : le site propose aujourd'hui des métiers que personne n'a confirmés.
 *
 * Trois partis pris.
 *
 * **Valider ne se fait pas en un clic sur tout.** Un bouton « tout valider » viderait le
 * compteur sans que rien n'ait été lu, et le compteur est la seule trace de ce qui reste à
 * faire. La validation se fait par ligne, ou par univers entier — ce qui reste un geste
 * délibéré sur un ensemble qu'on vient de parcourir.
 *
 * **Un slug ne se renomme pas.** Il vit dans des adresses déjà indexées ; le changer casse
 * des liens et des référencements sans prévenir. Le nom affiché, lui, se corrige librement.
 * C'est la même règle que pour les communes, et pour la même raison.
 *
 * **Masquer n'est pas supprimer.** Un métier masqué disparaît du site mais garde ses
 * prestations, ses demandes passées et ses professionnels rattachés. Supprimer casserait des
 * lignes qui font foi.
 */

export type NiveauCatalogue = 'univers' | 'metier' | 'prestation';

export interface LigneCatalogue {
  readonly id: string;
  readonly slug: string;
  readonly nom: string;
  readonly rang: number;
  readonly masque: boolean;
  readonly aValider: boolean;
  /** Le parent, pour situer la ligne. Vide sur un univers. */
  readonly parent: string | null;
  /** Univers seulement : la qualification qui rend l'assurance obligatoire sur les documents. */
  readonly batiment?: boolean;
  /** Métier seulement : combien de prestations en dépendent. */
  readonly enfants?: number;
  /** Prestation seulement : son unité de facturation. */
  readonly unite?: string;
}

export interface EtatCatalogue {
  readonly univers: readonly LigneCatalogue[];
  readonly metiers: readonly LigneCatalogue[];
  readonly prestations: readonly LigneCatalogue[];
  readonly aValider: {
    readonly univers: number;
    readonly metiers: number;
    readonly prestations: number;
  };
}

export async function etatCatalogue(): Promise<EtatCatalogue> {
  const [univers, metiers, prestations] = await Promise.all([
    prisma.univers.findMany({
      orderBy: { rang: 'asc' },
      select: {
        id: true,
        slug: true,
        nom: true,
        rang: true,
        masque: true,
        aValider: true,
        batiment: true,
        _count: { select: { metiers: true } },
      },
    }),
    prisma.metier.findMany({
      orderBy: [{ univers: { rang: 'asc' } }, { rang: 'asc' }],
      select: {
        id: true,
        slug: true,
        nom: true,
        rang: true,
        masque: true,
        aValider: true,
        univers: { select: { nom: true } },
        _count: { select: { prestations: true } },
      },
    }),
    prisma.prestation.findMany({
      orderBy: [{ metier: { nom: 'asc' } }, { rang: 'asc' }],
      select: {
        id: true,
        slug: true,
        nom: true,
        rang: true,
        masque: true,
        aValider: true,
        unite: true,
        metier: { select: { nom: true } },
      },
    }),
  ]);

  return {
    univers: univers.map((ligne) => ({
      id: ligne.id,
      slug: ligne.slug,
      nom: ligne.nom,
      rang: ligne.rang,
      masque: ligne.masque,
      aValider: ligne.aValider,
      parent: null,
      batiment: ligne.batiment,
      enfants: ligne._count.metiers,
    })),
    metiers: metiers.map((ligne) => ({
      id: ligne.id,
      slug: ligne.slug,
      nom: ligne.nom,
      rang: ligne.rang,
      masque: ligne.masque,
      aValider: ligne.aValider,
      parent: ligne.univers.nom,
      enfants: ligne._count.prestations,
    })),
    prestations: prestations.map((ligne) => ({
      id: ligne.id,
      slug: ligne.slug,
      nom: ligne.nom,
      rang: ligne.rang,
      masque: ligne.masque,
      aValider: ligne.aValider,
      parent: ligne.metier.nom,
      unite: ligne.unite,
    })),
    aValider: {
      univers: univers.filter((ligne) => ligne.aValider).length,
      metiers: metiers.filter((ligne) => ligne.aValider).length,
      prestations: prestations.filter((ligne) => ligne.aValider).length,
    },
  };
}

/**
 * Ce qu'une modification peut changer. Le slug n'en fait pas partie, et c'est voulu.
 *
 * Les champs acceptent `undefined` explicitement : le code strict de ce dépôt distingue
 * « absent » de « présent et indéfini », et un objet construit à partir d'une analyse Zod
 * porte les deux sans qu'on puisse les séparer.
 */
export interface ModificationCatalogue {
  readonly nom?: string | undefined;
  readonly masque?: boolean | undefined;
  readonly aValider?: boolean | undefined;
  /** Univers seulement. */
  readonly batiment?: boolean | undefined;
}

export interface ResultatModification {
  readonly ok: boolean;
  readonly message?: string;
  /** L'état avant et après, pour le journal d'audit. */
  readonly avant?: unknown;
  readonly apres?: unknown;
}

const SELECTION = {
  univers: { id: true, slug: true, nom: true, masque: true, aValider: true, batiment: true },
  metier: { id: true, slug: true, nom: true, masque: true, aValider: true },
  prestation: { id: true, slug: true, nom: true, masque: true, aValider: true },
} as const;

/**
 * Modifie une ligne du catalogue.
 *
 * Rend l'état avant et après : c'est ce que le journal d'audit enregistre, et sans l'avant on
 * saurait qu'une valeur a changé sans plus savoir laquelle elle était — c'est précisément ce
 * qu'on cherche six mois plus tard.
 */
export async function modifieLeCatalogue(
  niveau: NiveauCatalogue,
  id: string,
  modification: ModificationCatalogue,
): Promise<ResultatModification> {
  const nom = modification.nom?.trim();
  if (nom !== undefined && nom === '') {
    return { ok: false, message: 'Un nom vide effacerait la ligne de tous les écrans.' };
  }
  if (modification.batiment !== undefined && niveau !== 'univers') {
    return { ok: false, message: 'La qualification « bâtiment » appartient à l’univers.' };
  }

  const donnees = {
    ...(nom !== undefined ? { nom } : {}),
    ...(modification.masque !== undefined ? { masque: modification.masque } : {}),
    ...(modification.aValider !== undefined ? { aValider: modification.aValider } : {}),
    ...(modification.batiment !== undefined ? { batiment: modification.batiment } : {}),
  };
  if (Object.keys(donnees).length === 0) return { ok: false, message: 'Rien à modifier.' };

  if (niveau === 'univers') {
    const avant = await prisma.univers.findUnique({ where: { id }, select: SELECTION.univers });
    if (avant === null) return { ok: false, message: 'Cet univers n’existe pas.' };
    const apres = await prisma.univers.update({
      where: { id },
      data: donnees,
      select: SELECTION.univers,
    });
    return { ok: true, avant, apres };
  }

  if (niveau === 'metier') {
    const avant = await prisma.metier.findUnique({ where: { id }, select: SELECTION.metier });
    if (avant === null) return { ok: false, message: 'Ce métier n’existe pas.' };
    const apres = await prisma.metier.update({
      where: { id },
      data: donnees,
      select: SELECTION.metier,
    });
    return { ok: true, avant, apres };
  }

  const avant = await prisma.prestation.findUnique({
    where: { id },
    select: SELECTION.prestation,
  });
  if (avant === null) return { ok: false, message: 'Cette prestation n’existe pas.' };
  const apres = await prisma.prestation.update({
    where: { id },
    data: donnees,
    select: SELECTION.prestation,
  });
  return { ok: true, avant, apres };
}

/**
 * Valide un univers entier : lui-même, ses métiers et leurs prestations.
 *
 * C'est le seul raccourci offert, et il est borné à un univers. « Tout valider » d'un clic
 * viderait le compteur sans que rien n'ait été lu — or le compteur est la seule trace de ce
 * qui reste à relire. Valider les dix-huit univers demande dix-huit gestes, et c'est le bon
 * ordre de grandeur pour une relecture qui engage le contenu du site.
 */
export async function valideUnUnivers(
  universId: string,
): Promise<{ ok: boolean; message?: string; valides: number }> {
  const univers = await prisma.univers.findUnique({
    where: { id: universId },
    select: { id: true, nom: true },
  });
  if (univers === null) return { ok: false, message: 'Cet univers n’existe pas.', valides: 0 };

  // Une transaction : valider l'univers sans ses métiers laisserait un état que personne n'a
  // voulu, et qui se lirait comme « relu » alors qu'il ne l'est qu'à moitié.
  const [parUnivers, parMetiers, parPrestations] = await prisma.$transaction([
    prisma.univers.updateMany({ where: { id: universId }, data: { aValider: false } }),
    prisma.metier.updateMany({ where: { universId }, data: { aValider: false } }),
    prisma.prestation.updateMany({
      where: { metier: { universId } },
      data: { aValider: false },
    }),
  ]);

  return {
    ok: true,
    valides: parUnivers.count + parMetiers.count + parPrestations.count,
  };
}
