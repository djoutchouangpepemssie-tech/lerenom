import { prisma } from '@lerenom/db';
import { prepareAvoir, prochainNumero, resteACrediter, type ProblemeAvoir } from '@lerenom/core';

/**
 * Les avoirs d'un professionnel.
 *
 * Un avoir corrige une facture émise — la seule façon de le faire, puisqu'une facture émise
 * n'est ni modifiable ni supprimable. Les règles vivent dans `@lerenom/core` ; ce fichier les
 * branche sur la base, et il n'a qu'un travail délicat : **tout faire dans une transaction**.
 *
 * Pourquoi cela compte ici plus qu'ailleurs. Émettre un avoir, c'est trois écritures liées :
 * lire ce qui reste créditable, prendre le numéro suivant de la série, écrire l'avoir et
 * éventuellement annuler la facture. Deux avoirs émis en même temps sur la même facture
 * pourraient, hors transaction, lire le même « reste » et le dépasser à eux deux, ou prendre
 * le même numéro. Le premier défaut se verrait à la liasse fiscale ; le second à la première
 * requête refusée par la contrainte d'unicité.
 *
 * La contrainte `@@unique([entrepriseId, numero])` est le dernier filet : si deux
 * transactions parviennent malgré tout au même numéro, la base en refuse une, et l'écran le
 * dit au lieu de prétendre que tout s'est bien passé.
 */

export interface AvoirEnListe {
  readonly id: string;
  readonly numero: string;
  readonly motif: string;
  readonly montantTTC: number;
  readonly emisLe: Date;
  readonly factureId: string;
  readonly factureNumero: string | null;
  readonly clientNom: string | null;
}

function nombre(valeur: unknown): number {
  return Number(valeur ?? 0);
}

export async function listeAvoirs(entrepriseId: string): Promise<readonly AvoirEnListe[]> {
  const avoirs = await prisma.avoir.findMany({
    where: { entrepriseId },
    orderBy: [{ emisLe: 'desc' }],
    select: {
      id: true,
      numero: true,
      motif: true,
      montantTTC: true,
      emisLe: true,
      factureId: true,
      facture: { select: { numero: true, client: { select: { nom: true } } } },
    },
  });

  return avoirs.map((avoir) => ({
    id: avoir.id,
    numero: avoir.numero,
    motif: avoir.motif,
    montantTTC: nombre(avoir.montantTTC),
    emisLe: avoir.emisLe,
    factureId: avoir.factureId,
    factureNumero: avoir.facture.numero,
    clientNom: avoir.facture.client?.nom ?? null,
  }));
}

/** Les avoirs déjà portés sur une facture, et ce qu'il reste créditable. */
export interface EtatCreditFacture {
  readonly montantAPayerTTC: number;
  readonly dejaCrediteTTC: number;
  readonly resteACrediterTTC: number;
  readonly avoirs: readonly {
    readonly id: string;
    readonly numero: string;
    readonly motif: string;
    readonly montantTTC: number;
    readonly emisLe: Date;
  }[];
}

export async function etatCreditFacture(
  entrepriseId: string,
  factureId: string,
): Promise<EtatCreditFacture | null> {
  const facture = await prisma.facture.findFirst({
    where: { id: factureId, entrepriseId },
    select: {
      statut: true,
      montantAPayerTTC: true,
      avoirs: {
        orderBy: { emisLe: 'asc' },
        select: { id: true, numero: true, motif: true, montantTTC: true, emisLe: true },
      },
    },
  });
  if (facture === null) return null;

  const avoirs = facture.avoirs.map((avoir) => ({
    id: avoir.id,
    numero: avoir.numero,
    motif: avoir.motif,
    montantTTC: nombre(avoir.montantTTC),
    emisLe: avoir.emisLe,
  }));
  const dejaCrediteTTC = avoirs.reduce((total, avoir) => total + avoir.montantTTC, 0);
  const montantAPayerTTC = nombre(facture.montantAPayerTTC);

  return {
    montantAPayerTTC,
    dejaCrediteTTC,
    resteACrediterTTC: resteACrediter({
      statut: facture.statut,
      montantAPayerTTC,
      dejaCrediteTTC,
    }),
    avoirs,
  };
}

export type ResultatAvoir =
  | { readonly ok: true; readonly numero: string; readonly factureAnnulee: boolean }
  | { readonly ok: false; readonly problemes: readonly ProblemeAvoir[] };

/**
 * Émet un avoir sur une facture.
 *
 * Tout est lu **et** écrit dans la même transaction : le reste à créditer calculé hors
 * transaction serait déjà périmé au moment de l'écriture.
 */
export async function emetAvoir(
  entrepriseId: string,
  factureId: string,
  saisie: { readonly montantTTC: number; readonly motif: string },
): Promise<ResultatAvoir> {
  const parametres = await prisma.parametresDocuments.findUnique({
    where: { entrepriseId },
    select: { prefixeAvoir: true },
  });
  const prefixe = parametres?.prefixeAvoir ?? 'AV';
  const annee = new Date().getFullYear();

  try {
    return await prisma.$transaction(async (tx) => {
      const facture = await tx.facture.findFirst({
        where: { id: factureId, entrepriseId },
        select: {
          statut: true,
          montantAPayerTTC: true,
          avoirs: { select: { montantTTC: true } },
        },
      });
      if (facture === null) {
        return {
          ok: false as const,
          problemes: [{ champ: 'facture' as const, message: 'Cette facture n’existe pas.' }],
        };
      }

      const dejaCrediteTTC = facture.avoirs.reduce(
        (total, avoir) => total + nombre(avoir.montantTTC),
        0,
      );
      const prepare = prepareAvoir(saisie, {
        statut: facture.statut,
        montantAPayerTTC: nombre(facture.montantAPayerTTC),
        dejaCrediteTTC,
      });
      if (!prepare.ok) return { ok: false as const, problemes: prepare.problemes };

      const dernier = await tx.avoir.findFirst({
        where: { entrepriseId, numero: { startsWith: `${prefixe}-${String(annee)}-` } },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      });
      const numero = prochainNumero(prefixe, annee, dernier?.numero ?? null);

      await tx.avoir.create({
        data: {
          entrepriseId,
          factureId,
          numero,
          motif: prepare.avoir.motif,
          montantTTC: prepare.avoir.montantTTC,
        },
      });

      if (prepare.avoir.annuleLaFacture) {
        // Annulée, pas supprimée : elle reste au livre, avec son avoir en face. Le
        // déclencheur de la base n'autorise que ce changement-là sur une facture émise.
        await tx.facture.update({
          where: { id: factureId },
          data: { statut: 'annulee_par_avoir' },
        });
      }

      return {
        ok: true as const,
        numero,
        factureAnnulee: prepare.avoir.annuleLaFacture,
      };
    });
  } catch (erreur) {
    if (
      typeof erreur === 'object' &&
      erreur !== null &&
      (erreur as { code?: string }).code === 'P2002'
    ) {
      return {
        ok: false,
        problemes: [
          {
            champ: 'facture',
            message: 'Un autre avoir vient de prendre ce numéro. Réessayez dans un instant.',
          },
        ],
      };
    }
    throw erreur;
  }
}
