import { prisma } from '@lerenom/db';
import { creeLien } from '@lerenom/liens';
import {
  TAUX_TVA,
  UNITES,
  calculeTotaux,
  devisConforme,
  formatEuros,
  prochainNumero,
  type ConformiteDevis,
  type LigneDocument,
  type PourcentAcompte,
  type TauxTva,
  type Totaux,
  type TypeDevis,
  type TypeLigne,
  type Unite,
  type ValiditeJours,
} from '@lerenom/core';

/**
 * Les devis d'un professionnel.
 *
 * Deux règles gouvernent ce fichier, et elles tiennent à ce qu'un devis est : un engagement
 * remis à quelqu'un.
 *
 * **Un devis envoyé ne se modifie plus.** Le client en a reçu un exemplaire ; le changer sous
 * ses yeux, sans qu'il le sache, n'est pas une correction mais une substitution. Pour changer
 * un prix après l'envoi, on duplique : le nouveau porte un numéro neuf et la version suivante,
 * et l'ancien reste tel qu'il a été remis.
 *
 * **Le numéro n'est attribué qu'à l'envoi.** Un brouillon abandonné ne doit pas consommer un
 * numéro : un trou dans une série de numéros est un défaut comptable, et c'est exactement ce
 * que produirait une numérotation à la création.
 */

/** Ce qu'une liste de devis montre, sans charger les lignes. */
export interface DevisEnListe {
  readonly id: string;
  readonly numero: string | null;
  readonly statut: 'brouillon' | 'envoye' | 'signe' | 'refuse' | 'expire';
  readonly clientNom: string | null;
  readonly totalTTC: number;
  readonly creeLe: Date;
  readonly envoyeLe: Date | null;
  readonly version: number;
}

export interface LigneDevis extends LigneDocument {
  readonly rang: number;
}

/** Un devis complet, avec ses totaux et son état de conformité. */
export interface DevisComplet {
  readonly id: string;
  readonly numero: string | null;
  readonly statut: DevisEnListe['statut'];
  readonly type: TypeDevis;
  readonly version: number;
  readonly envoyeLe: Date | null;
  readonly clientId: string | null;
  readonly lignes: readonly LigneDevis[];
  readonly remisePourcent: number;
  readonly acomptePourcent: PourcentAcompte;
  readonly validiteJours: ValiditeJours;
  readonly fraisDeplacementTTC: number | null;
  readonly devisPayant: boolean;
  readonly piecesRemplaceesGardees: boolean;
  readonly mentionRetractation: boolean;
  readonly totaux: Totaux;
  readonly conformite: ConformiteDevis;
  /** Faux dès l'envoi : un devis remis au client ne se réécrit pas. */
  readonly modifiable: boolean;
  readonly clients: readonly { readonly id: string; readonly nom: string }[];
}

function nombre(valeur: unknown): number {
  return typeof valeur === 'object' && valeur !== null ? Number(valeur) : Number(valeur ?? 0);
}

/** Les validités proposées, telles que `@lerenom/core` les connaît. */
export const VALIDITES: readonly ValiditeJours[] = [15, 30, 60];
/** Les acomptes proposés. */
export const ACOMPTES: readonly PourcentAcompte[] = [0, 30, 40];

export async function listeDevis(entrepriseId: string): Promise<readonly DevisEnListe[]> {
  const devis = await prisma.devis.findMany({
    where: { entrepriseId },
    orderBy: [{ creeLe: 'desc' }],
    select: {
      id: true,
      numero: true,
      statut: true,
      totalTTC: true,
      creeLe: true,
      envoyeLe: true,
      version: true,
      client: { select: { nom: true } },
    },
  });

  return devis.map((ligne) => ({
    id: ligne.id,
    numero: ligne.numero,
    statut: ligne.statut,
    clientNom: ligne.client?.nom ?? null,
    totalTTC: nombre(ligne.totalTTC),
    creeLe: ligne.creeLe,
    envoyeLe: ligne.envoyeLe,
    version: ligne.version,
  }));
}

/** Lit un devis — en vérifiant qu'il appartient bien à l'entreprise de la session. */
export async function devisDuPro(
  entrepriseId: string,
  devisId: string,
): Promise<DevisComplet | null> {
  const devis = await prisma.devis.findFirst({
    where: { id: devisId, entrepriseId },
    include: { lignes: { orderBy: { rang: 'asc' } } },
  });
  if (devis === null) return null;

  const clients = await prisma.clientPro.findMany({
    where: { entrepriseId },
    select: { id: true, nom: true },
    orderBy: { nom: 'asc' },
  });

  const lignes: readonly LigneDevis[] = devis.lignes.map((ligne) => ({
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

  const acomptePourcent = devis.acomptePourcent as PourcentAcompte;
  const document = { lignes, remisePourcent: nombre(devis.remisePourcent), acomptePourcent };

  return {
    id: devis.id,
    numero: devis.numero,
    statut: devis.statut,
    type: devis.type,
    version: devis.version,
    envoyeLe: devis.envoyeLe,
    clientId: devis.clientId,
    lignes,
    remisePourcent: nombre(devis.remisePourcent),
    acomptePourcent,
    validiteJours: devis.validiteJours as ValiditeJours,
    fraisDeplacementTTC:
      devis.fraisDeplacementTTC === null ? null : nombre(devis.fraisDeplacementTTC),
    devisPayant: devis.devisPayant,
    piecesRemplaceesGardees: devis.piecesRemplaceesGardees,
    mentionRetractation: devis.mentionRetractation,
    totaux: calculeTotaux(document),
    conformite: devisConforme(document, mentions(devis)),
    modifiable: devis.statut === 'brouillon',
    clients,
  };
}

/**
 * Les mentions obligatoires, telles que `devisConforme` les attend.
 *
 * Les frais de déplacement comptent comme indiqués **dès qu'ils portent une valeur, zéro
 * compris** : « déplacement offert » est une mention, l'absence de mention n'en est pas une.
 */
function mentions(devis: {
  readonly fraisDeplacementTTC: unknown;
  readonly validiteJours: number;
}) {
  // Une validité hors des trois durées prévues n'est pas une validité : `devisConforme` la
  // réclamera, plutôt que de laisser passer une valeur que le document ne saurait écrire.
  const validite = VALIDITES.find((jours) => jours === devis.validiteJours) ?? null;
  return {
    // Zéro compte : « déplacement offert » est une mention, son absence n'en est pas une.
    fraisDeplacementIndiques: devis.fraisDeplacementTTC !== null,
    validiteJours: validite,
    // Ces deux mentions figurent toujours sur le document : la base porte un booléen, pas un
    // « non répondu ». Le professionnel choisit leur valeur, jamais leur présence.
    caractereGratuitIndique: true,
    piecesRemplaceesIndiquee: true,
  };
}

/** Crée un brouillon vide. Aucun numéro n'est attribué à ce stade. */
export async function creeDevis(
  entrepriseId: string,
  depuis?: { readonly clientId?: string; readonly demandeId?: string },
): Promise<string> {
  const devis = await prisma.devis.create({
    data: {
      entrepriseId,
      ...(depuis?.clientId !== undefined ? { clientId: depuis.clientId } : {}),
      ...(depuis?.demandeId !== undefined ? { demandeId: depuis.demandeId } : {}),
      // Le déplacement est à zéro et non à `null` : la mention est obligatoire, et la valeur
      // par défaut la plus fréquente chez les artisans est « offert ».
      fraisDeplacementTTC: 0,
    },
    select: { id: true },
  });
  return devis.id;
}

export interface SaisieLigne {
  readonly type: TypeLigne;
  readonly designation: string;
  readonly detail: string;
  readonly unite: Unite | null;
  readonly quantite: number | null;
  readonly prixUnitaireHT: number | null;
  readonly tauxTva: TauxTva | null;
}

export interface SaisieDevis {
  readonly clientId: string | null;
  readonly type: TypeDevis;
  readonly lignes: readonly SaisieLigne[];
  readonly remisePourcent: number;
  readonly acomptePourcent: PourcentAcompte;
  readonly validiteJours: ValiditeJours;
  readonly fraisDeplacementTTC: number | null;
  readonly devisPayant: boolean;
  readonly piecesRemplaceesGardees: boolean;
  readonly mentionRetractation: boolean;
}

export type ResultatDevis =
  | { readonly ok: true; readonly totaux: Totaux; readonly conformite: ConformiteDevis }
  | { readonly ok: false; readonly message: string };

/** Enregistre un brouillon : lignes, options et totaux recalculés. */
export async function enregistreDevis(
  entrepriseId: string,
  devisId: string,
  saisie: SaisieDevis,
): Promise<ResultatDevis> {
  const existant = await prisma.devis.findFirst({
    where: { id: devisId, entrepriseId },
    select: { statut: true },
  });
  if (existant === null) return { ok: false, message: 'Ce devis n’existe pas.' };
  if (existant.statut !== 'brouillon') {
    return {
      ok: false,
      message:
        'Ce devis a déjà été envoyé : il ne se modifie plus. Dupliquez-le pour en établir une nouvelle version.',
    };
  }

  for (const ligne of saisie.lignes) {
    if (ligne.designation.trim() === '') {
      return { ok: false, message: 'Chaque ligne a besoin d’une désignation.' };
    }
    if (ligne.unite !== null && !UNITES.includes(ligne.unite)) {
      return { ok: false, message: 'Une unité est inconnue.' };
    }
    if (ligne.tauxTva !== null && !TAUX_TVA.includes(ligne.tauxTva)) {
      return { ok: false, message: 'Un taux de TVA est inconnu.' };
    }
  }
  if (saisie.remisePourcent < 0 || saisie.remisePourcent > 100) {
    return { ok: false, message: 'Une remise se situe entre 0 et 100 %.' };
  }

  if (saisie.clientId !== null) {
    const client = await prisma.clientPro.findFirst({
      where: { id: saisie.clientId, entrepriseId },
      select: { id: true },
    });
    if (client === null) return { ok: false, message: 'Ce client n’existe pas.' };
  }

  const lignes: readonly LigneDocument[] = saisie.lignes.map((ligne, rang) => ({
    id: String(rang),
    type: ligne.type,
    designation: ligne.designation.trim(),
    ...(ligne.detail.trim() !== '' ? { detail: ligne.detail.trim() } : {}),
    ...(ligne.unite !== null ? { unite: ligne.unite } : {}),
    ...(ligne.quantite !== null ? { quantite: ligne.quantite } : {}),
    ...(ligne.prixUnitaireHT !== null ? { prixUnitaireHT: ligne.prixUnitaireHT } : {}),
    ...(ligne.tauxTva !== null ? { tauxTva: ligne.tauxTva } : {}),
  }));

  const document = {
    lignes,
    remisePourcent: saisie.remisePourcent,
    acomptePourcent: saisie.acomptePourcent,
  };
  const totaux = calculeTotaux(document);

  await prisma.$transaction(async (tx) => {
    await tx.devisLigne.deleteMany({ where: { devisId } });
    if (saisie.lignes.length > 0) {
      await tx.devisLigne.createMany({
        data: saisie.lignes.map((ligne, rang) => ({
          devisId,
          rang,
          type: ligne.type,
          designation: ligne.designation.trim(),
          detail: ligne.detail.trim() === '' ? null : ligne.detail.trim(),
          unite: ligne.unite,
          quantite: ligne.quantite,
          prixUnitaireHT: ligne.prixUnitaireHT,
          tauxTva: ligne.tauxTva,
        })),
      });
    }

    await tx.devis.update({
      where: { id: devisId },
      data: {
        clientId: saisie.clientId,
        type: saisie.type,
        remisePourcent: saisie.remisePourcent,
        acomptePourcent: saisie.acomptePourcent,
        validiteJours: saisie.validiteJours,
        fraisDeplacementTTC: saisie.fraisDeplacementTTC,
        devisPayant: saisie.devisPayant,
        piecesRemplaceesGardees: saisie.piecesRemplaceesGardees,
        mentionRetractation: saisie.mentionRetractation,
        // Les totaux sont stockés pour que la liste et la comptabilité n'aient pas à
        // recalculer : ils viennent toujours de `calculeTotaux`, jamais d'une addition faite
        // sur place.
        totalHT: totaux.totalHT,
        totalTVA: totaux.totalTVA,
        totalTTC: totaux.totalTTC,
      },
    });
  });

  return {
    ok: true,
    totaux,
    conformite: devisConforme(document, {
      fraisDeplacementIndiques: saisie.fraisDeplacementTTC !== null,
      validiteJours: saisie.validiteJours,
      caractereGratuitIndique: true,
      piecesRemplaceesIndiquee: true,
    }),
  };
}

export type ResultatEnvoi =
  | {
      readonly ok: true;
      readonly numero: string;
      /** Par où le devis est parti. Vide quand le client n'a ni courriel ni mobile. */
      readonly canaux: readonly ('email' | 'sms')[];
    }
  | { readonly ok: false; readonly message: string; readonly manquants?: readonly string[] };

/**
 * Envoie un devis : il reçoit son numéro, devient immuable, et **part chez le client**.
 *
 * Il ne partait nulle part. Le bouton disait « Envoyer au client », le statut passait à
 * `envoye`, le numéro était attribué — et le client n'apprenait jamais que le devis
 * existait. Un verbe dans une interface est une promesse ; celle-là n'était pas tenue.
 *
 * Le devis part par un lien à usage limité, comme tout ce que Le Renom adresse à un client :
 * il n'y a pas de compte client, et un lien reçu est la seule clé. Ce lien-ci porte l'action
 * `signer_devis` — il ouvre la page du devis, et lui seul.
 *
 * Le numéro est tiré **dans la transaction**, à partir du dernier numéro de la série : deux
 * envois simultanés ne doivent pas produire deux fois le même, et la contrainte d'unicité de
 * la base est le dernier rempart si la fenêtre se referme mal.
 */
/**
 * Met le devis en route vers son client : un lien, puis un courriel et un SMS.
 *
 * Les messages s'empilent dans `messages_sortants`, comme tout ce que la plateforme adresse :
 * aucun fournisseur n'est encore branché, et le jour où il le sera, rien ici ne changera.
 *
 * Un échec d'envoi ne remonte pas en échec d'envoi du devis. Le devis **est** envoyé : il
 * porte son numéro et il est immuable. Revenir en arrière sur cet état parce qu'un message
 * n'a pas pu être mis en file créerait un trou dans la numérotation pour une panne qui se
 * rattrape. L'écran dit par où c'est parti, et le dit aussi quand ce n'est parti nulle part.
 */
async function adresseLeDevisAuClient(
  entrepriseId: string,
  devisId: string,
  numero: string,
): Promise<readonly ('email' | 'sms')[]> {
  const devis = await prisma.devis.findFirst({
    where: { id: devisId, entrepriseId },
    select: {
      totalTTC: true,
      client: { select: { nom: true, email: true, telephone: true } },
      entreprise: { select: { nom: true } },
    },
  });
  if (devis?.client == null) return [];
  const { client } = devis;
  if (client.email === null && client.telephone === null) return [];

  // Pas de demande derrière : ce devis est établi par le professionnel pour son propre
  // client. La colonne l'a toujours permis.
  const lien = await creeLien(null, 'signer_devis', devisId);
  const montant = formatEuros(Number(devis.totalTTC));
  const entreprise = devis.entreprise.nom;

  const messages: {
    canal: 'email' | 'sms';
    destinataire: string;
    sujet: string | null;
    corps: string;
  }[] = [];

  if (client.email !== null) {
    messages.push({
      canal: 'email',
      destinataire: client.email,
      sujet: `Votre devis ${numero} — ${entreprise}`,
      corps: `Bonjour,\n\n${entreprise} vous adresse le devis ${numero}, d'un montant de ${montant} TTC.\n\nVous pouvez le consulter et l'accepter ici :\n${lien.url}\n\nCe lien vous est personnel.`,
    });
  }
  if (client.telephone !== null) {
    messages.push({
      canal: 'sms',
      destinataire: client.telephone,
      sujet: null,
      corps: `${entreprise} vous adresse le devis ${numero} (${montant} TTC) : ${lien.url}`,
    });
  }

  await prisma.messageSortant.createMany({
    data: messages.map((message) => ({
      canal: message.canal,
      modele: 'devis-envoye',
      destinataire: message.destinataire,
      sujet: message.sujet,
      corps: message.corps,
      statut: 'en_attente' as const,
    })),
  });

  return messages.map((message) => message.canal);
}

export async function envoieDevis(entrepriseId: string, devisId: string): Promise<ResultatEnvoi> {
  const devis = await devisDuPro(entrepriseId, devisId);
  if (devis === null) return { ok: false, message: 'Ce devis n’existe pas.' };
  if (devis.statut !== 'brouillon') {
    return { ok: false, message: 'Ce devis a déjà été envoyé.' };
  }
  if (!devis.conformite.conforme) {
    return {
      ok: false,
      message: 'Ce devis ne porte pas encore toutes les mentions obligatoires.',
      manquants: devis.conformite.manquants,
    };
  }

  const parametres = await prisma.parametresDocuments.findUnique({
    where: { entrepriseId },
    select: { prefixeDevis: true },
  });
  const prefixe = parametres?.prefixeDevis ?? 'DV';
  const annee = new Date().getFullYear();

  try {
    const numero = await prisma.$transaction(async (tx) => {
      const dernier = await tx.devis.findFirst({
        where: { entrepriseId, numero: { startsWith: `${prefixe}-${String(annee)}-` } },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      });
      const attribue = prochainNumero(prefixe, annee, dernier?.numero ?? null);

      await tx.devis.update({
        where: { id: devisId },
        data: { numero: attribue, statut: 'envoye', envoyeLe: new Date() },
      });
      return attribue;
    });

    const canaux = await adresseLeDevisAuClient(entrepriseId, devisId, numero);
    return { ok: true, numero, canaux };
  } catch (erreur) {
    if (
      typeof erreur === 'object' &&
      erreur !== null &&
      (erreur as { code?: string }).code === 'P2002'
    ) {
      return {
        ok: false,
        message: 'Un autre devis vient de prendre ce numéro. Réessayez dans un instant.',
      };
    }
    throw erreur;
  }
}

/**
 * Duplique un devis en un nouveau brouillon.
 *
 * C'est la façon prévue de corriger un devis déjà remis : l'ancien reste tel qu'il a été
 * envoyé, le nouveau porte la version suivante et recevra son propre numéro à l'envoi.
 */
export async function dupliqueDevis(
  entrepriseId: string,
  devisId: string,
): Promise<
  { readonly ok: true; readonly id: string } | { readonly ok: false; readonly message: string }
> {
  const source = await prisma.devis.findFirst({
    where: { id: devisId, entrepriseId },
    include: { lignes: { orderBy: { rang: 'asc' } } },
  });
  if (source === null) return { ok: false, message: 'Ce devis n’existe pas.' };

  const copie = await prisma.devis.create({
    data: {
      entrepriseId,
      clientId: source.clientId,
      demandeId: source.demandeId,
      type: source.type,
      remisePourcent: source.remisePourcent,
      acomptePourcent: source.acomptePourcent,
      validiteJours: source.validiteJours,
      fraisDeplacementTTC: source.fraisDeplacementTTC,
      devisPayant: source.devisPayant,
      piecesRemplaceesGardees: source.piecesRemplaceesGardees,
      mentionRetractation: source.mentionRetractation,
      totalHT: source.totalHT,
      totalTVA: source.totalTVA,
      totalTTC: source.totalTTC,
      version: source.version + 1,
      lignes: {
        create: source.lignes.map((ligne) => ({
          rang: ligne.rang,
          type: ligne.type,
          designation: ligne.designation,
          detail: ligne.detail,
          unite: ligne.unite,
          quantite: ligne.quantite,
          prixUnitaireHT: ligne.prixUnitaireHT,
          tauxTva: ligne.tauxTva,
        })),
      },
    },
    select: { id: true },
  });

  return { ok: true, id: copie.id };
}
