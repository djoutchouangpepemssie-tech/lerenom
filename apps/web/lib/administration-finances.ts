import { PARAMETRES_PAR_DEFAUT, REGLES_VALIDEES, prixAnnuelHT } from '@lerenom/core';
import type { Formule } from '@lerenom/core';
import { prisma } from '@lerenom/db';

/**
 * Les finances, vues du back-office.
 *
 * **Ce que cet écran montre est un prévisionnel, pas une recette.** `FactureLeRenom` est
 * vide : Le Renom ne facture personne, pas même en brouillon, parce que rien n'encaisse. Ce
 * qui existe en revanche, et que personne ne regardait, ce sont les deux sources qui
 * *feraient* la facture du mois :
 *
 * - les **abonnements en cours**, dont le prix est une règle validée ;
 * - la **dépense hors forfait** réellement accumulée dans `QuotaMensuel.depenseHT`, écrite
 *   par la distribution chaque fois qu'un professionnel accepte une demande au-delà de son
 *   forfait.
 *
 * La seconde est de la vraie donnée d'exploitation, déjà là, jamais lue. La somme des deux
 * est ce qui serait facturé si l'on facturait aujourd'hui — et c'est le chiffre qui manquait
 * pour savoir si la plateforme tient debout.
 *
 * L'écran le dit en toutes lettres plutôt que d'afficher « chiffre d'affaires » : un
 * prévisionnel présenté comme une recette est un mensonge comptable, et celui qui le lit
 * prendra des décisions dessus.
 */

export interface LigneFacturable {
  readonly entrepriseId: string;
  readonly entreprise: string;
  readonly formule: Formule;
  readonly periodicite: string;
  readonly statut: string;
  /** Part récurrente du mois : l'abonnement, l'annuel ramené au mois. */
  readonly abonnementHT: number;
  /** Demandes acceptées au-delà du forfait, déjà consommées ce mois-ci. */
  readonly horsForfaitHT: number;
  readonly demandesAcceptees: number;
  readonly demandesIncluses: number;
  readonly totalHT: number;
}

export interface EtatFinances {
  readonly mois: string;
  readonly lignes: readonly LigneFacturable[];
  readonly totaux: {
    readonly abonnementsHT: number;
    readonly horsForfaitHT: number;
    readonly totalHT: number;
    readonly tva: number;
    readonly totalTTC: number;
  };
  readonly indicateurs: {
    readonly abonnesPayants: number;
    /** Abonnements qui ne sont pas « actif » : impayés, suspendus. */
    readonly enDifficulte: number;
    /** Factures réellement émises par Le Renom. Zéro, et l'écran l'explique. */
    readonly facturesEmises: number;
  };
}

/** Le mois civil courant, au format que porte `QuotaMensuel`. */
export function moisCourant(maintenant = new Date()): string {
  return maintenant.toISOString().slice(0, 7);
}

/**
 * Le prix mensuel d'un abonnement.
 *
 * L'annuel se paie dix mois pour douze : ramené au mois, il rapporte moins. Compter douze
 * mois pleins gonflerait le prévisionnel de 20 % sur chaque abonné annuel — une erreur qui
 * ne se verrait qu'au moment de rapprocher les encaissements.
 */
export function prixMensuelHT(formule: Formule, periodicite: string): number {
  return periodicite === 'annuel'
    ? prixAnnuelHT(formule) / 12
    : REGLES_VALIDEES.prixMensuelHT[formule];
}

export async function etatFinances(maintenant = new Date()): Promise<EtatFinances> {
  const mois = moisCourant(maintenant);

  const [abonnements, quotas, facturesEmises] = await Promise.all([
    prisma.abonnement.findMany({
      where: { statut: { in: ['actif', 'impaye', 'suspendu'] } },
      select: {
        entrepriseId: true,
        formule: true,
        periodicite: true,
        statut: true,
        entreprise: { select: { nom: true } },
      },
    }),
    prisma.quotaMensuel.findMany({
      where: { mois },
      select: {
        entrepriseId: true,
        depenseHT: true,
        demandesAcceptees: true,
        demandesIncluses: true,
      },
    }),
    prisma.factureLeRenom.count(),
  ]);

  const parEntreprise = new Map(quotas.map((q) => [q.entrepriseId, q]));

  const lignes = abonnements
    .map((abonnement): LigneFacturable => {
      const quota = parEntreprise.get(abonnement.entrepriseId);
      const abonnementHT = prixMensuelHT(abonnement.formule, abonnement.periodicite);
      // `Decimal` de Prisma : converti explicitement, parce qu'une addition de `Decimal` et
      // de `number` en JavaScript donne une chaîne, silencieusement.
      const horsForfaitHT = quota === undefined ? 0 : Number(quota.depenseHT);
      return {
        entrepriseId: abonnement.entrepriseId,
        entreprise: abonnement.entreprise.nom,
        formule: abonnement.formule,
        periodicite: abonnement.periodicite,
        statut: abonnement.statut,
        abonnementHT,
        horsForfaitHT,
        demandesAcceptees: quota?.demandesAcceptees ?? 0,
        demandesIncluses: quota?.demandesIncluses ?? 0,
        totalHT: abonnementHT + horsForfaitHT,
      };
    })
    .sort((a, b) => b.totalHT - a.totalHT || a.entreprise.localeCompare(b.entreprise));

  const abonnementsHT = lignes.reduce((somme, l) => somme + l.abonnementHT, 0);
  const horsForfaitHT = lignes.reduce((somme, l) => somme + l.horsForfaitHT, 0);
  const totalHT = abonnementsHT + horsForfaitHT;
  const taux = PARAMETRES_PAR_DEFAUT.tauxTvaLeRenom;

  return {
    mois,
    lignes,
    totaux: {
      abonnementsHT,
      horsForfaitHT,
      totalHT,
      tva: totalHT * taux,
      totalTTC: totalHT * (1 + taux),
    },
    indicateurs: {
      abonnesPayants: lignes.filter((l) => l.formule !== 'gratuit').length,
      enDifficulte: lignes.filter((l) => l.statut !== 'actif').length,
      facturesEmises,
    },
  };
}
