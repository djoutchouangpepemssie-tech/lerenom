import { prisma } from '@lerenom/db';
import { signeDevisEtPrepareFactures } from '@/lib/factures-pro';
import { nomVille } from '@/lib/affichage';
import {
  calculeTotaux,
  type LigneDocument,
  type TauxTva,
  type Totaux,
  type TypeDevis,
} from '@lerenom/core';

/**
 * Ce qu'un client voit d'un devis qu'on lui a adressé.
 *
 * Le périmètre est strict, comme pour le suivi d'une demande : le devis que le jeton
 * désigne, et rien d'autre. Pas la liste des devis du professionnel, pas ses autres clients,
 * pas ses marges.
 *
 * Ce que le client voit en plus du pro : **les coordonnées de l'entreprise**. Un devis est un
 * document contractuel ; celui qui le reçoit doit pouvoir dire qui l'engage, et le vérifier
 * — d'où le SIRET, qui n'est pas un ornement.
 *
 * Les totaux sont **recalculés à la lecture** plutôt que lus en base. Non par défiance envers
 * la colonne, mais parce que c'est la version que le client a sous les yeux qui doit être
 * celle que le code sait justifier ligne à ligne. Un écart entre les deux se verrait ici,
 * plutôt que dans une réclamation.
 */

export interface DevisPourClient {
  readonly id: string;
  readonly numero: string | null;
  readonly statut: 'brouillon' | 'envoye' | 'signe' | 'refuse' | 'expire';
  readonly type: TypeDevis;
  readonly envoyeLe: Date | null;
  readonly signeLe: Date | null;
  readonly expireLe: Date | null;
  readonly lignes: readonly (LigneDocument & { readonly rang: number })[];
  readonly totaux: Totaux;
  readonly remisePourcent: number;
  readonly acomptePourcent: number;
  readonly acompteTTC: number;
  readonly validiteJours: number;
  readonly devisPayant: boolean;
  readonly piecesRemplaceesGardees: boolean;
  readonly mentionRetractation: boolean;
  readonly clientNom: string | null;
  readonly entreprise: {
    readonly nom: string;
    readonly siret: string | null;
    readonly adresse: string | null;
    readonly telephone: string | null;
    readonly email: string | null;
  };
  /** Le client peut-il l'accepter maintenant ? */
  readonly acceptable: boolean;
  /** Pourquoi il ne peut pas, quand il ne peut pas. */
  readonly raisonRefus: string | null;
}

function nombre(valeur: unknown): number {
  return Number(valeur ?? 0);
}

/** L'adresse du siège sur une ligne, telle qu'elle doit figurer sur un document. */
function adresseComplete(
  agence: {
    readonly adresse: string;
    readonly codePostal: string;
    readonly commune: { readonly nom: string };
  } | null,
): string | null {
  if (agence === null) return null;
  // `nomVille` plutôt que le nom brut : la base dit « Paris 11e Arrondissement », ce qui ne
  // s'écrit pas ainsi sur une adresse — et un devis est un document, pas un extrait de table.
  return `${agence.adresse}, ${agence.codePostal} ${nomVille(agence.commune.nom)}`;
}

/** La date au-delà de laquelle le devis ne vaut plus. */
export function echeanceDevis(envoyeLe: Date | null, validiteJours: number): Date | null {
  if (envoyeLe === null) return null;
  const echeance = new Date(envoyeLe);
  echeance.setDate(echeance.getDate() + validiteJours);
  return echeance;
}

export async function devisPourClient(
  devisId: string,
  maintenant: Date = new Date(),
): Promise<DevisPourClient | null> {
  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    include: {
      lignes: { orderBy: { rang: 'asc' } },
      client: { select: { nom: true } },
      entreprise: {
        select: {
          nom: true,
          siret: true,
          // Le téléphone et le courriel vivent sur la fiche, l'adresse sur l'agence
          // principale : c'est là que le professionnel les tient à jour, et un devis doit
          // porter les coordonnées courantes de celui qui l'engage.
          fiche: { select: { telephone: true, email: true } },
          agences: {
            where: { principale: true },
            take: 1,
            select: { adresse: true, codePostal: true, commune: { select: { nom: true } } },
          },
        },
      },
    },
  });
  if (devis === null) return null;

  // Un brouillon n'a pas été remis : même avec un lien valide, il n'y a rien à montrer. Le
  // cas ne devrait pas se produire — le lien naît à l'envoi — mais un devis dupliqué en
  // brouillon pourrait reprendre un identifiant deviné.
  if (devis.statut === 'brouillon') return null;

  const lignes: readonly (LigneDocument & { rang: number })[] = devis.lignes.map((ligne) => ({
    id: ligne.id,
    rang: ligne.rang,
    type: ligne.type,
    designation: ligne.designation,
    ...(ligne.detail !== null ? { detail: ligne.detail } : {}),
    ...(ligne.unite !== null ? { unite: ligne.unite } : {}),
    ...(ligne.quantite !== null ? { quantite: nombre(ligne.quantite) } : {}),
    ...(ligne.prixUnitaireHT !== null ? { prixUnitaireHT: nombre(ligne.prixUnitaireHT) } : {}),
    ...(ligne.tauxTva !== null ? { tauxTva: nombre(ligne.tauxTva) as TauxTva } : {}),
  }));

  const remisePourcent = nombre(devis.remisePourcent);
  const totaux = calculeTotaux({ lignes, remisePourcent });
  const acomptePourcent = devis.acomptePourcent;
  const expireLe = echeanceDevis(devis.envoyeLe, devis.validiteJours);

  const perime = expireLe !== null && expireLe.getTime() <= maintenant.getTime();
  const raisonRefus =
    devis.statut === 'signe'
      ? 'Vous avez déjà accepté ce devis.'
      : devis.statut === 'refuse'
        ? 'Ce devis a été refusé.'
        : devis.statut === 'expire' || perime
          ? 'Ce devis a dépassé sa durée de validité. Demandez-en un nouveau à l’entreprise.'
          : null;

  return {
    id: devis.id,
    numero: devis.numero,
    statut: devis.statut,
    type: devis.type,
    envoyeLe: devis.envoyeLe,
    signeLe: devis.signeLe,
    expireLe,
    lignes,
    totaux,
    remisePourcent,
    acomptePourcent,
    // Arrondi au centime : c'est une somme à verser, pas une proportion à afficher.
    acompteTTC: Math.round(totaux.totalTTC * acomptePourcent) / 100,
    validiteJours: devis.validiteJours,
    devisPayant: devis.devisPayant,
    piecesRemplaceesGardees: devis.piecesRemplaceesGardees,
    mentionRetractation: devis.mentionRetractation,
    clientNom: devis.client?.nom ?? null,
    entreprise: {
      nom: devis.entreprise.nom,
      siret: devis.entreprise.siret,
      adresse: adresseComplete(devis.entreprise.agences[0] ?? null),
      telephone: devis.entreprise.fiche?.telephone ?? null,
      email: devis.entreprise.fiche?.email ?? null,
    },
    acceptable: raisonRefus === null && devis.statut === 'envoye',
    raisonRefus,
  };
}

export type ResultatAcceptation =
  | { readonly ok: true; readonly factures: number }
  | { readonly ok: false; readonly message: string };

/**
 * Le client accepte le devis : il est signé, et ses factures sont préparées.
 *
 * C'est le même chemin que la déclaration de signature par le professionnel — mêmes
 * factures, mêmes calculs. Un second chemin qui préparerait les factures de son côté
 * finirait par en préparer d'autres.
 *
 * La différence est la **validité** : le professionnel qui déclare une signature sait ce
 * qu'il fait, tandis qu'un client peut ouvrir un vieux courriel. Un devis périmé ne
 * s'accepte donc pas en ligne, même si son lien vit encore — les deux durées sont
 * indépendantes, et c'est la plus courte qui doit gagner.
 */
export async function accepteDevisParLeClient(devisId: string): Promise<ResultatAcceptation> {
  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    select: { entrepriseId: true, statut: true, envoyeLe: true, validiteJours: true },
  });
  if (devis === null) return { ok: false, message: 'Ce devis n’existe plus.' };

  const echeance = echeanceDevis(devis.envoyeLe, devis.validiteJours);
  if (echeance !== null && echeance.getTime() <= Date.now()) {
    return {
      ok: false,
      message: 'Ce devis a dépassé sa durée de validité. Demandez-en un nouveau à l’entreprise.',
    };
  }

  const resultat = await signeDevisEtPrepareFactures(devis.entrepriseId, devisId);
  return resultat.ok
    ? { ok: true, factures: resultat.factures }
    : { ok: false, message: resultat.message };
}
