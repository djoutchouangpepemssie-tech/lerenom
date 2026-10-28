import { NextResponse } from 'next/server';
import { emetFacture } from '@/lib/factures-pro';
import { proConnecte } from '@/lib/session-pro';

/** L'émission d'une facture : numéro attribué, RIB figé, document immuable. */

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
  const resultat = await emetFacture(pro.entrepriseId, id);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  return NextResponse.json({ numero: resultat.numero });
}
