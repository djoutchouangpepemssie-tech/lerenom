import { prisma } from '@lerenom/db';

/**
 * Les professionnels, vus du back-office.
 *
 * Ce module existe pour une raison précise : **une entreprise naît non vérifiée, et une fiche
 * non vérifiée ne reçoit aucune demande.** C'est la contrepartie de la revendication libre —
 * n'importe qui peut réclamer une fiche, personne ne reçoit de client avant qu'un humain ait
 * regardé. Sans cet écran, personne ne pouvait regarder, et aucun inscrit ne pouvait démarrer.
 *
 * Trois files, une seule visible à la fois.
 *
 * **À vérifier** : les fiches revendiquées que personne n'a encore validées. C'est la file de
 * travail, et elle passe en premier parce qu'un artisan qui s'inscrit attend derrière.
 *
 * **Actives** : celles qui reçoivent des demandes aujourd'hui.
 *
 * **Écartées** : suspendues ou retirées. Elles ne disparaissent pas de cette liste — une
 * suspension se lève, et un retrait se vérifie.
 *
 * Deux refus assumés. **Aucune suppression** : une entreprise porte des demandes passées, des
 * avis et des factures émises, et les effacer casserait des lignes qui font foi. **Aucune
 * vérification en masse** : vérifier, c'est regarder, et un bouton qui valide trente fiches
 * d'un clic ne vérifie rien du tout.
 */

export type FileProfessionnels = 'a-verifier' | 'actives' | 'ecartees';

export interface ProfessionnelAdministration {
  readonly id: string;
  readonly nom: string;
  readonly slug: string;
  readonly siret: string | null;
  readonly commune: string | null;
  readonly metiers: readonly string[];
  readonly verifiee: boolean;
  readonly revendiquee: boolean;
  readonly suspendue: boolean;
  readonly retireeLe: Date | null;
  readonly motifRetrait: string | null;
  readonly diffusible: boolean;
  readonly noteMoyenne: number | null;
  readonly nombreAvis: number;
  readonly creeLe: Date;
  /** Comptes utilisateurs rattachés : sans aucun, personne ne peut se connecter à la fiche. */
  readonly comptes: number;
  readonly demandesRecues: number;
}

export interface EtatProfessionnels {
  readonly liste: readonly ProfessionnelAdministration[];
  readonly compteurs: {
    readonly aVerifier: number;
    readonly actives: number;
    readonly ecartees: number;
    /** Référencées depuis SIRENE, jamais revendiquées : le gros de l'annuaire. */
    readonly nonRevendiquees: number;
  };
}

const SELECTION = {
  id: true,
  nom: true,
  slug: true,
  siret: true,
  verifiee: true,
  revendiquee: true,
  suspendue: true,
  retireeLe: true,
  motifRetrait: true,
  diffusible: true,
  noteMoyenne: true,
  nombreAvis: true,
  creeLe: true,
  agences: {
    where: { principale: true },
    take: 1,
    select: { commune: { select: { nom: true } } },
  },
  metiers: { select: { metier: { select: { nom: true } } } },
  _count: { select: { utilisateurs: true, distributions: true } },
} as const;

type ProfessionnelBrut = {
  readonly id: string;
  readonly nom: string;
  readonly slug: string;
  readonly siret: string | null;
  readonly verifiee: boolean;
  readonly revendiquee: boolean;
  readonly suspendue: boolean;
  readonly retireeLe: Date | null;
  readonly motifRetrait: string | null;
  readonly diffusible: boolean;
  readonly noteMoyenne: number | null;
  readonly nombreAvis: number;
  readonly creeLe: Date;
  readonly agences: readonly { readonly commune: { readonly nom: string } }[];
  readonly metiers: readonly { readonly metier: { readonly nom: string } }[];
  readonly _count: { readonly utilisateurs: number; readonly distributions: number };
};

function presente(entreprise: ProfessionnelBrut): ProfessionnelAdministration {
  return {
    id: entreprise.id,
    nom: entreprise.nom,
    slug: entreprise.slug,
    siret: entreprise.siret,
    commune: entreprise.agences[0]?.commune.nom ?? null,
    metiers: entreprise.metiers.map((lien) => lien.metier.nom),
    verifiee: entreprise.verifiee,
    revendiquee: entreprise.revendiquee,
    suspendue: entreprise.suspendue,
    retireeLe: entreprise.retireeLe,
    motifRetrait: entreprise.motifRetrait,
    diffusible: entreprise.diffusible,
    noteMoyenne: entreprise.noteMoyenne,
    nombreAvis: entreprise.nombreAvis,
    creeLe: entreprise.creeLe,
    comptes: entreprise._count.utilisateurs,
    demandesRecues: entreprise._count.distributions,
  };
}

/**
 * Le filtre de chaque file.
 *
 * « À vérifier » ne couvre que les fiches **revendiquées** : l'annuaire compte des dizaines de
 * milliers d'entreprises importées de SIRENE que personne n'a réclamées, et les mêler à la
 * file de travail la rendrait inutilisable. Une fiche non revendiquée n'attend rien de nous.
 */
function filtre(file: FileProfessionnels) {
  if (file === 'a-verifier') {
    return { revendiquee: true, verifiee: false, retireeLe: null, suspendue: false };
  }
  if (file === 'actives') {
    return { verifiee: true, suspendue: false, retireeLe: null };
  }
  return { OR: [{ suspendue: true }, { retireeLe: { not: null } }] };
}

export async function etatProfessionnels(
  file: FileProfessionnels = 'a-verifier',
  recherche = '',
): Promise<EtatProfessionnels> {
  const terme = recherche.trim();
  const où = {
    ...filtre(file),
    ...(terme === ''
      ? {}
      : {
          OR: [
            { nom: { contains: terme, mode: 'insensitive' as const } },
            { siret: { startsWith: terme.replace(/\s/g, '') } },
          ],
        }),
  };

  const [liste, aVerifier, actives, ecartees, nonRevendiquees] = await Promise.all([
    prisma.entreprise.findMany({
      where: où,
      orderBy: file === 'a-verifier' ? { creeLe: 'asc' } : { nom: 'asc' },
      take: 200,
      select: SELECTION,
    }),
    prisma.entreprise.count({ where: filtre('a-verifier') }),
    prisma.entreprise.count({ where: filtre('actives') }),
    prisma.entreprise.count({ where: filtre('ecartees') }),
    prisma.entreprise.count({ where: { revendiquee: false, retireeLe: null } }),
  ]);

  return {
    liste: liste.map(presente),
    compteurs: { aVerifier, actives, ecartees, nonRevendiquees },
  };
}

export type ActionProfessionnel = 'verifier' | 'retirer-verification' | 'suspendre' | 'reactiver';

export interface ResultatAction {
  readonly ok: boolean;
  readonly message?: string;
  readonly avant?: unknown;
  readonly apres?: unknown;
}

/**
 * Vérifie, dévérifie, suspend ou réactive une entreprise.
 *
 * **Retirer une vérification est possible, et doit l'être.** Une fiche validée par erreur — un
 * SIRET qui s'avère radié, une identité douteuse — doit pouvoir redescendre sans qu'on ait à
 * suspendre tout le compte. Les deux gestes ne disent pas la même chose : dévérifier retire de
 * la distribution, suspendre ferme l'accès.
 *
 * **La suspension exige un motif.** Elle coupe les revenus de quelqu'un ; celui qui la décide
 * doit écrire pourquoi, et le journal d'audit le garde. Une suspension sans motif est une
 * décision que personne ne pourra expliquer dans six mois, y compris celui qui l'a prise.
 */
export async function agitSurLeProfessionnel(
  entrepriseId: string,
  action: ActionProfessionnel,
  motif: string | null,
): Promise<ResultatAction> {
  const avant = await prisma.entreprise.findUnique({
    where: { id: entrepriseId },
    select: { id: true, nom: true, verifiee: true, suspendue: true, revendiquee: true },
  });
  if (avant === null) return { ok: false, message: 'Cette entreprise n’existe pas.' };

  if (action === 'verifier' && !avant.revendiquee) {
    return {
      ok: false,
      message:
        'Cette fiche n’a pas été revendiquée : il n’y a personne à vérifier, et personne pour recevoir les demandes.',
    };
  }

  const propre = motif?.trim() ?? '';
  if (action === 'suspendre' && propre.length < 10) {
    return {
      ok: false,
      message:
        'Une suspension coupe les revenus de quelqu’un : écrivez pourquoi, en une phrase au moins.',
    };
  }

  const donnees =
    action === 'verifier'
      ? { verifiee: true }
      : action === 'retirer-verification'
        ? { verifiee: false }
        : action === 'suspendre'
          ? { suspendue: true }
          : { suspendue: false };

  const apres = await prisma.entreprise.update({
    where: { id: entrepriseId },
    data: donnees,
    select: { id: true, nom: true, verifiee: true, suspendue: true },
  });

  return {
    ok: true,
    avant: { verifiee: avant.verifiee, suspendue: avant.suspendue },
    apres: {
      verifiee: apres.verifiee,
      suspendue: apres.suspendue,
      ...(propre === '' ? {} : { motif: propre }),
    },
  };
}
