import { NextResponse } from 'next/server';
import { creeDevis } from '@/lib/devis-pro';
import { proConnecte } from '@/lib/session-pro';

/** La création d'un brouillon de devis. Aucun numéro n'est attribué à ce stade. */

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  const id = await creeDevis(pro.entrepriseId);
  return NextResponse.json({ id }, { status: 201 });
}
