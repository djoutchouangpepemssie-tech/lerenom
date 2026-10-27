import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lerenom/db';
import { programmeCascade } from '@lerenom/files';
import {
  codeBienForme,
  expirationCode,
  TENTATIVES_MAX,
  VALIDITE_CODE_MINUTES,
} from '@lerenom/core';
import { empreinteCode, tireCode, verifieCode } from '@lerenom/securite';
import { secretVerification } from '../../../../lib/secrets';

/**
 * Vérification du mobile d'un client, et départ de la cascade.
 *
 * C'est le seul endroit où une demande passe de `brouillon` à `en_distribution`. Avant ce
 * passage, aucun professionnel n'a vu la demande ; après, la cascade est programmée et le
 * worker prend la suite.
 *
 * `POST` confronte un code saisi. `PUT` renvoie un nouveau code — c'est le « je n'ai rien reçu »
 * du client, et c'est aussi ce qui remet le compteur de tentatives à zéro.
 *
 * Une demande dans une ville non ouverte est vérifiée comme les autres, mais elle n'est pas
 * distribuée : elle attend l'ouverture de sa ville, et le client l'a su avant d'envoyer.
 */

export const dynamic = 'force-dynamic';

const Saisie = z.object({
  reference: z.string().min(8).max(40),
  code: z.string().refine(codeBienForme, 'Le code compte six chiffres.'),
});

const Renvoi = z.object({ reference: z.string().min(8).max(40) });

/** Les réponses sont volontairement avares : elles ne disent jamais si une référence existe. */
const INTROUVABLE = { erreur: 'Cette demande est introuvable ou déjà traitée.' } as const;

async function corpsJson(requete: Request): Promise<unknown> {
  try {
    return await requete.json();
  } catch {
    return null;
  }
}

export async function POST(requete: Request): Promise<NextResponse> {
  const analyse = Saisie.safeParse(await corpsJson(requete));
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Le code compte six chiffres.' }, { status: 400 });
  }

  const { reference, code } = analyse.data;

  const demande = await prisma.demande.findUnique({
    where: { reference },
    select: {
      id: true,
      statut: true,
      codeVerificationHash: true,
      codeExpireLe: true,
      tentativesVerification: true,
      telephoneVerifieLe: true,
      commune: { select: { statut: true } },
    },
  });

  if (demande === null) {
    return NextResponse.json(INTROUVABLE, { status: 404 });
  }

  const resultat = verifieCode(
    {
      demandeId: demande.id,
      empreinte: demande.codeVerificationHash,
      expireLe: demande.codeExpireLe,
      tentatives: demande.tentativesVerification,
      dejaVerifie: demande.telephoneVerifieLe !== null,
    },
    code,
    secretVerification(),
  );

  switch (resultat.issue) {
    case 'deja-verifie':
      return NextResponse.json({ statut: demande.statut, dejaVerifie: true });

    case 'trop-de-tentatives':
      return NextResponse.json(
        {
          erreur: 'Trop de tentatives. Demandez un nouveau code.',
          nouveauCodeRequis: true,
        },
        { status: 429 },
      );

    case 'expire':
      return NextResponse.json(
        { erreur: 'Ce code a expiré. Demandez-en un nouveau.', nouveauCodeRequis: true },
        { status: 410 },
      );

    case 'code-faux':
      // La tentative est comptée même quand le client s'est simplement trompé : c'est le
      // compteur qui protège le numéro, pas la bonne foi du visiteur.
      await prisma.demande.update({
        where: { id: demande.id },
        data: { tentativesVerification: { increment: 1 } },
      });
      return NextResponse.json(
        {
          erreur: 'Ce code ne correspond pas.',
          tentativesRestantes: resultat.tentativesRestantes,
        },
        { status: 400 },
      );

    case 'verifie':
      break;
  }

  // La ville décide de la suite : ouverte, la demande part ; sinon, elle attend son ouverture.
  const villeOuverte = demande.commune.statut === 'ouvert';

  const misAJour = await prisma.demande.update({
    where: { id: demande.id },
    data: {
      telephoneVerifieLe: new Date(),
      statut: villeOuverte ? 'en_distribution' : 'en_attente_ouverture',
      // Le code a servi : on l'efface. Il ne doit pas pouvoir resservir.
      codeVerificationHash: null,
      codeExpireLe: null,
    },
    select: { statut: true },
  });

  if (villeOuverte) {
    // La cascade est programmée, pas exécutée ici : le visiteur n'attend pas que six
    // professionnels soient sollicités pour voir sa page de confirmation.
    await programmeCascade(demande.id);
  }

  return NextResponse.json({ statut: misAJour.statut, villeOuverte });
}

export async function PUT(requete: Request): Promise<NextResponse> {
  const analyse = Renvoi.safeParse(await corpsJson(requete));
  if (!analyse.success) {
    return NextResponse.json(INTROUVABLE, { status: 400 });
  }

  const demande = await prisma.demande.findUnique({
    where: { reference: analyse.data.reference },
    select: {
      id: true,
      reference: true,
      clientTelephone: true,
      telephoneVerifieLe: true,
    },
  });

  if (demande === null) {
    return NextResponse.json(INTROUVABLE, { status: 404 });
  }

  if (demande.telephoneVerifieLe !== null) {
    return NextResponse.json({ dejaVerifie: true });
  }

  const code = tireCode();

  await prisma.$transaction([
    prisma.demande.update({
      where: { id: demande.id },
      data: {
        codeVerificationHash: empreinteCode(code, demande.id, secretVerification()),
        codeExpireLe: expirationCode(),
        // Un nouveau code remet le compteur à zéro : sinon « je n'ai rien reçu » serait une
        // impasse pour le client qui s'est trompé cinq fois.
        tentativesVerification: 0,
      },
    }),
    prisma.messageSortant.create({
      data: {
        canal: 'sms',
        modele: 'verification-demande',
        destinataire: demande.clientTelephone,
        corps:
          `Le Renom : votre code de vérification est ${code}. ` +
          `Il est valable ${String(VALIDITE_CODE_MINUTES)} minutes. Demande ${demande.reference}.`,
        statut: 'en_attente',
      },
    }),
  ]);

  return NextResponse.json({ envoye: true, tentativesMax: TENTATIVES_MAX });
}
