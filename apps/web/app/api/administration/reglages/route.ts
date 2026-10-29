import { NextResponse } from 'next/server';
import { z } from 'zod';
import { changeLeReglage } from '@/lib/administration-reglages';
import { adminConnecte, inscritAuJournal } from '@/lib/session-admin';

/**
 * Le changement d'un réglage d'exploitation.
 *
 * Réservé au rôle `administrateur`, et à lui seul. Un délai de cascade ou un nombre de
 * professionnels par demande touche les revenus de toutes les entreprises inscrites : ce n'est
 * pas une décision de modération ni de support.
 *
 * Le schéma est `.strict()` : une clé inconnue est refusée plutôt que retirée en silence.
 */

export const dynamic = 'force-dynamic';

const Changement = z
  .object({
    cle: z.string().min(1).max(80),
    valeur: z.number().finite(),
    motif: z.string().min(1).max(500),
  })
  .strict();

export async function PATCH(requete: Request): Promise<NextResponse> {
  const admin = await adminConnecte();
  if (admin === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }
  if (admin.role !== 'administrateur') {
    return NextResponse.json(
      { erreur: 'Les réglages d’exploitation sont réservés à l’administration.' },
      { status: 403 },
    );
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Changement.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Réglage, valeur ou motif manquant.' }, { status: 400 });
  }
  const { cle, valeur, motif } = analyse.data;

  const resultat = await changeLeReglage(cle, valeur, motif, admin.nom);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  await inscritAuJournal(admin.adminId, 'reglage.changer', 'parametre', cle, {
    avant: resultat.avant,
    apres: resultat.apres,
  });

  return NextResponse.json({ ok: true });
}
