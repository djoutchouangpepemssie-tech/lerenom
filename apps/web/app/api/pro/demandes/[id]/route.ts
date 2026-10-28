import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lerenom/db';
import { accepte, refuse } from '@lerenom/distribution';
import { proConnecte } from '@/lib/session-pro';

/**
 * Ce qu'un professionnel fait d'une demande qu'on lui propose.
 *
 * Trois actions, et elles ne pèsent pas le même poids :
 *
 * **Accepter** est définitif et facturé. L'opération est synchrone — pas de file d'attente —
 * parce que le verrou qui empêche deux professionnels de prendre la même place doit se poser
 * pendant cette requête, et parce que le pro attend ses coordonnées à l'écran.
 *
 * **Refuser** est gratuit, et le motif est obligatoire. Ce motif n'est pas une formalité : il
 * nourrit le score de pertinence, et un « pas mon métier » répété signale une erreur de
 * classement qu'il faut corriger en amont.
 *
 * **Déclarer les travaux réalisés** ouvre le droit à l'avis. Le client peut le déclarer de son
 * côté ; le pro est simplement le mieux placé pour le faire en premier.
 */

export const dynamic = 'force-dynamic';

const MOTIFS = ['indisponible', 'trop-loin', 'pas-mon-metier', 'budget-trop-bas'] as const;

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accepter') }),
  z.object({ action: z.literal('refuser'), motif: z.enum(MOTIFS) }),
  z.object({ action: z.literal('declarer-travaux') }),
]);

export async function POST(
  requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Connectez-vous pour continuer.' }, { status: 401 });
  }

  const { id } = await params;

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Action.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Action inconnue.' }, { status: 400 });
  }

  // La distribution doit appartenir à l'entreprise connectée. Sans ce contrôle, un
  // identifiant deviné donnerait accès aux coordonnées d'un client qui n'a rien à voir.
  const distribution = await prisma.distribution.findUnique({
    where: { id },
    select: { id: true, entrepriseId: true, statut: true, demandeId: true },
  });

  if (distribution === null || distribution.entrepriseId !== pro.entrepriseId) {
    // Même réponse pour « n'existe pas » et « n'est pas à vous » : on ne confirme pas
    // l'existence d'une demande à quelqu'un qui n'y a pas droit.
    return NextResponse.json({ erreur: 'Cette demande est introuvable.' }, { status: 404 });
  }

  if (analyse.data.action === 'declarer-travaux') {
    if (distribution.statut !== 'acceptee') {
      return NextResponse.json(
        { erreur: 'Seule une demande acceptée peut être déclarée réalisée.' },
        { status: 409 },
      );
    }

    const existante = await prisma.suiviDemande.findFirst({
      where: {
        demandeId: distribution.demandeId,
        entrepriseId: pro.entrepriseId,
        etape: 'travaux_realises',
      },
      select: { id: true },
    });

    if (existante === null) {
      await prisma.suiviDemande.create({
        data: {
          demandeId: distribution.demandeId,
          entrepriseId: pro.entrepriseId,
          etape: 'travaux_realises',
          declarePar: 'pro',
        },
      });
    }

    return NextResponse.json({ declare: true });
  }

  if (analyse.data.action === 'refuser') {
    const refusee = await refuse(distribution.id, analyse.data.motif);
    if (!refusee) {
      return NextResponse.json(
        { erreur: 'Cette demande n’attend plus votre réponse.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ refuse: true });
  }

  try {
    const resultat = await accepte(distribution.id);
    return NextResponse.json({
      accepte: true,
      montantHT: resultat.montantHT,
      consommeForfait: resultat.consommeForfait,
    });
  } catch (erreur) {
    // Les refus d'acceptation sont des situations normales — un autre pro a été plus rapide,
    // la demande est complète — pas des pannes. Le message de la règle est le bon message.
    return NextResponse.json(
      { erreur: erreur instanceof Error ? erreur.message : 'Acceptation impossible.' },
      { status: 409 },
    );
  }
}
