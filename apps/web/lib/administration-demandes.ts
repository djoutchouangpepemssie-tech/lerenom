import type { Prisma } from '@lerenom/db';
import { prisma } from '@lerenom/db';

/**
 * Le centre de distribution, vu du back-office.
 *
 * C'est l'écran qui dit si le produit fait son travail. Une demande déposée doit trouver un
 * professionnel ; tout le reste — les fiches, les avis, les devis — n'existe que pour cela.
 *
 * Trois listes, une seule visible à la fois.
 *
 * **En cours** montre la cascade telle qu'elle est maintenant : quels professionnels ont été
 * sollicités, à quel tour, qui a ouvert, qui a répondu, et combien de temps il reste à chacun.
 * C'est la vue « temps réel » du cahier des charges, et sa valeur tient au détail : savoir
 * qu'une demande est « en distribution » n'apprend rien ; savoir que trois pros l'ont reçue il
 * y a deux heures et qu'aucun ne l'a ouverte apprend tout.
 *
 * **Sans preneur** montre les échecs. C'est la seule liste qu'on espère vide, et la seule qui
 * mérite qu'on la regarde en premier le matin.
 *
 * **À classer** montre les demandes dont le classement automatique n'est pas sûr de lui —
 * moins de 0,70 de confiance — ou qui n'ont pas de métier du tout. Une demande mal classée
 * part aux mauvais professionnels, qui la refusent : c'est un client déçu et trois pros
 * dérangés pour rien.
 */

/** En dessous, le classement automatique n'est pas assez sûr pour décider seul. */
export const CONFIANCE_MINIMALE = 0.7;

export interface ProSollicite {
  readonly entreprise: string;
  readonly rang: number;
  readonly tour: number;
  readonly statut: string;
  readonly envoyeeLe: Date;
  readonly echeanceLe: Date;
  readonly ouverteLe: Date | null;
  readonly repondueLe: Date | null;
  readonly distanceKm: number | null;
  readonly manuel: boolean;
}

export interface DemandeAdministration {
  readonly id: string;
  readonly reference: string;
  readonly statut: string;
  readonly urgence: string;
  readonly metier: string | null;
  readonly prestation: string | null;
  readonly commune: string;
  readonly client: string;
  readonly deposeeLe: Date;
  readonly telephoneVerifie: boolean;
  readonly confiance: number | null;
  readonly classeeParAdmin: boolean;
  readonly objectifPros: number;
  /** Un professionnel a refusé en disant que ce n'est pas son métier. */
  readonly signaleeHorsMetier: boolean;
  readonly pros: readonly ProSollicite[];
  /** Combien ont accepté. C'est le seul chiffre qui dise si la demande a abouti. */
  readonly acceptees: number;
}

export interface EtatDemandes {
  readonly enCours: readonly DemandeAdministration[];
  readonly sansPreneur: readonly DemandeAdministration[];
  readonly aClasser: readonly DemandeAdministration[];
  readonly indicateurs: {
    readonly enDistribution: number;
    readonly sansPreneur: number;
    readonly aClasser: number;
    /** Demandes non vérifiées par SMS : déposées, jamais confirmées, jamais distribuées. */
    readonly nonVerifiees: number;
  };
}

const SELECTION = {
  id: true,
  reference: true,
  statut: true,
  urgence: true,
  deposeeLe: true,
  telephoneVerifieLe: true,
  confianceClassement: true,
  classeeParAdmin: true,
  objectifPros: true,
  clientPrenom: true,
  clientNom: true,
  metier: { select: { nom: true } },
  prestation: { select: { nom: true } },
  commune: { select: { nom: true } },
  distributions: {
    orderBy: [{ tour: 'asc' }, { rang: 'asc' }],
    select: {
      rang: true,
      tour: true,
      statut: true,
      envoyeeLe: true,
      echeanceLe: true,
      ouverteLe: true,
      repondueLe: true,
      distanceKm: true,
      manuel: true,
      entreprise: { select: { nom: true } },
    },
  },
} satisfies Prisma.DemandeSelect;

type DemandeBrute = {
  readonly id: string;
  readonly reference: string;
  readonly statut: string;
  readonly urgence: string;
  readonly deposeeLe: Date;
  readonly telephoneVerifieLe: Date | null;
  readonly confianceClassement: number | null;
  readonly classeeParAdmin: boolean;
  readonly objectifPros: number;
  readonly clientPrenom: string;
  readonly clientNom: string | null;
  readonly metier: { readonly nom: string } | null;
  readonly prestation: { readonly nom: string } | null;
  readonly commune: { readonly nom: string };
  readonly distributions: readonly {
    readonly rang: number;
    readonly tour: number;
    readonly statut: string;
    readonly envoyeeLe: Date;
    readonly echeanceLe: Date;
    readonly ouverteLe: Date | null;
    readonly repondueLe: Date | null;
    readonly distanceKm: number | null;
    readonly manuel: boolean;
    readonly entreprise: { readonly nom: string };
  }[];
};

/**
 * Les demandes qu'un professionnel a signalées comme « pas mon métier ».
 *
 * Le refus avec ce motif crée une tâche `classement-demande` — et **rien ne la lisait**.
 * C'est pourtant le meilleur signal de mauvais classement qui existe : il ne vient pas d'une
 * machine qui doute, mais d'un plombier qui dit qu'il ne fait pas de serrurerie. Pendant ce
 * temps la demande restait mal classée et repartait à d'autres mauvais professionnels.
 */
async function demandesSignaleesHorsMetier(): Promise<ReadonlySet<string>> {
  const taches = await prisma.tacheAValider.findMany({
    where: { type: 'classement-demande', valideeLe: null, refuseeLe: null },
    select: { objetId: true },
  });
  return new Set(taches.map((tache) => tache.objetId));
}

function presente(demande: DemandeBrute, horsMetier: ReadonlySet<string>): DemandeAdministration {
  return {
    id: demande.id,
    reference: demande.reference,
    statut: demande.statut,
    urgence: demande.urgence,
    metier: demande.metier?.nom ?? null,
    prestation: demande.prestation?.nom ?? null,
    commune: demande.commune.nom,
    // Le nom complet n'apparaît pas : le prénom et l'initiale suffisent à reconnaître une
    // demande dans une liste, et un écran d'exploitation n'a pas à étaler l'identité des
    // clients à qui le regarde par-dessus l'épaule.
    client: `${demande.clientPrenom}${demande.clientNom === null ? '' : ` ${demande.clientNom.charAt(0)}.`}`,
    deposeeLe: demande.deposeeLe,
    telephoneVerifie: demande.telephoneVerifieLe !== null,
    confiance: demande.confianceClassement,
    classeeParAdmin: demande.classeeParAdmin,
    objectifPros: demande.objectifPros,
    signaleeHorsMetier: horsMetier.has(demande.id),
    pros: demande.distributions.map((distribution) => ({
      entreprise: distribution.entreprise.nom,
      rang: distribution.rang,
      tour: distribution.tour,
      statut: distribution.statut,
      envoyeeLe: distribution.envoyeeLe,
      echeanceLe: distribution.echeanceLe,
      ouverteLe: distribution.ouverteLe,
      repondueLe: distribution.repondueLe,
      distanceKm: distribution.distanceKm,
      manuel: distribution.manuel,
    })),
    acceptees: demande.distributions.filter((d) => d.statut === 'acceptee').length,
  };
}

export async function etatDemandes(): Promise<EtatDemandes> {
  const horsMetier = await demandesSignaleesHorsMetier();

  const [enCours, sansPreneur, aClasser, nonVerifiees] = await Promise.all([
    prisma.demande.findMany({
      where: { statut: { in: ['en_distribution', 'en_attente_de_relance'] } },
      orderBy: { deposeeLe: 'asc' },
      take: 200,
      select: SELECTION,
    }),
    prisma.demande.findMany({
      where: { statut: 'sans_preneur' },
      orderBy: { deposeeLe: 'desc' },
      take: 200,
      select: SELECTION,
    }),
    // Les deux cas qui demandent une main humaine : pas de métier du tout, ou un classement
    // automatique qui doute. Les brouillons en sont exclus — tant que le mobile n'est pas
    // vérifié, la demande n'existe pas encore vraiment.
    prisma.demande.findMany({
      where: {
        statut: { notIn: ['brouillon', 'annulee'] },
        classeeParAdmin: false,
        OR: [
          { metierId: null },
          { confianceClassement: { lt: CONFIANCE_MINIMALE } },
          // Le signalement d'un professionnel vaut mieux qu'un score de confiance : la
          // machine doute, lui sait. Une demande qu'il a refusée pour « pas mon métier »
          // entre dans la file même si le classement automatique était sûr de lui — c'est
          // justement le cas où il s'est trompé avec assurance.
          { id: { in: [...horsMetier] } },
        ],
      },
      orderBy: { deposeeLe: 'asc' },
      take: 200,
      select: SELECTION,
    }),
    prisma.demande.count({ where: { statut: 'brouillon' } }),
  ]);

  return {
    enCours: enCours.map((d) => presente(d, horsMetier)),
    sansPreneur: sansPreneur.map((d) => presente(d, horsMetier)),
    aClasser: aClasser.map((d) => presente(d, horsMetier)),
    indicateurs: {
      enDistribution: enCours.length,
      sansPreneur: sansPreneur.length,
      aClasser: aClasser.length,
      nonVerifiees,
    },
  };
}

/** Les métiers proposés pour classer une demande à la main. */
export async function metiersDisponibles(): Promise<readonly { id: string; nom: string }[]> {
  return prisma.metier.findMany({
    where: { masque: false },
    orderBy: [{ univers: { rang: 'asc' } }, { rang: 'asc' }],
    select: { id: true, nom: true },
  });
}

export interface ResultatClassement {
  readonly ok: boolean;
  readonly message?: string;
  readonly avant?: unknown;
  readonly apres?: unknown;
}

/**
 * Classe une demande à la main.
 *
 * `classeeParAdmin` passe à vrai, et ce n'est pas décoratif : la demande quitte la file « à
 * classer » même si la confiance du classement automatique reste basse. Sans ce drapeau, une
 * demande reclassée réapparaîtrait indéfiniment dans la file de celui qui vient de la traiter.
 *
 * La distribution n'est **pas** relancée ici. Reclasser une demande déjà partie à trois
 * professionnels et la renvoyer à trois autres doublerait le dérangement et la facture ; c'est
 * une décision distincte, qui n'existe pas encore (voir `QUESTIONS.md` §Q37).
 */
export async function classeLaDemande(
  demandeId: string,
  metierId: string,
): Promise<ResultatClassement> {
  const [demande, metier] = await Promise.all([
    prisma.demande.findUnique({
      where: { id: demandeId },
      select: { id: true, reference: true, metierId: true, metier: { select: { nom: true } } },
    }),
    prisma.metier.findUnique({ where: { id: metierId }, select: { id: true, nom: true } }),
  ]);

  if (demande === null) return { ok: false, message: 'Cette demande n’existe pas.' };
  if (metier === null) return { ok: false, message: 'Ce métier n’existe pas.' };

  // La tâche se referme avec le classement. Sans cela, la demande resterait dans la file
  // après avoir été traitée, et la file deviendrait une liste qu'on n'ouvre plus.
  await prisma.tacheAValider.updateMany({
    where: { type: 'classement-demande', objetId: demandeId, valideeLe: null, refuseeLe: null },
    data: { valideeLe: new Date() },
  });

  await prisma.demande.update({
    where: { id: demandeId },
    // La prestation est effacée : elle appartenait à l'ancien métier, et la garder ferait
    // d'une demande de plomberie une demande de « pose de parquet » en plomberie.
    data: { metierId, prestationId: null, classeeParAdmin: true },
  });

  return {
    ok: true,
    avant: { metier: demande.metier?.nom ?? null },
    apres: { metier: metier.nom, classeeParAdmin: true },
  };
}
