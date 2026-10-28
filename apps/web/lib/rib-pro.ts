import { prisma } from '@lerenom/db';
import {
  expirationCode,
  memeCompte,
  normaliseRib,
  type ProblemeRib,
  type ResultatVerification,
  type SaisieRib,
} from '@lerenom/core';
import { empreinteCode, tireCode, verifieCode } from '@lerenom/securite';
import { secretVerification } from '@/lib/secrets';

/**
 * Les coordonnées bancaires d'un professionnel.
 *
 * Ce fichier tient deux promesses faites ailleurs dans le produit.
 *
 * **Un changement de compte se confirme par SMS.** Pas par politesse : un escroc qui prend la
 * main sur un espace professionnel n'a rien à voler sur place, il veut que les virements des
 * clients arrivent chez lui. Le code part donc au numéro **déjà enregistré**, jamais à un
 * numéro fourni dans la même requête — qui ne prouverait rien. Et l'ancien compte reste le
 * compte actif tant que le code n'est pas saisi : un attaquant qui n'aboutit pas ne doit même
 * pas pouvoir couper les encaissements de sa victime.
 *
 * **Un RIB ne se supprime pas.** Les factures émises le désignent, figé à l'émission. Le
 * nouveau *remplace* l'ancien, qui reste en base avec sa date de remplacement — et les
 * anciennes factures continuent de montrer le compte sur lequel on les a réclamées.
 *
 * Le code à usage unique réutilise la machinerie de la vérification du mobile des clients :
 * même tirage, même hachage salé, mêmes règles de tentatives et d'expiration. Elle n'avait
 * rien de propre aux demandes.
 */

export interface RibAffiche {
  readonly id: string;
  readonly titulaire: string;
  readonly iban: string;
  readonly bic: string;
  readonly banque: string | null;
  readonly actif: boolean;
  readonly confirmeParSmsLe: Date | null;
  readonly remplaceLe: Date | null;
  readonly creeLe: Date;
  /** Nombre de factures déjà émises sur ce compte : la raison pour laquelle il ne s'efface pas. */
  readonly facturesEmises: number;
}

export interface EtatBancaire {
  readonly actif: RibAffiche | null;
  /** Le RIB saisi mais pas encore confirmé, s'il y en a un. */
  readonly enAttente: RibAffiche | null;
  readonly anciens: readonly RibAffiche[];
  /** Le mobile auquel part le code, masqué. `null` quand aucun n'est enregistré. */
  readonly mobileMasque: string | null;
}

function affiche(rib: {
  id: string;
  titulaire: string;
  iban: string;
  bic: string;
  banque: string | null;
  actif: boolean;
  confirmeParSmsLe: Date | null;
  remplaceLe: Date | null;
  creeLe: Date;
  _count: { factures: number };
}): RibAffiche {
  return {
    id: rib.id,
    titulaire: rib.titulaire,
    iban: rib.iban,
    bic: rib.bic,
    banque: rib.banque,
    actif: rib.actif,
    confirmeParSmsLe: rib.confirmeParSmsLe,
    remplaceLe: rib.remplaceLe,
    creeLe: rib.creeLe,
    facturesEmises: rib._count.factures,
  };
}

/**
 * Le mobile du professionnel, masqué.
 *
 * Masqué parce que l'écran doit dire **où** part le code sans l'afficher en clair : quelqu'un
 * qui regarde par-dessus l'épaule, ou une capture d'écran partagée, ne doivent pas livrer le
 * numéro. Les deux derniers chiffres suffisent à reconnaître le sien.
 */
function masqueMobile(telephone: string): string {
  const chiffres = telephone.replace(/\D/g, '');
  if (chiffres.length < 4) return '••';
  // Espaces insécables : la capture montrait « au • • • • • • • • / 92 », le masque coupé en
  // deux par un retour à la ligne. Un numéro de téléphone ne se coupe pas, masqué ou non.
  const INSECABLE = '\u00a0';
  return ['••', '••', '••', '••', chiffres.slice(-2)].join(INSECABLE);
}

async function mobileDuPro(entrepriseId: string): Promise<string | null> {
  const utilisateur = await prisma.utilisateurPro.findFirst({
    where: { entrepriseId, telephone: { not: null } },
    orderBy: { creeLe: 'asc' },
    select: { telephone: true },
  });
  return utilisateur?.telephone ?? null;
}

export async function etatBancaire(entrepriseId: string): Promise<EtatBancaire> {
  const [ribs, telephone] = await Promise.all([
    prisma.rib.findMany({
      where: { entrepriseId },
      orderBy: [{ creeLe: 'desc' }],
      select: {
        id: true,
        titulaire: true,
        iban: true,
        bic: true,
        banque: true,
        actif: true,
        confirmeParSmsLe: true,
        remplaceLe: true,
        creeLe: true,
        _count: { select: { factures: true } },
      },
    }),
    mobileDuPro(entrepriseId),
  ]);

  const tous = ribs.map(affiche);
  return {
    actif: tous.find((rib) => rib.actif) ?? null,
    enAttente: tous.find((rib) => !rib.actif && rib.confirmeParSmsLe === null) ?? null,
    anciens: tous.filter((rib) => !rib.actif && rib.confirmeParSmsLe !== null),
    mobileMasque: telephone === null ? null : masqueMobile(telephone),
  };
}

export type ResultatSaisieRib =
  | { readonly ok: true; readonly ribId: string; readonly mobileMasque: string }
  | { readonly ok: false; readonly problemes: readonly ProblemeRib[] };

/**
 * Enregistre un compte bancaire et envoie le code de confirmation.
 *
 * Le RIB naît **inactif** : il ne deviendra le compte de référence qu'une fois le code saisi.
 * Jusque-là, l'ancien continue de figurer sur les factures émises.
 */
export async function saisitRib(
  entrepriseId: string,
  saisie: SaisieRib,
): Promise<ResultatSaisieRib> {
  const normalise = normaliseRib(saisie);
  if (!normalise.ok) return { ok: false, problemes: normalise.problemes };

  const telephone = await mobileDuPro(entrepriseId);
  if (telephone === null) {
    // Sans second canal, la confirmation ne prouve rien : on refuse plutôt que de se
    // contenter d'un contrôle qui n'en est pas un. Voir docs/QUESTIONS.md Q30.
    return {
      ok: false,
      problemes: [
        {
          champ: 'titulaire',
          message:
            'Renseignez d’abord un mobile sur votre compte : le changement de coordonnées bancaires se confirme par un code envoyé à ce numéro.',
        },
      ],
    };
  }

  const actif = await prisma.rib.findFirst({
    where: { entrepriseId, actif: true },
    select: { iban: true },
  });
  if (actif !== null && memeCompte(actif.iban, normalise.rib.iban)) {
    return {
      ok: false,
      problemes: [{ champ: 'iban', message: 'C’est déjà votre compte enregistré.' }],
    };
  }

  const code = tireCode();
  const ribId = await prisma.$transaction(async (tx) => {
    // Un seul RIB en attente à la fois : resaisir le formulaire remplace la tentative
    // précédente plutôt que d'accumuler des comptes à confirmer.
    await tx.rib.deleteMany({
      where: { entrepriseId, actif: false, confirmeParSmsLe: null, factures: { none: {} } },
    });

    const cree = await tx.rib.create({
      data: {
        entrepriseId,
        titulaire: normalise.rib.titulaire,
        iban: normalise.rib.iban,
        bic: normalise.rib.bic,
        banque: normalise.rib.banque,
        actif: false,
        codeExpireLe: expirationCode(),
      },
      select: { id: true },
    });

    // L'empreinte est salée par l'identifiant du RIB : elle ne sert donc que pour celui-là.
    await tx.rib.update({
      where: { id: cree.id },
      data: { codeConfirmationHash: empreinteCode(code, cree.id, secretVerification()) },
    });

    await tx.messageSortant.create({
      data: {
        canal: 'sms',
        modele: 'rib-confirmation',
        destinataire: telephone,
        sujet: null,
        corps: `Le Renom : code ${code} pour confirmer le changement de vos coordonnées bancaires. Si vous n'êtes pas à l'origine de cette demande, contactez-nous immédiatement.`,
        statut: 'en_attente',
      },
    });

    return cree.id;
  });

  return { ok: true, ribId, mobileMasque: masqueMobile(telephone) };
}

export type ResultatConfirmation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issue: ResultatVerification['issue']; readonly message: string };

const MESSAGES: Readonly<Record<ResultatVerification['issue'], string>> = Object.freeze({
  verifie: '',
  'code-faux': 'Ce code ne correspond pas.',
  expire: 'Ce code a expiré. Reprenez la saisie pour en recevoir un nouveau.',
  'trop-de-tentatives': 'Trop d’essais. Reprenez la saisie pour recevoir un nouveau code.',
  'deja-verifie': 'Ce compte est déjà confirmé.',
});

/**
 * Confirme un changement de compte avec le code reçu par SMS.
 *
 * Le basculement est atomique : l'ancien RIB est désactivé et le nouveau activé dans la même
 * transaction. L'index partiel `ribs_actif_idx` refuserait de toute façon deux comptes actifs
 * — c'est le filet sous le code.
 */
export async function confirmeRib(
  entrepriseId: string,
  ribId: string,
  codeSaisi: string,
): Promise<ResultatConfirmation> {
  const rib = await prisma.rib.findFirst({
    where: { id: ribId, entrepriseId },
    select: {
      id: true,
      codeConfirmationHash: true,
      codeExpireLe: true,
      tentativesConfirmation: true,
      confirmeParSmsLe: true,
    },
  });
  if (rib === null) {
    return { ok: false, issue: 'expire', message: 'Cette demande n’existe plus.' };
  }

  const resultat = verifieCode(
    {
      sel: rib.id,
      empreinte: rib.codeConfirmationHash,
      expireLe: rib.codeExpireLe,
      tentatives: rib.tentativesConfirmation,
      dejaVerifie: rib.confirmeParSmsLe !== null,
    },
    codeSaisi,
    secretVerification(),
  );

  if (resultat.issue !== 'verifie') {
    // Chaque essai compte, y compris celui sur un code expiré : sans cela, la limite se
    // contourne en laissant le code vieillir.
    if (resultat.issue === 'code-faux' || resultat.issue === 'expire') {
      await prisma.rib.update({
        where: { id: ribId },
        data: { tentativesConfirmation: { increment: 1 } },
      });
    }
    const suffixe =
      resultat.issue === 'code-faux'
        ? ` Il vous reste ${String(resultat.tentativesRestantes)} essai${resultat.tentativesRestantes > 1 ? 's' : ''}.`
        : '';
    return { ok: false, issue: resultat.issue, message: MESSAGES[resultat.issue] + suffixe };
  }

  await prisma.$transaction(async (tx) => {
    await tx.rib.updateMany({
      where: { entrepriseId, actif: true },
      data: { actif: false, remplaceLe: new Date() },
    });
    await tx.rib.update({
      where: { id: ribId },
      data: {
        actif: true,
        confirmeParSmsLe: new Date(),
        // Le code a servi : il ne doit plus pouvoir servir.
        codeConfirmationHash: null,
        codeExpireLe: null,
      },
    });
  });

  return { ok: true };
}
