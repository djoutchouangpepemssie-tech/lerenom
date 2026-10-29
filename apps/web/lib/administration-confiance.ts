import { caviarde, moyenneDesCriteres, signauxDeModeration } from '@lerenom/core';
import type { CritereAvis, SignalAvis } from '@lerenom/core';
import { prisma } from '@lerenom/db';

/**
 * La confiance, vue du back-office.
 *
 * Deux trous se sont révélés en ouvrant ce chantier, et ils se tenaient par la main.
 *
 * **Aucun avis n'était jamais publié.** Le dépôt crée l'avis en `en_attente` et pose une tâche
 * `avis_a_moderer` ; rien, nulle part, ne lisait cette file. Un client pouvait écrire, l'avis
 * était bien enregistré, et il n'apparaissait jamais. Du point de vue du client comme du
 * professionnel, la fonctionnalité n'existait pas.
 *
 * **La note moyenne n'était jamais recalculée.** `noteMoyenne` et `nombreAvis` ne valaient que
 * ce que le semis y avait mis. Ce sont pourtant les deux chiffres qui s'affichent sur la fiche
 * et qui pèsent dans le classement de la cascade : une note figée, c'est un classement fondé
 * sur une fiction. La publication les recalcule maintenant, dans la même transaction.
 *
 * Le parti pris de la modération est celui que `packages/core` porte déjà : on ne refuse pas
 * en bloc un avis qui contient un numéro de téléphone, on le publie **sans** le numéro, et le
 * retrait est visible — « [numéro retiré] ». L'auteur a pris la peine d'écrire ; son avis
 * compte. Mais réécrire le propos de quelqu'un sans le dire serait pire que ne rien publier.
 */

export type FileConfiance = 'avis' | 'contestations' | 'signalements';

export interface AvisAModerer {
  readonly id: string;
  readonly entreprise: string;
  readonly entrepriseSlug: string;
  readonly auteur: string;
  readonly note: number;
  readonly moyenneCriteres: number | null;
  /** Le texte tel que l'auteur l'a écrit. Il n'est jamais modifié. */
  readonly commentaire: string | null;
  /** Ce que la publication donnerait, caviardage appliqué. Égal au précédent le plus souvent. */
  readonly apercuPublic: string | null;
  readonly retraits: readonly ('telephone' | 'email' | 'lien')[];
  readonly signaux: readonly SignalAvis[];
  readonly deposeLe: Date;
  readonly reference: string;
  readonly signalements: number;
}

export interface ContestationAJuger {
  readonly id: string;
  readonly entreprise: string;
  readonly reference: string;
  readonly motif: string;
  readonly explication: string;
  readonly deposeeLe: Date;
  readonly echeanceLe: Date;
  /** Vrai quand les 48 heures sont passées : le professionnel attend depuis trop longtemps. */
  readonly enRetard: boolean;
}

export interface SignalementAJuger {
  readonly id: string;
  readonly typeContenu: string;
  readonly contenuId: string;
  readonly motif: string;
  readonly explication: string;
  readonly creeLe: Date;
}

export interface EtatConfiance {
  readonly avis: readonly AvisAModerer[];
  readonly contestations: readonly ContestationAJuger[];
  readonly signalements: readonly SignalementAJuger[];
  readonly indicateurs: {
    readonly avis: number;
    readonly contestations: number;
    readonly contestationsEnRetard: number;
    readonly signalements: number;
  };
}

/**
 * Les libellés des motifs de contestation, en français lisible.
 *
 * Les valeurs stockées sont des identifiants (`coordonnees_fausses`) : les afficher telles
 * quelles donnerait un écran écrit en nom de colonne.
 */
const LIBELLE_MOTIF: Readonly<Record<string, string>> = {
  annulation_immediate: 'Annulation immédiate du client',
  coordonnees_fausses: 'Coordonnées fausses',
  client_injoignable: 'Client injoignable',
  hors_zone: 'Hors de la zone d’intervention',
  hors_metier: 'Hors du métier',
  doublon: 'Doublon',
  demande_fantaisiste: 'Demande fantaisiste',
};

export function libelleMotif(motif: string): string {
  return LIBELLE_MOTIF[motif] ?? motif;
}

export async function etatConfiance(maintenant = new Date()): Promise<EtatConfiance> {
  const [avis, contestations, signalements] = await Promise.all([
    prisma.avis.findMany({
      where: { statut: { in: ['en_attente', 'signale'] } },
      // Les plus anciens d'abord : un avis qui attend est un client qui a écrit dans le vide
      // et un professionnel dont la note ne bouge pas.
      orderBy: { creeLe: 'asc' },
      take: 200,
      select: {
        id: true,
        note: true,
        criteres: true,
        commentaire: true,
        auteurPrenom: true,
        creeLe: true,
        entreprise: { select: { nom: true, slug: true } },
        demande: { select: { reference: true } },
        _count: { select: { signalements: true } },
      },
    }),
    prisma.contestation.findMany({
      where: { statut: 'en_attente' },
      orderBy: { echeanceLe: 'asc' },
      take: 200,
      select: {
        id: true,
        motif: true,
        explication: true,
        deposeeLe: true,
        echeanceLe: true,
        entreprise: { select: { nom: true } },
        demande: { select: { reference: true } },
      },
    }),
    prisma.signalementDsa.findMany({
      where: { statut: 'en_attente' },
      orderBy: { creeLe: 'asc' },
      take: 200,
      select: {
        id: true,
        typeContenu: true,
        contenuId: true,
        motif: true,
        explication: true,
        creeLe: true,
      },
    }),
  ]);

  const avisPresentes = avis.map((ligne): AvisAModerer => {
    const commentaire = ligne.commentaire;
    const caviardage = commentaire === null ? null : caviarde(commentaire);
    return {
      id: ligne.id,
      entreprise: ligne.entreprise.nom,
      entrepriseSlug: ligne.entreprise.slug,
      auteur: ligne.auteurPrenom,
      note: ligne.note,
      moyenneCriteres: moyenneDesCriteres(
        (ligne.criteres ?? undefined) as Partial<Record<CritereAvis, number>> | undefined,
      ),
      commentaire,
      apercuPublic: caviardage?.texte ?? null,
      retraits: caviardage?.retraits ?? [],
      signaux: commentaire === null ? [] : signauxDeModeration(commentaire),
      deposeLe: ligne.creeLe,
      reference: ligne.demande.reference,
      signalements: ligne._count.signalements,
    };
  });

  const contestationsPresentees = contestations.map((ligne): ContestationAJuger => ({
    id: ligne.id,
    entreprise: ligne.entreprise.nom,
    reference: ligne.demande.reference,
    motif: libelleMotif(ligne.motif),
    explication: ligne.explication,
    deposeeLe: ligne.deposeeLe,
    echeanceLe: ligne.echeanceLe,
    enRetard: ligne.echeanceLe.getTime() < maintenant.getTime(),
  }));

  return {
    avis: avisPresentes,
    contestations: contestationsPresentees,
    signalements,
    indicateurs: {
      avis: avisPresentes.length,
      contestations: contestationsPresentees.length,
      contestationsEnRetard: contestationsPresentees.filter((c) => c.enRetard).length,
      signalements: signalements.length,
    },
  };
}

export interface ResultatModeration {
  readonly ok: boolean;
  readonly message?: string;
  readonly avant?: unknown;
  readonly apres?: unknown;
}

/**
 * Recalcule la note moyenne et le nombre d'avis d'une entreprise.
 *
 * À partir des avis **publiés**, et d'eux seuls : un avis en attente ne compte pas, un avis
 * refusé non plus. Sans ce recalcul, `noteMoyenne` ne valait que ce que le semis y avait mis —
 * or c'est le chiffre affiché sur la fiche **et** celui que la cascade utilise pour classer.
 *
 * La moyenne est arrondie à une décimale, parce que c'est ainsi qu'elle est affichée partout :
 * stocker 4,3666… pour afficher 4,4 ferait diverger le classement de ce que montre la fiche.
 */
async function recalculeLaNote(
  entrepriseId: string,
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<void> {
  const agregat = await transaction.avis.aggregate({
    where: { entrepriseId, statut: 'publie' },
    _avg: { note: true },
    _count: { _all: true },
  });

  const moyenne = agregat._avg.note;
  await transaction.entreprise.update({
    where: { id: entrepriseId },
    data: {
      noteMoyenne: moyenne === null ? null : Math.round(moyenne * 10) / 10,
      nombreAvis: agregat._count._all,
    },
  });
}

/**
 * Publie un avis, caviardé s'il le faut.
 *
 * Le texte d'origine n'est **jamais** écrasé : `commentaire` garde ce que l'auteur a écrit, et
 * `commentairePublic` porte la version publiée quand elle en diffère. Le relecteur a donc
 * toujours sous les yeux ce qu'on lui a confié, et un litige se tranche sur la source.
 *
 * Quand rien n'a été retiré, `commentairePublic` reste `null` — c'est le cas général, et poser
 * une copie identique ferait croire à une intervention qui n'a pas eu lieu.
 */
export async function publieLAvis(avisId: string, adminId: string): Promise<ResultatModeration> {
  const avis = await prisma.avis.findUnique({
    where: { id: avisId },
    select: { id: true, statut: true, commentaire: true, entrepriseId: true, note: true },
  });
  if (avis === null) return { ok: false, message: 'Cet avis n’existe pas.' };
  if (avis.statut === 'publie') return { ok: false, message: 'Cet avis est déjà publié.' };

  const caviardage = avis.commentaire === null ? null : caviarde(avis.commentaire);
  const aCaviarder = caviardage !== null && caviardage.retraits.length > 0;

  await prisma.$transaction(async (transaction) => {
    await transaction.avis.update({
      where: { id: avisId },
      data: {
        statut: 'publie',
        publieLe: new Date(),
        modereLe: new Date(),
        moderePar: adminId,
        motifRefus: null,
        commentairePublic: aCaviarder ? caviardage.texte : null,
      },
    });
    await transaction.tacheAValider.updateMany({
      where: { type: 'avis_a_moderer', objetId: avisId, valideeLe: null, refuseeLe: null },
      data: { valideeLe: new Date(), valideePar: adminId },
    });
    await recalculeLaNote(avis.entrepriseId, transaction);
  });

  return {
    ok: true,
    avant: { statut: avis.statut },
    apres: {
      statut: 'publie',
      note: avis.note,
      ...(aCaviarder ? { retraits: caviardage.retraits } : {}),
    },
  };
}

/**
 * Refuse un avis, avec son motif.
 *
 * Le motif est obligatoire. Un avis refusé est la parole d'un client qu'on écarte : celui qui
 * la retire doit écrire pourquoi, et le journal d'audit le garde. C'est aussi ce qui permettra
 * de répondre à l'auteur s'il demande des comptes — et le DSA prévoit qu'il le puisse.
 */
export async function refuseLAvis(
  avisId: string,
  adminId: string,
  motif: string,
): Promise<ResultatModeration> {
  const propre = motif.trim();
  if (propre.length < 10) {
    return {
      ok: false,
      message:
        'Refuser un avis, c’est écarter la parole d’un client : écrivez pourquoi, en une phrase au moins.',
    };
  }

  const avis = await prisma.avis.findUnique({
    where: { id: avisId },
    select: { id: true, statut: true, entrepriseId: true },
  });
  if (avis === null) return { ok: false, message: 'Cet avis n’existe pas.' };

  await prisma.$transaction(async (transaction) => {
    await transaction.avis.update({
      where: { id: avisId },
      data: {
        statut: 'refuse',
        publieLe: null,
        commentairePublic: null,
        modereLe: new Date(),
        moderePar: adminId,
        motifRefus: propre,
      },
    });
    await transaction.tacheAValider.updateMany({
      where: { type: 'avis_a_moderer', objetId: avisId, valideeLe: null, refuseeLe: null },
      data: { refuseeLe: new Date(), motifRefus: propre },
    });
    // Recalcul aussi au refus : un avis déjà publié puis retiré doit sortir de la moyenne.
    await recalculeLaNote(avis.entrepriseId, transaction);
  });

  return { ok: true, avant: { statut: avis.statut }, apres: { statut: 'refuse', motif: propre } };
}
