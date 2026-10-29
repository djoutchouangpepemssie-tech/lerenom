import { NextResponse } from 'next/server';
import { z } from 'zod';
import { quitteLaListe, rejoindLaListe } from '@/lib/liste-attente-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * S'inscrire sur la liste d'attente d'une place, ou la quitter.
 *
 * Rien n'est facturé et rien n'est engagé : la place qui se libère n'est pas attribuée
 * d'office, le premier de la liste est prévenu et décide. C'est ce qui permet d'ouvrir cette
 * route avant que l'encaissement existe.
 *
 * Le schéma est `.strict()` : une clé inconnue est refusée plutôt que retirée en silence.
 */

export const dynamic = 'force-dynamic';

const Inscription = z
  .object({
    action: z.enum(['rejoindre', 'quitter']),
    metierId: z.string().min(1).max(40),
    communeId: z.string().min(1).max(20),
    // Seules les deux formules qui achètent un rang. `gratuit` et `essentiel` n'occupent
    // aucune place : les accepter ici créerait une attente sans objet.
    formule: z.enum(['premium', 'exclusif']),
  })
  .strict();

export async function POST(requete: Request): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Inscription.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Zone ou formule manquante.' }, { status: 400 });
  }
  const { action, metierId, communeId, formule } = analyse.data;

  const resultat =
    action === 'rejoindre'
      ? await rejoindLaListe(pro.entrepriseId, metierId, communeId, formule)
      : await quitteLaListe(pro.entrepriseId, metierId, communeId, formule);

  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    ...(resultat.rang === undefined ? {} : { rang: resultat.rang }),
  });
}
