import { prisma } from '@lerenom/db';
import {
  calculeTotaux,
  prepareFactureAcompte,
  prepareFactureSolde,
  prochainNumero,
  type LigneDocument,
  type PourcentAcompte,
  type TauxTva,
} from '@lerenom/core';
import { factureAImprimer } from './document-a-imprimer';

/**
 * Les factures d'un professionnel.
 *
 * Elles ne se saisissent pas : elles sont **préparées à partir du devis signé**, par les
 * fonctions de `@lerenom/core`. Une facture tapée à la main à côté d'un devis finirait par en
 * différer, et c'est le genre d'écart qu'un contrôle relève.
 *
 * Trois règles gouvernent ce fichier.
 *
 * **Une facture émise ne se modifie ni ne se supprime.** La base l'interdit par déclencheur,
 * pas seulement le code : une erreur se corrige par un avoir. C'est une obligation comptable,
 * et le garde-fou doit tenir même si quelqu'un écrit en SQL.
 *
 * **Le numéro est attribué à l'émission**, comme pour les devis : une facture préparée puis
 * abandonnée ne laisse pas de trou dans la série.
 *
 * **Le RIB est figé à l'émission.** Celui qui figure sur une facture est celui qui était actif
 * ce jour-là. Un professionnel qui change de banque ne doit pas voir ses anciennes factures
 * désigner un compte qu'il n'a plus — un client qui paie une facture de l'an dernier paierait
 * sur le mauvais compte.
 */

export interface FactureEnListe {
  readonly id: string;
  readonly numero: string | null;
  readonly type: 'acompte' | 'solde' | 'libre';
  readonly statut: 'prete' | 'emise' | 'payee' | 'annulee_par_avoir';
  readonly clientNom: string | null;
  readonly montantAPayerTTC: number;
  readonly emiseLe: Date | null;
  readonly payeeLe: Date | null;
  readonly echeanceLe: Date | null;
  readonly creeLe: Date;
}

export interface FactureComplete extends FactureEnListe {
  readonly lignes: readonly (LigneDocument & { readonly rang: number })[];
  readonly totalHT: number;
  readonly totalTVA: number;
  readonly totalTTC: number;
  readonly acompteDejaFactureTTC: number;
  readonly devisNumero: string | null;
  /** Le RIB figé à l'émission, ou celui qui le sera. `null` quand aucun n'est actif. */
  readonly rib: {
    readonly titulaire: string;
    readonly iban: string;
    readonly banque: string | null;
  } | null;
  readonly emettable: boolean;
}

function nombre(valeur: unknown): number {
  return Number(valeur ?? 0);
}

export async function listeFactures(entrepriseId: string): Promise<readonly FactureEnListe[]> {
  const factures = await prisma.facture.findMany({
    where: { entrepriseId },
    orderBy: [{ creeLe: 'desc' }],
    select: {
      id: true,
      numero: true,
      type: true,
      statut: true,
      montantAPayerTTC: true,
      emiseLe: true,
      payeeLe: true,
      echeanceLe: true,
      creeLe: true,
      client: { select: { nom: true } },
    },
  });

  return factures.map((facture) => ({
    id: facture.id,
    numero: facture.numero,
    type: facture.type,
    statut: facture.statut,
    clientNom: facture.client?.nom ?? null,
    montantAPayerTTC: nombre(facture.montantAPayerTTC),
    emiseLe: facture.emiseLe,
    payeeLe: facture.payeeLe,
    echeanceLe: facture.echeanceLe,
    creeLe: facture.creeLe,
  }));
}

export async function factureDuPro(
  entrepriseId: string,
  factureId: string,
): Promise<FactureComplete | null> {
  const facture = await prisma.facture.findFirst({
    where: { id: factureId, entrepriseId },
    include: {
      lignes: { orderBy: { rang: 'asc' } },
      client: { select: { nom: true } },
      devis: { select: { numero: true } },
      rib: { select: { titulaire: true, iban: true, banque: true } },
    },
  });
  if (facture === null) return null;

  // Tant que la facture n'est pas émise, on montre le RIB actif du jour : c'est celui qui
  // sera figé. Une fois émise, on montre celui qui l'a été, et lui seul.
  const ribActif =
    facture.rib ??
    (facture.emiseLe === null
      ? await prisma.rib.findFirst({
          where: { entrepriseId, actif: true },
          select: { titulaire: true, iban: true, banque: true },
        })
      : null);

  return {
    id: facture.id,
    numero: facture.numero,
    type: facture.type,
    statut: facture.statut,
    payeeLe: facture.payeeLe,
    echeanceLe: facture.echeanceLe,
    clientNom: facture.client?.nom ?? null,
    montantAPayerTTC: nombre(facture.montantAPayerTTC),
    emiseLe: facture.emiseLe,
    creeLe: facture.creeLe,
    lignes: facture.lignes.map((ligne) => ({
      id: ligne.id,
      rang: ligne.rang,
      type: ligne.type,
      designation: ligne.designation,
      ...(ligne.detail !== null ? { detail: ligne.detail } : {}),
      ...(ligne.unite !== null ? { unite: ligne.unite } : {}),
      ...(ligne.quantite !== null ? { quantite: nombre(ligne.quantite) } : {}),
      ...(ligne.prixUnitaireHT !== null ? { prixUnitaireHT: nombre(ligne.prixUnitaireHT) } : {}),
      ...(ligne.tauxTva !== null ? { tauxTva: nombre(ligne.tauxTva) as TauxTva } : {}),
    })),
    totalHT: nombre(facture.totalHT),
    totalTVA: nombre(facture.totalTVA),
    totalTTC: nombre(facture.totalTTC),
    acompteDejaFactureTTC: nombre(facture.acompteDejaFactureTTC),
    devisNumero: facture.devis?.numero ?? null,
    rib: ribActif,
    emettable: facture.statut === 'prete',
  };
}

export type ResultatSignature =
  | { readonly ok: true; readonly factures: number }
  | { readonly ok: false; readonly message: string };

/**
 * Marque un devis comme signé et prépare ses factures.
 *
 * C'est le professionnel qui déclare la signature : tant qu'aucun lien client n'existe, c'est
 * lui qui sait — le client a signé sur papier, ou dit oui au téléphone. Le jour où la
 * signature en ligne existera, elle appellera ce même chemin.
 *
 * Deux factures naissent quand le devis prévoit un acompte : l'appel de fonds, puis le solde
 * qui le déduit. Sans acompte, une seule.
 */
export async function signeDevisEtPrepareFactures(
  entrepriseId: string,
  devisId: string,
): Promise<ResultatSignature> {
  const devis = await prisma.devis.findFirst({
    where: { id: devisId, entrepriseId },
    include: { lignes: { orderBy: { rang: 'asc' } } },
  });
  if (devis === null) return { ok: false, message: 'Ce devis n’existe pas.' };
  if (devis.statut !== 'envoye') {
    return {
      ok: false,
      message:
        devis.statut === 'brouillon'
          ? 'Envoyez ce devis à votre client avant de le déclarer signé.'
          : 'Ce devis a déjà été signé ou refusé.',
    };
  }

  const lignes: readonly LigneDocument[] = devis.lignes.map((ligne) => ({
    id: ligne.id,
    type: ligne.type,
    designation: ligne.designation,
    ...(ligne.detail !== null ? { detail: ligne.detail } : {}),
    ...(ligne.unite !== null ? { unite: ligne.unite } : {}),
    ...(ligne.quantite !== null ? { quantite: nombre(ligne.quantite) } : {}),
    ...(ligne.prixUnitaireHT !== null ? { prixUnitaireHT: nombre(ligne.prixUnitaireHT) } : {}),
    ...(ligne.tauxTva !== null ? { tauxTva: nombre(ligne.tauxTva) as TauxTva } : {}),
  }));

  const document = {
    lignes,
    remisePourcent: nombre(devis.remisePourcent),
    acomptePourcent: devis.acomptePourcent as PourcentAcompte,
  };

  const acompte = prepareFactureAcompte(document);
  const solde = prepareFactureSolde(document, acompte?.montantAPayerTTC ?? 0);
  const aPreparer = acompte === null ? [solde] : [acompte, solde];

  await prisma.$transaction(async (tx) => {
    await tx.devis.update({
      where: { id: devisId },
      data: { statut: 'signe', signeLe: new Date() },
    });

    for (const preparee of aPreparer) {
      await tx.facture.create({
        data: {
          entrepriseId,
          clientId: devis.clientId,
          devisId,
          type: preparee.type,
          statut: 'prete',
          remisePourcent: preparee.remisePourcent,
          acompteDejaFactureTTC: preparee.acompteDejaFactureTTC,
          totalHT: preparee.totaux.totalHT,
          totalTVA: preparee.totaux.totalTVA,
          totalTTC: preparee.totaux.totalTTC,
          montantAPayerTTC: preparee.montantAPayerTTC,
          lignes: {
            create: preparee.lignes.map((ligne, rang) => ({
              rang,
              type: ligne.type,
              designation: ligne.designation,
              detail: ligne.detail ?? null,
              unite: ligne.unite ?? null,
              quantite: ligne.quantite ?? null,
              prixUnitaireHT: ligne.prixUnitaireHT ?? null,
              tauxTva: ligne.tauxTva ?? null,
            })),
          },
        },
      });
    }
  });

  return { ok: true, factures: aPreparer.length };
}

export type ResultatEmission =
  { readonly ok: true; readonly numero: string } | { readonly ok: false; readonly message: string };

/**
 * Émet une facture : numéro attribué, RIB figé, document immuable.
 *
 * Le RIB est recopié **par référence au moment de l'émission** : celui qui figure sur la
 * facture restera celui-là, même si le professionnel change de banque. Sans RIB actif, la
 * facture s'émet quand même — un client peut payer autrement — et l'écran le dit.
 */
export async function emetFacture(
  entrepriseId: string,
  factureId: string,
): Promise<ResultatEmission> {
  const facture = await prisma.facture.findFirst({
    where: { id: factureId, entrepriseId },
    select: { statut: true },
  });
  if (facture === null) return { ok: false, message: 'Cette facture n’existe pas.' };
  if (facture.statut !== 'prete') {
    return {
      ok: false,
      message:
        'Cette facture est déjà émise. Une facture émise ne se modifie pas : corrigez-la par un avoir.',
    };
  }

  // ── La conformité, avant le numéro ───────────────────────────────────────────────────────
  //
  // `factureConforme` existait et vérifiait les mentions obligatoires — mais **rien ne
  // l'appelait avant l'émission** : elle ne servait qu'à afficher un avertissement sur le
  // document imprimable. Une facture incomplète pouvait donc être émise, recevoir son numéro
  // définitif et devenir immuable.
  //
  // L'ordre des conséquences compte : une fois émise, une facture ne se corrige plus, elle
  // s'annule par un avoir. Laisser passer une facture sans nom de client, c'est obliger le
  // professionnel à émettre un avoir pour une faute que l'écran voyait avant lui.
  //
  // Le contrôle est posé ici, dans la fonction d'émission, et non dans la route : c'est
  // l'émission qui engage, quel que soit le chemin par lequel on l'appelle.
  const aImprimer = await factureAImprimer(entrepriseId, factureId);
  if (aImprimer !== null && !aImprimer.conformite.conforme) {
    return {
      ok: false,
      message: `Cette facture ne peut pas être émise : il manque ${aImprimer.conformite.manquants.join(', ').toLowerCase()}. Une facture émise ne se corrige plus — elle s’annule par un avoir.`,
    };
  }

  const parametres = await prisma.parametresDocuments.findUnique({
    where: { entrepriseId },
    select: { prefixeFacture: true },
  });
  const prefixe = parametres?.prefixeFacture ?? 'FA';
  const annee = new Date().getFullYear();

  const rib = await prisma.rib.findFirst({
    where: { entrepriseId, actif: true },
    select: { id: true },
  });

  try {
    const numero = await prisma.$transaction(async (tx) => {
      const dernier = await tx.facture.findFirst({
        where: { entrepriseId, numero: { startsWith: `${prefixe}-${String(annee)}-` } },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      });
      const attribue = prochainNumero(prefixe, annee, dernier?.numero ?? null);

      const emiseLe = new Date();
      const echeance = new Date(emiseLe);
      // Trente jours : le délai de droit commun entre professionnels et particuliers, à défaut
      // de condition particulière négociée.
      echeance.setDate(echeance.getDate() + 30);

      await tx.facture.update({
        where: { id: factureId },
        data: {
          numero: attribue,
          statut: 'emise',
          emiseLe,
          echeanceLe: echeance,
          ...(rib !== null ? { ribId: rib.id } : {}),
        },
      });
      return attribue;
    });

    return { ok: true, numero };
  } catch (erreur) {
    if (
      typeof erreur === 'object' &&
      erreur !== null &&
      (erreur as { code?: string }).code === 'P2002'
    ) {
      return {
        ok: false,
        message: 'Une autre facture vient de prendre ce numéro. Réessayez dans un instant.',
      };
    }
    throw erreur;
  }
}

/** Les totaux d'une facture, recalculés depuis ses lignes — pour vérifier ce qui est stocké. */
export function totauxDepuisLignes(
  lignes: readonly LigneDocument[],
  remisePourcent: number,
): ReturnType<typeof calculeTotaux> {
  return calculeTotaux({ lignes, remisePourcent });
}

/* ------------------------------------------------------------------------- */
/* L'encaissement                                                            */
/* ------------------------------------------------------------------------- */

/**
 * Marque une facture payée.
 *
 * La colonne `payeeLe` existait, le statut `payee` aussi, et le déclencheur de la base
 * l'anticipait en toutes lettres — « une facture émise se paie ». **Rien ne l'écrivait.** Un
 * professionnel ne pouvait donc pas répondre à la question la plus courante de son métier :
 * qu'est-ce qui me reste impayé ?
 *
 * Trois refus, et une permission.
 *
 * **Une facture non émise ne se paie pas** : elle n'a ni numéro ni date, elle n'a pas été
 * envoyée. Encaisser avant d'émettre, c'est encaisser sans facture.
 *
 * **Une facture annulée par un avoir non plus.** Elle a été corrigée ; ce qui est dû l'est
 * sur une autre pièce.
 *
 * **Une date future est refusée.** Enregistrer un paiement qui n'a pas eu lieu fausse le
 * suivi de trésorerie dans le sens qui rassure, ce qui est le pire des deux.
 *
 * **Et le paiement se défait.** Un clic malheureux ne doit pas obliger à émettre un avoir :
 * le statut revient à `emise`, la date s'efface, et rien d'autre n'a bougé — le déclencheur
 * de la base veille sur les montants, le numéro et le RIB.
 */
export async function marqueFacturePayee(
  entrepriseId: string,
  factureId: string,
  payeeLe: Date,
  maintenant = new Date(),
): Promise<{ ok: boolean; message?: string }> {
  const facture = await prisma.facture.findFirst({
    where: { id: factureId, entrepriseId },
    select: { statut: true, emiseLe: true },
  });
  if (facture === null) return { ok: false, message: 'Cette facture n’existe pas.' };

  if (facture.statut === 'prete') {
    return {
      ok: false,
      message:
        'Cette facture n’est pas encore émise : elle n’a pas de numéro et n’a pas été envoyée.',
    };
  }
  if (facture.statut === 'annulee_par_avoir') {
    return {
      ok: false,
      message:
        'Cette facture a été annulée par un avoir : ce qui reste dû l’est sur une autre pièce.',
    };
  }

  // La comparaison se fait à la journée : un paiement enregistré aujourd'hui à 18 h ne doit
  // pas être refusé parce que l'horloge du serveur est à 17 h.
  const jour = (date: Date) => date.toISOString().slice(0, 10);
  if (jour(payeeLe) > jour(maintenant)) {
    return { ok: false, message: 'Un paiement ne s’enregistre pas à une date future.' };
  }
  if (facture.emiseLe !== null && jour(payeeLe) < jour(facture.emiseLe)) {
    return {
      ok: false,
      message: 'Un paiement ne peut pas précéder l’émission de la facture qu’il règle.',
    };
  }

  // Une facture déjà payée accepte une nouvelle date : c'est une correction, pas une
  // anomalie — on s'est trompé d'un jour en saisissant un virement. Refuser obligerait à
  // défaire puis refaire, pour le même résultat et deux clics de plus.
  await prisma.facture.updateMany({
    where: { id: factureId, entrepriseId },
    data: { statut: 'payee', payeeLe },
  });
  return { ok: true };
}

/** Défait un paiement enregistré par erreur. La facture redevient simplement émise. */
export async function annuleLePaiement(
  entrepriseId: string,
  factureId: string,
): Promise<{ ok: boolean; message?: string }> {
  const facture = await prisma.facture.findFirst({
    where: { id: factureId, entrepriseId },
    select: { statut: true },
  });
  if (facture === null) return { ok: false, message: 'Cette facture n’existe pas.' };
  if (facture.statut !== 'payee') {
    return { ok: false, message: 'Cette facture n’est pas marquée payée.' };
  }

  await prisma.facture.updateMany({
    where: { id: factureId, entrepriseId },
    data: { statut: 'emise', payeeLe: null },
  });
  return { ok: true };
}
