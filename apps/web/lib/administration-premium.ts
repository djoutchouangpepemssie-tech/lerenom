import { PARAMETRES_PAR_DEFAUT, REGLES_VALIDEES, formatEuros, prixAnnuelHT } from '@lerenom/core';
import type { Formule } from '@lerenom/core';
import { prisma } from '@lerenom/db';

/**
 * Premium et Exclusif, vus du back-office.
 *
 * Ce que Le Renom vend n'est pas un abonnement : c'est **une place, sur un métier, dans une
 * ville**. La rareté est le produit ; sans elle, l'abonnement ne vaut rien.
 *
 * Deux chiffres à ne pas confondre, et l'écran les sépare :
 *
 * - **ce qui se vend** — un Exclusif et six Premium par métier × commune ;
 * - **ce qui s'affiche** — trois places en haut de page, dont une Exclusif et deux Premium.
 *
 * Les six Premium tournent donc sur deux places : chacun est affiché deux fois sur six, soit
 * un tiers des affichages, et c'est exactement ce qui lui est annoncé. Vendre la septième
 * place ne diluerait pas un peu la valeur des six autres : elle la réduirait d'un septième
 * pour chacun, sans que personne l'ait accepté.
 *
 * Un défaut s'est révélé en ouvrant ce chantier : la page de résultats classait d'après
 * l'**abonnement** et non d'après l'emplacement détenu sur cette page. Un Premium occupait
 * donc une place sponsorisée dans toutes les villes et tous les métiers où il était référencé
 * — on distribuait gratuitement ce qu'on vend à l'unité, et le plafond par métier × ville ne
 * tenait plus. Corrigé dans `donnees.ts` avant d'écrire cet écran : piloter un stock qui ne
 * commande rien n'aurait eu aucun sens.
 *
 * ## Ce que cet écran ne fait pas
 *
 * **Il n'attribue pas d'emplacement.** Vendre une place engage une facture, un prélèvement et
 * un engagement de douze mois pour l'Exclusif. Tant que l'encaissement n'est pas branché,
 * attribuer ici donnerait une place sans contrepartie et un abonné qui se croit facturé. Ce
 * que l'écran fait — et qui manquait entièrement — c'est **montrer l'état du stock** : ce qui
 * est pris, ce qui est libre, ce que cela rapporte, et où la demande existe sans que l'offre
 * soit servie.
 */

export interface ZoneCommerciale {
  readonly metierId: string;
  readonly metier: string;
  readonly communeCode: string;
  readonly commune: string;
  readonly exclusif: string | null;
  /** Les détenteurs d'emplacements Premium, du plus ancien au plus récent. */
  readonly premium: readonly string[];
  /** Combien de Premium peuvent encore être vendus ici, avant le plafond. */
  readonly placesPremiumRestantes: number;
  /** Part des affichages qu'obtient chaque Premium de cette zone, vu la rotation. */
  readonly partAffichagePremium: number;
  /** Entreprises référencées sur ce métier × cette commune, abonnées ou non. */
  readonly concurrents: number;
  /** Combien attendent une place ici. Sur une zone complète, c'est la demande non servie. */
  readonly enAttente: number;
  /** Recette mensuelle HT que cette zone produit aujourd'hui. */
  readonly recetteMensuelleHT: number;
  /** Recette mensuelle HT si tous les emplacements étaient vendus. */
  readonly potentielMensuelHT: number;
}

export interface AbonnementAdministration {
  readonly id: string;
  readonly entreprise: string;
  readonly entrepriseId: string;
  readonly formule: Formule;
  readonly periodicite: string;
  readonly statut: string;
  readonly debuteLe: Date;
  readonly engageJusquA: Date | null;
  readonly emplacements: number;
  readonly prixMensuelHT: number;
  /** L'entreprise est-elle encore au-dessus de la note minimale exigée d'un emplacement payé ? */
  readonly souslaNoteMinimale: boolean;
}

export interface EtatPremium {
  readonly zones: readonly ZoneCommerciale[];
  /** Combien de Premium s'affichent simultanément. Descend du paramètre, jamais recopié. */
  readonly placesAffichees: number;
  readonly abonnements: readonly AbonnementAdministration[];
  readonly indicateurs: {
    readonly recetteMensuelleHT: number;
    readonly potentielMensuelHT: number;
    readonly exclusifsVendus: number;
    readonly premiumVendus: number;
    /** Abonnés payants dont la note est tombée sous le minimum : leur place est en sursis. */
    readonly enSursis: number;
    /** Demande non servie, toutes zones confondues : des clients qui veulent payer. */
    readonly enAttente: number;
  };
}

/** Combien de Premium on peut vendre sur une zone. */
const PLACES_PREMIUM = PARAMETRES_PAR_DEFAUT.premiumMaxParMetierVille;
/** Combien s'affichent en même temps. Les vendus au-delà tournent sur ces places. */
const PLACES_AFFICHEES_PREMIUM = PARAMETRES_PAR_DEFAUT.emplacementsPremium;

export function prixMensuel(formule: Formule, periodicite: string): number {
  // L'annuel se paie dix mois pour douze : ramené au mois, il rapporte moins, et la recette
  // affichée doit le dire. Compter douze mois pleins gonflerait le chiffre de 20 %.
  const annuel = prixAnnuelHT(formule);
  return periodicite === 'annuel' ? annuel / 12 : REGLES_VALIDEES.prixMensuelHT[formule];
}

export async function etatPremium(): Promise<EtatPremium> {
  const [emplacements, abonnements, attentes] = await Promise.all([
    prisma.emplacement.findMany({
      where: { OR: [{ finitLe: null }, { finitLe: { gt: new Date() } }] },
      orderBy: { debuteLe: 'asc' },
      select: {
        formule: true,
        metierId: true,
        communeId: true,
        entreprise: { select: { nom: true } },
        metier: { select: { nom: true } },
        commune: { select: { nom: true } },
      },
    }),
    prisma.abonnement.findMany({
      where: { statut: { in: ['actif', 'impaye', 'suspendu'] } },
      orderBy: [{ formule: 'desc' }, { debuteLe: 'asc' }],
      select: {
        id: true,
        formule: true,
        periodicite: true,
        statut: true,
        debuteLe: true,
        engageJusquA: true,
        entrepriseId: true,
        entreprise: {
          select: { nom: true, noteMoyenne: true, _count: { select: { emplacements: true } } },
        },
      },
    }),
    prisma.listeAttente.findMany({
      where: { servieLe: null },
      select: { metierId: true, communeId: true },
    }),
  ]);

  const attenteParZone = new Map<string, number>();
  for (const attente of attentes) {
    const cle = `${attente.metierId}|${attente.communeId}`;
    attenteParZone.set(cle, (attenteParZone.get(cle) ?? 0) + 1);
  }

  // Les zones sont construites à partir des emplacements vendus, pas du catalogue entier :
  // dix-huit univers par mille deux cents communes feraient des dizaines de milliers de lignes
  // vides, et la seule information utile — où la rareté est atteinte — s'y noierait.
  const parZone = new Map<string, ZoneCommerciale & { premiumMutable: string[] }>();
  for (const emplacement of emplacements) {
    const cle = `${emplacement.metierId}|${emplacement.communeId}`;
    let zone = parZone.get(cle);
    if (zone === undefined) {
      zone = {
        metierId: emplacement.metierId,
        metier: emplacement.metier.nom,
        communeCode: emplacement.communeId,
        commune: emplacement.commune.nom,
        exclusif: null,
        premium: [],
        premiumMutable: [],
        placesPremiumRestantes: PLACES_PREMIUM,
        partAffichagePremium: 0,
        enAttente: 0,
        concurrents: 0,
        recetteMensuelleHT: 0,
        potentielMensuelHT: 0,
      };
      parZone.set(cle, zone);
    }
    if (emplacement.formule === 'exclusif') {
      zone = { ...zone, exclusif: emplacement.entreprise.nom };
      parZone.set(cle, zone);
    } else if (emplacement.formule === 'premium') {
      zone.premiumMutable.push(emplacement.entreprise.nom);
    }
  }

  const zones = await Promise.all(
    [...parZone.values()].map(async (zone): Promise<ZoneCommerciale> => {
      const concurrents = await prisma.entreprise.count({
        where: {
          suspendue: false,
          retireeLe: null,
          verifiee: true,
          metiers: { some: { metierId: zone.metierId } },
          zones: { some: { communeId: zone.communeCode } },
        },
      });
      const premium = zone.premiumMutable;
      const recette =
        (zone.exclusif === null ? 0 : REGLES_VALIDEES.prixMensuelHT.exclusif) +
        premium.length * REGLES_VALIDEES.prixMensuelHT.premium;
      return {
        metierId: zone.metierId,
        metier: zone.metier,
        communeCode: zone.communeCode,
        commune: zone.commune,
        exclusif: zone.exclusif,
        premium,
        placesPremiumRestantes: Math.max(0, PLACES_PREMIUM - premium.length),
        partAffichagePremium:
          premium.length === 0 ? 0 : Math.min(1, PLACES_AFFICHEES_PREMIUM / premium.length),
        concurrents,
        enAttente: attenteParZone.get(`${zone.metierId}|${zone.communeCode}`) ?? 0,
        recetteMensuelleHT: recette,
        potentielMensuelHT:
          REGLES_VALIDEES.prixMensuelHT.exclusif +
          PLACES_PREMIUM * REGLES_VALIDEES.prixMensuelHT.premium,
      };
    }),
  );

  zones.sort(
    (a, b) => b.recetteMensuelleHT - a.recetteMensuelleHT || a.metier.localeCompare(b.metier),
  );

  const lignes = abonnements.map((abonnement): AbonnementAdministration => {
    const note = abonnement.entreprise.noteMoyenne;
    return {
      id: abonnement.id,
      entreprise: abonnement.entreprise.nom,
      entrepriseId: abonnement.entrepriseId,
      formule: abonnement.formule,
      periodicite: abonnement.periodicite,
      statut: abonnement.statut,
      debuteLe: abonnement.debuteLe,
      engageJusquA: abonnement.engageJusquA,
      emplacements: abonnement.entreprise._count.emplacements,
      prixMensuelHT: prixMensuel(abonnement.formule, abonnement.periodicite),
      // Une entreprise sans avis n'est pas pénalisée : elle n'a pas d'historique, ce n'est pas
      // la même chose qu'un mauvais historique.
      souslaNoteMinimale: note !== null && note < PARAMETRES_PAR_DEFAUT.noteMinimale,
    };
  });

  const payants = lignes.filter((l) => l.formule === 'premium' || l.formule === 'exclusif');

  return {
    zones,
    placesAffichees: PLACES_AFFICHEES_PREMIUM,
    abonnements: lignes,
    indicateurs: {
      recetteMensuelleHT: lignes.reduce((somme, l) => somme + l.prixMensuelHT, 0),
      potentielMensuelHT: zones.reduce((somme, z) => somme + z.potentielMensuelHT, 0),
      exclusifsVendus: zones.filter((z) => z.exclusif !== null).length,
      premiumVendus: zones.reduce((somme, z) => somme + z.premium.length, 0),
      enSursis: payants.filter((l) => l.souslaNoteMinimale).length,
      enAttente: attentes.length,
    },
  };
}

export { formatEuros };
