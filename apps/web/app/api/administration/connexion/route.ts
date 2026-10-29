import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lerenom/db';
import { verrouDeConnexion } from '@lerenom/core';
import {
  codeDejaUtilise,
  empreinteADurcir,
  hacheMotDePasse,
  verifieMotDePasse,
  verifieTotp,
} from '@lerenom/securite';
import { ouvreSessionAdmin } from '@/lib/session-admin';

/**
 * La connexion au back-office.
 *
 * Les mêmes principes que la connexion d'un professionnel — une seule réponse d'échec, une
 * limitation des essais — et trois exigences de plus, parce qu'un compte du back-office voit
 * les coordonnées de tous les clients et gouverne la distribution.
 *
 * **Le code est obligatoire, et le mot de passe seul n'ouvre rien.** Un compte sans double
 * authentification configurée ne peut pas se connecter : il n'est pas « en attente », il est
 * inutilisable tant que quelqu'un ne l'a pas équipé. Une exception « juste le temps de… »
 * serait permanente.
 *
 * **Un code ne sert qu'une fois.** Le pas qui a validé est enregistré, et tout pas antérieur
 * ou égal est refusé ensuite. Sans cela, un code lu par-dessus l'épaule reste utilisable une
 * minute et demie — et c'est exactement la fenêtre dont a besoin quelqu'un qui regarde un
 * écran dans un train.
 *
 * **Le compteur d'essais monte aussi quand le code est faux.** Sinon, un mot de passe volé
 * donnerait un million d'essais gratuits sur six chiffres, ce qui n'est plus une protection.
 */

export const dynamic = 'force-dynamic';

const Identifiants = z.object({
  email: z.string().email().max(200),
  motDePasse: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
});

/** Une seule réponse d'échec : on ne dit jamais laquelle des trois valeurs était fausse. */
const ECHEC = { erreur: 'Identifiants ou code incorrects.' } as const;

export async function POST(requete: Request): Promise<NextResponse> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Identifiants.safeParse(corps);
  if (!analyse.success) return NextResponse.json(ECHEC, { status: 401 });

  const email = analyse.data.email.trim().toLowerCase();
  const admin = await prisma.admin.findUnique({
    where: { email },
    select: {
      id: true,
      motDePasseHash: true,
      totpSecret: true,
      totpActiveLe: true,
      dernierPasTotp: true,
      actif: true,
      tentativesConnexion: true,
      derniereTentativeLe: true,
    },
  });

  if (admin === null) return NextResponse.json(ECHEC, { status: 401 });

  const verrou = verrouDeConnexion({
    tentatives: admin.tentativesConnexion,
    derniereTentativeLe: admin.derniereTentativeLe,
  });
  if (verrou.issue === 'verrouille') {
    return NextResponse.json(
      {
        erreur: `Trop de tentatives. Réessayez dans ${String(verrou.minutesRestantes)} minutes.`,
        minutesRestantes: verrou.minutesRestantes,
      },
      { status: 429 },
    );
  }

  // L'identifiant est capturé hors de la fermeture : à l'intérieur, le compilateur ne sait
  // plus que `admin` n'est pas nul, et le rendre optionnel effacerait le `where`.
  const adminId = admin.id;

  /** Un échec compte, quelle qu'en soit la cause. */
  async function echoue(): Promise<NextResponse> {
    await prisma.admin.update({
      where: { id: adminId },
      data: { tentativesConnexion: { increment: 1 }, derniereTentativeLe: new Date() },
    });
    return NextResponse.json(ECHEC, { status: 401 });
  }

  if (!(await verifieMotDePasse(analyse.data.motDePasse, admin.motDePasseHash))) {
    return echoue();
  }

  // Le compte désactivé est traité après le mot de passe : répondre plus tôt dirait à qui
  // essaie une adresse au hasard qu'elle existe.
  if (!admin.actif) return NextResponse.json(ECHEC, { status: 401 });

  if (admin.totpSecret === null || admin.totpActiveLe === null) {
    // Volontairement explicite : ce n'est pas un échec d'identifiants, et le dire aide la
    // personne légitime sans rien apprendre à personne d'autre — elle a déjà passé le mot
    // de passe.
    return NextResponse.json(
      {
        erreur:
          'Ce compte n’a pas de double authentification. Le back-office ne s’ouvre pas sans elle : demandez à un administrateur de l’activer.',
      },
      { status: 403 },
    );
  }

  const verification = verifieTotp(admin.totpSecret, analyse.data.code);
  if (!verification.valide || verification.pas === null) return echoue();

  if (codeDejaUtilise(verification.pas, admin.dernierPasTotp)) {
    return echoue();
  }

  // Le compteur repart de zéro **ici**, avec le pas accepté : les deux appartiennent au
  // contrôle d'identité, et les séparer laisserait un instant où le code serait rejouable.
  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      tentativesConnexion: 0,
      derniereTentativeLe: null,
      dernierPasTotp: verification.pas,
    },
  });

  if (empreinteADurcir(admin.motDePasseHash)) {
    await prisma.admin.update({
      where: { id: admin.id },
      data: { motDePasseHash: await hacheMotDePasse(analyse.data.motDePasse) },
    });
  }

  await ouvreSessionAdmin(admin.id);
  return NextResponse.json({ connecte: true });
}
