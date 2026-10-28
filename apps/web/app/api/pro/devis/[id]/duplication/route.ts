import { NextResponse } from 'next/server';
import { dupliqueDevis } from '@/lib/devis-pro';
import { proConnecte } from '@/lib/session-pro';

/** La duplication d'un devis : la façon prévue d'en corriger un déjà remis au client. */

export const dynamic = 'force-dynamic';

export async function POST(
  _requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  const { id } = await params;
  const resultat = await dupliqueDevis(pro.entrepriseId, id);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  return NextResponse.json({ id: resultat.id }, { status: 201 });
}
