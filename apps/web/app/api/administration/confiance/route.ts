import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publieLAvis, refuseLAvis } from '@/lib/administration-confiance';
import { adminConnecte, inscritAuJournal } from '@/lib/session-admin';

/**
 * La modération des avis.
 *
 * Publier un avis, c'est afficher le jugement d'un client sur le travail de quelqu'un et faire
 * bouger la note qui le classe. Le refuser, c'est écarter la parole d'un client. Les deux
 * passent au journal d'audit, et le refus exige un motif — le DSA prévoit que l'auteur puisse
 * demander des comptes, et « on ne sait plus » n'est pas une réponse.
 *
 * Le schéma est `.strict()` : une clé inconnue est refusée plutôt que retirée en silence.
 */

export const dynamic = 'force-dynamic';

const ROLES_AUTORISES = new Set(['administrateur', 'moderateur']);

const Moderation = z
  .object({
    avisId: z.string().min(1).max(40),
    action: z.enum(['publier', 'refuser']),
    motif: z.string().max(500).optional(),
  })
  .strict();

export async function PATCH(requete: Request): Promise<NextResponse> {
  const admin = await adminConnecte();
  if (admin === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }
  if (!ROLES_AUTORISES.has(admin.role)) {
    return NextResponse.json(
      { erreur: 'La modération des avis est réservée à l’administration et à la modération.' },
      { status: 403 },
    );
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Moderation.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Avis ou action manquant.' }, { status: 400 });
  }
  const { avisId, action, motif } = analyse.data;

  const resultat =
    action === 'publier'
      ? await publieLAvis(avisId, admin.adminId)
      : await refuseLAvis(avisId, admin.adminId, motif ?? '');

  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  await inscritAuJournal(admin.adminId, `avis.${action}`, 'avis', avisId, {
    avant: resultat.avant,
    apres: resultat.apres,
  });

  return NextResponse.json({ ok: true });
}
