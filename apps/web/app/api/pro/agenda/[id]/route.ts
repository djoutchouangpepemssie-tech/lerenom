import { NextResponse } from 'next/server';
import { deplaceLaPlage, retireLaPlage } from '@/lib/agenda-pro';
import { proConnecte } from '@/lib/session-pro';
import { litLeCorps, litSaisiePlage } from '@/lib/saisie-plage';

/** Déplacer ou retirer une plage de l'agenda. */

export const dynamic = 'force-dynamic';

export async function PUT(
  requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  const corps = await litLeCorps(requete);
  const saisie = corps === null ? null : litSaisiePlage(corps);
  if (saisie === null) {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const { id } = await params;
  const resultat = await deplaceLaPlage(pro.entrepriseId, id, saisie);
  if (!resultat.ok) {
    return NextResponse.json({ problemes: resultat.problemes }, { status: 422 });
  }
  return NextResponse.json({ id: resultat.id });
}

export async function DELETE(
  _requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  const { id } = await params;
  const resultat = await retireLaPlage(pro.entrepriseId, id);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
