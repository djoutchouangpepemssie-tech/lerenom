import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enregistrePerimetre } from '@/lib/zones-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * Le périmètre d'un professionnel : ses métiers et ses villes.
 *
 * Comme pour la fiche, l'entreprise visée est celle de la session et jamais celle que le
 * corps de la requête désignerait.
 */

export const dynamic = 'force-dynamic';

const Perimetre = z.object({
  metiers: z.array(z.string().min(1).max(120)).min(1).max(69),
  metierPrincipal: z.string().min(1).max(120).nullable(),
  villes: z.array(z.string().min(1).max(12)).min(1).max(1500),
});

export async function PUT(requete: Request): Promise<NextResponse> {
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

  const analyse = Perimetre.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Formulaire incomplet.' }, { status: 400 });
  }

  const resultat = await enregistrePerimetre(pro.entrepriseId, analyse.data);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  return NextResponse.json({ nombreDePages: resultat.nombreDePages });
}
