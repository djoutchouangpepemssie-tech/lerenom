import { NextResponse } from 'next/server';
import { poseLaPlage, proposeAuClient } from '@/lib/agenda-pro';
import { proConnecte } from '@/lib/session-pro';
import { litLeCorps, litSaisiePlage } from '@/lib/saisie-plage';

/** Poser une plage dans l'agenda : intervention, visite, indisponibilité ou proposition. */

export const dynamic = 'force-dynamic';

export async function POST(requete: Request): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  const corps = await litLeCorps(requete);
  if (corps === null) {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }
  const clientBrut = corps['clientId'];
  const clientId = typeof clientBrut === 'string' && clientBrut !== '' ? clientBrut : null;

  const saisie = litSaisiePlage(corps);
  if (saisie === null) {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  // Un créneau proposé s'adresse à quelqu'un : sans client, la proposition ne partirait
  // nulle part et bloquerait l'agenda pour rien.
  if (saisie.type === 'propose') {
    if (clientId === null) {
      return NextResponse.json(
        { problemes: [{ champ: 'client', message: 'Choisissez à qui proposer ce créneau.' }] },
        { status: 422 },
      );
    }
    const propose = await proposeAuClient(pro.entrepriseId, saisie, clientId);
    if (!propose.ok) {
      return NextResponse.json({ problemes: propose.problemes }, { status: 422 });
    }
    return NextResponse.json({ id: propose.id, canaux: propose.canaux });
  }

  const resultat = await poseLaPlage(pro.entrepriseId, saisie);
  if (!resultat.ok) {
    return NextResponse.json({ problemes: resultat.problemes }, { status: 422 });
  }
  return NextResponse.json({ id: resultat.id });
}
