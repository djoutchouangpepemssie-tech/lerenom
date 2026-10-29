import { NextResponse } from 'next/server';
import { consommeLien, resoudLien } from '@lerenom/liens';
import { repondAuRendezVous } from '@/lib/rendez-vous-client';

/**
 * La réponse d'un client à une proposition de rendez-vous.
 *
 * Le lien est consommé : accepter ou décliner ne se refait pas, et un lien qui traîne dans
 * une boîte mail ne doit pas pouvoir réengager son destinataire des semaines plus tard.
 */

export const dynamic = 'force-dynamic';

export async function POST(
  requete: Request,
  { params }: { readonly params: Promise<{ readonly jeton: string }> },
): Promise<NextResponse> {
  const { jeton } = await params;
  const resolution = await resoudLien(jeton);
  if (resolution.issue !== 'valide') {
    return NextResponse.json({ erreur: 'Ce lien n’est plus actif.' }, { status: 404 });
  }
  const { lien } = resolution;
  if (lien.action !== 'choisir_creneau' || lien.cibleId === null) {
    return NextResponse.json({ erreur: 'Ce lien n’ouvre pas un rendez-vous.' }, { status: 404 });
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }
  const accepte =
    typeof corps === 'object' &&
    corps !== null &&
    (corps as { accepte?: unknown }).accepte === true;

  const resultat = await repondAuRendezVous(lien.cibleId, accepte);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  await consommeLien(lien.id);
  return NextResponse.json({ ok: true, accepte: resultat.accepte });
}
