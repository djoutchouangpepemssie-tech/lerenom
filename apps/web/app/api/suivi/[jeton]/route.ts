import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lerenom/db';
import { consommeLien, resoudLien } from '@lerenom/liens';

/**
 * Les actions qu'un client peut faire depuis son lien de suivi.
 *
 * Une seule pour l'instant : annuler sa demande. Elle est gratuite et sans justification — le
 * motif est demandé, jamais exigé.
 *
 * L'annulation ne touche pas aux professionnels qui ont **déjà accepté** : ils ont été
 * facturés, ils ont les coordonnées, et faire disparaître la demande de leur tableau de bord
 * reviendrait à leur reprendre ce qu'ils ont payé. Les propositions encore en attente, elles,
 * sont retirées : les laisser serait envoyer des pros chez quelqu'un qui n'attend plus personne.
 */

export const dynamic = 'force-dynamic';

const Action = z.object({
  action: z.literal('annuler'),
  motif: z.string().max(400).optional(),
});

/** Les statuts depuis lesquels une annulation a encore un sens. */
const ANNULABLES = ['brouillon', 'en_distribution', 'en_attente_de_relance', 'en_pause'];

export async function POST(
  requete: Request,
  { params }: { readonly params: Promise<{ readonly jeton: string }> },
): Promise<NextResponse> {
  const { jeton } = await params;

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

  const resolution = await resoudLien(jeton);
  if (resolution.issue !== 'valide') {
    return NextResponse.json(
      { erreur: 'Ce lien n’est plus valide.', etat: resolution.issue },
      { status: 410 },
    );
  }

  if (resolution.lien.action !== 'voir_pros') {
    return NextResponse.json({ erreur: 'Ce lien ne permet pas cette action.' }, { status: 403 });
  }

  const demande = await prisma.demande.findUnique({
    where: { id: resolution.lien.demandeId },
    select: { id: true, statut: true, annuleeLe: true, reference: true },
  });

  if (demande === null) {
    return NextResponse.json({ erreur: 'Cette demande n’existe plus.' }, { status: 404 });
  }

  if (demande.annuleeLe !== null) {
    // Annuler deux fois n'est pas une erreur du client : c'est un double clic, ou un retour
    // en arrière. On répond comme si c'était la première fois.
    return NextResponse.json({ annuleeLe: demande.annuleeLe.toISOString(), dejaAnnulee: true });
  }

  if (!ANNULABLES.includes(demande.statut)) {
    return NextResponse.json(
      { erreur: 'Cette demande est déjà close : il n’y a plus rien à annuler.' },
      { status: 409 },
    );
  }

  const annuleeLe = new Date();

  await prisma.$transaction([
    prisma.demande.update({
      where: { id: demande.id },
      data: {
        statut: 'annulee',
        annuleeLe,
        clotureeLe: annuleeLe,
        motifAnnulation: analyse.data.motif ?? null,
      },
    }),
    // Les propositions en attente sont retirées, pas refusées : le pro n'a rien refusé, et
    // rien ne doit lui être compté.
    prisma.distribution.updateMany({
      where: { demandeId: demande.id, statut: { in: ['envoyee', 'ouverte'] } },
      data: { statut: 'retiree', repondueLe: annuleeLe },
    }),
  ]);

  await consommeLien(resolution.lien.id, requete.headers.get('x-forwarded-for') ?? undefined);

  return NextResponse.json({ annuleeLe: annuleeLe.toISOString() });
}
