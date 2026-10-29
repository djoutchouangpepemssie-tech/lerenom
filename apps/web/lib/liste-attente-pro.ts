import {
  PARAMETRES_PAR_DEFAUT,
  inscriptionPossible,
  placesDeLaFormule,
  rangsApresDepart,
} from '@lerenom/core';
import type { EtatZone, Formule } from '@lerenom/core';
import { prisma } from '@lerenom/db';

/**
 * La liste d'attente, côté professionnel.
 *
 * Quand une zone est complète — l'Exclusif pris, les six Premium vendus — un professionnel
 * qui veut y entrer n'avait aucun moyen de le dire, et Le Renom aucun moyen de le savoir.
 * C'est pourtant le seul moment où la rareté qu'on vend a une valeur mesurable : quatre
 * plombiers qui attendent une place à Montreuil en disent plus qu'un tableau de recettes.
 *
 * **S'inscrire n'engage rien et ne facture rien.** La place qui se libère n'est pas attribuée
 * d'office : le premier de la liste est prévenu, et il décide. Attribuer automatiquement
 * créerait un abonnement que personne n'a confirmé — pour l'Exclusif, douze mois
 * d'engagement signés par un silence.
 *
 * Les règles d'inscription vivent dans `packages/core` et sont testées sans base. Ce module
 * ne fait que leur donner l'état réel de la zone, puis écrire ce qu'elles décident.
 */

export interface ZoneDuPro {
  readonly metierId: string;
  readonly metier: string;
  readonly communeCode: string;
  readonly commune: string;
  /** La formule que le pro détient ici, s'il en détient une. */
  readonly maPlace: Formule | null;
  readonly exclusifPris: boolean;
  readonly premiumVendus: number;
  readonly premiumMax: number;
  /** Mon rang sur la liste Premium, ou `null` si je n'y suis pas. */
  readonly monRangPremium: number | null;
  readonly monRangExclusif: number | null;
  readonly enAttentePremium: number;
  readonly enAttenteExclusif: number;
}

const P = PARAMETRES_PAR_DEFAUT;

/**
 * Les zones du périmètre du professionnel, avec l'état commercial de chacune.
 *
 * Le périmètre est le produit de ses métiers par ses communes : c'est exactement l'ensemble
 * des pages où il peut acheter une place, et aucune autre. Lui proposer une zone hors de son
 * périmètre reviendrait à lui vendre une visibilité là où il n'intervient pas.
 */
export async function zonesDuPro(entrepriseId: string): Promise<readonly ZoneDuPro[]> {
  const entreprise = await prisma.entreprise.findUnique({
    where: { id: entrepriseId },
    select: {
      metiers: { select: { metier: { select: { id: true, nom: true, masque: true } } } },
      zones: { select: { commune: { select: { code: true, nom: true } } } },
    },
  });
  if (entreprise === null) return [];

  const metiers = entreprise.metiers.map((m) => m.metier).filter((m) => !m.masque);
  const communes = entreprise.zones.map((z) => z.commune);
  if (metiers.length === 0 || communes.length === 0) return [];

  const metierIds = metiers.map((m) => m.id);
  const communeIds = communes.map((c) => c.code);

  const [emplacements, attentes] = await Promise.all([
    prisma.emplacement.findMany({
      where: {
        metierId: { in: metierIds },
        communeId: { in: communeIds },
        OR: [{ finitLe: null }, { finitLe: { gt: new Date() } }],
      },
      select: { metierId: true, communeId: true, formule: true, entrepriseId: true },
    }),
    prisma.listeAttente.findMany({
      where: { metierId: { in: metierIds }, communeId: { in: communeIds }, servieLe: null },
      orderBy: { rang: 'asc' },
      select: { metierId: true, communeId: true, formule: true, entrepriseId: true, rang: true },
    }),
  ]);

  const zones: ZoneDuPro[] = [];
  for (const metier of metiers) {
    for (const commune of communes) {
      const ici = (x: { metierId: string; communeId: string }) =>
        x.metierId === metier.id && x.communeId === commune.code;
      const places = emplacements.filter(ici);
      const exclusif = places.find((p) => p.formule === 'exclusif');
      const premium = places.filter((p) => p.formule === 'premium');
      const attentePremium = attentes.filter((a) => ici(a) && a.formule === 'premium');
      const attenteExclusif = attentes.filter((a) => ici(a) && a.formule === 'exclusif');
      const mienne = places.find((p) => p.entrepriseId === entrepriseId);

      zones.push({
        metierId: metier.id,
        metier: metier.nom,
        communeCode: commune.code,
        commune: commune.nom,
        maPlace: mienne?.formule ?? null,
        exclusifPris: exclusif !== undefined,
        premiumVendus: premium.length,
        premiumMax: placesDeLaFormule('premium', P),
        monRangPremium: attentePremium.find((a) => a.entrepriseId === entrepriseId)?.rang ?? null,
        monRangExclusif: attenteExclusif.find((a) => a.entrepriseId === entrepriseId)?.rang ?? null,
        enAttentePremium: attentePremium.length,
        enAttenteExclusif: attenteExclusif.length,
      });
    }
  }

  // Les zones complètes d'abord : ce sont les seules sur lesquelles il y a quelque chose à
  // faire. Une zone où tout est libre n'appelle pas de décision, elle appelle un achat.
  return zones.sort((a, b) => {
    const pleine = (z: ZoneDuPro) => (z.exclusifPris && z.premiumVendus >= z.premiumMax ? 0 : 1);
    return pleine(a) - pleine(b) || a.metier.localeCompare(b.metier);
  });
}

export interface ResultatAttente {
  readonly ok: boolean;
  readonly message?: string;
  readonly rang?: number;
}

/** L'état d'une zone, tel que les règles de `packages/core` l'attendent. */
async function etatDeLaZone(
  metierId: string,
  communeId: string,
  formule: Formule,
): Promise<EtatZone> {
  const [emplacements, attentes] = await Promise.all([
    prisma.emplacement.findMany({
      where: {
        metierId,
        communeId,
        OR: [{ finitLe: null }, { finitLe: { gt: new Date() } }],
      },
      select: { formule: true, entrepriseId: true },
    }),
    prisma.listeAttente.findMany({
      where: { metierId, communeId, formule, servieLe: null },
      orderBy: { rang: 'asc' },
      select: { entrepriseId: true },
    }),
  ]);

  return {
    exclusif: emplacements.find((e) => e.formule === 'exclusif')?.entrepriseId ?? null,
    premium: emplacements.filter((e) => e.formule === 'premium').map((e) => e.entrepriseId),
    enAttente: attentes.map((a) => a.entrepriseId),
  };
}

export async function rejoindLaListe(
  entrepriseId: string,
  metierId: string,
  communeId: string,
  formule: Formule,
): Promise<ResultatAttente> {
  // Le périmètre est vérifié ici, et pas seulement proposé par l'écran : une requête forgée
  // inscrirait sinon une entreprise sur une zone où elle n'intervient pas, et la liste
  // cesserait de mesurer ce qu'elle prétend mesurer.
  const dansLePerimetre = await prisma.entreprise.count({
    where: {
      id: entrepriseId,
      metiers: { some: { metierId } },
      zones: { some: { communeId } },
    },
  });
  if (dansLePerimetre === 0) {
    return {
      ok: false,
      message:
        'Cette zone n’est pas dans votre périmètre : ajoutez-y le métier et la ville d’abord.',
    };
  }

  const zone = await etatDeLaZone(metierId, communeId, formule);
  const reponse = inscriptionPossible(zone, { entrepriseId, formule }, P);
  if (!reponse.accepte) return { ok: false, message: reponse.explication };

  // `upsert` et non `create` : une inscription passée puis servie laisse sa ligne, et la
  // contrainte d'unicité ferait échouer une seconde inscription légitime des mois plus tard.
  await prisma.listeAttente.upsert({
    where: {
      entrepriseId_metierId_communeId_formule: { entrepriseId, metierId, communeId, formule },
    },
    update: { rang: reponse.rang, servieLe: null, creeLe: new Date() },
    create: { entrepriseId, metierId, communeId, formule, rang: reponse.rang },
  });

  return { ok: true, rang: reponse.rang };
}

/**
 * Quitte la liste, et resserre les rangs derrière.
 *
 * Sans le resserrement, une liste de six finit par afficher les rangs 1, 4, 5 et 9 : exacts
 * dans l'ordre, absurdes à lire, et impossibles à annoncer à qui demande sa position.
 */
export async function quitteLaListe(
  entrepriseId: string,
  metierId: string,
  communeId: string,
  formule: Formule,
): Promise<ResultatAttente> {
  const attentes = await prisma.listeAttente.findMany({
    where: { metierId, communeId, formule, servieLe: null },
    orderBy: { rang: 'asc' },
    select: { id: true, entrepriseId: true },
  });
  if (!attentes.some((a) => a.entrepriseId === entrepriseId)) {
    return { ok: false, message: 'Vous n’êtes pas sur cette liste.' };
  }

  const nouveaux = rangsApresDepart(
    attentes.map((a) => a.entrepriseId),
    entrepriseId,
  );
  const parEntreprise = new Map(attentes.map((a) => [a.entrepriseId, a.id]));

  // Une transaction : la suppression et le resserrement doivent tenir ensemble, sinon la
  // liste garde un trou ou deux entreprises au même rang.
  await prisma.$transaction([
    prisma.listeAttente.deleteMany({
      where: { entrepriseId, metierId, communeId, formule, servieLe: null },
    }),
    ...nouveaux.map((ligne) =>
      prisma.listeAttente.update({
        where: { id: parEntreprise.get(ligne.entrepriseId) ?? '' },
        data: { rang: ligne.rang },
      }),
    ),
  ]);

  return { ok: true };
}
