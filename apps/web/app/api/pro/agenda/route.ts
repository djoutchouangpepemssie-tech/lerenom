import { NextResponse } from 'next/server';
import { poseLaPlage } from '@/lib/agenda-pro';
import { proConnecte } from '@/lib/session-pro';
import { litSaisiePlage } from './saisie';

/** Poser une plage dans l'agenda : intervention, visite, indisponibilité ou proposition. */

export const dynamic = 'force-dynamic';

export async function POST(requete: Request): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  const saisie = await litSaisiePlage(requete);
  if (saisie === null) {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const resultat = await poseLaPlage(pro.entrepriseId, saisie);
  if (!resultat.ok) {
    return NextResponse.json({ problemes: resultat.problemes }, { status: 422 });
  }
  return NextResponse.json({ id: resultat.id });
}
