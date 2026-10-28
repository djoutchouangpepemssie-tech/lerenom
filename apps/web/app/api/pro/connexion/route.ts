import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lerenom/db';
import { verrouDeConnexion } from '@lerenom/core';
import { empreinteADurcir, hacheMotDePasse, verifieMotDePasse } from '@lerenom/securite';
import { ouvreSession } from '@/lib/session-pro';

/**
 * La connexion d'un professionnel.
 *
 * Deux principes gouvernent ce fichier, et ils vont ensemble :
 *
 * **Une seule réponse d'échec.** Qu'une adresse soit inconnue, que le compte n'ait pas de mot
 * de passe ou que le mot de passe soit faux, le message est le même. Distinguer ces cas
 * donnerait à n'importe qui le moyen de savoir quels artisans sont inscrits chez nous.
 *
 * **La limitation des essais.** C'est la vraie défense contre la devinette, bien plus que
 * l'exigence d'un mot de passe compliqué. Cinq essais, puis un quart d'heure d'attente — et le
 * verrou se lève tout seul : un compte bloqué définitivement serait une arme contre son
 * titulaire.
 */

export const dynamic = 'force-dynamic';

const Identifiants = z.object({
  email: z.string().email().max(200),
  motDePasse: z.string().min(1).max(200),
});

const ECHEC = { erreur: 'Adresse électronique ou mot de passe incorrect.' } as const;

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
  const utilisateur = await prisma.utilisateurPro.findUnique({
    where: { email },
    select: {
      id: true,
      motDePasseHash: true,
      tentativesConnexion: true,
      derniereTentativeLe: true,
      entreprise: { select: { suspendue: true } },
    },
  });

  // Compte inconnu : même réponse, même durée apparente. On ne révèle pas qui est inscrit.
  if (utilisateur === null || utilisateur.motDePasseHash === null) {
    return NextResponse.json(ECHEC, { status: 401 });
  }

  const verrou = verrouDeConnexion({
    tentatives: utilisateur.tentativesConnexion,
    derniereTentativeLe: utilisateur.derniereTentativeLe,
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

  const correct = await verifieMotDePasse(analyse.data.motDePasse, utilisateur.motDePasseHash);

  if (!correct) {
    await prisma.utilisateurPro.update({
      where: { id: utilisateur.id },
      data: { tentativesConnexion: { increment: 1 }, derniereTentativeLe: new Date() },
    });
    return NextResponse.json(ECHEC, { status: 401 });
  }

  if (utilisateur.entreprise.suspendue) {
    return NextResponse.json(
      { erreur: 'Ce compte est suspendu. Écrivez-nous pour en connaître la raison.' },
      { status: 403 },
    );
  }

  // Le compteur d'échecs repart de zéro **ici**, et pas dans l'ouverture de session : c'est
  // une décision de sécurité, elle appartient au contrôle d'identité. La cacher ailleurs
  // reviendrait à ce qu'un futur appelant de `ouvreSession` remette un compteur à zéro sans
  // le savoir.
  await prisma.utilisateurPro.update({
    where: { id: utilisateur.id },
    data: { tentativesConnexion: 0, derniereTentativeLe: null },
  });

  // Le coût du hachage a pu être durci depuis la création du compte : on en profite pour
  // réécrire l'empreinte, sans rien demander au professionnel.
  if (empreinteADurcir(utilisateur.motDePasseHash)) {
    await prisma.utilisateurPro.update({
      where: { id: utilisateur.id },
      data: { motDePasseHash: await hacheMotDePasse(analyse.data.motDePasse) },
    });
  }

  await ouvreSession(utilisateur.id);

  return NextResponse.json({ connecte: true });
}
