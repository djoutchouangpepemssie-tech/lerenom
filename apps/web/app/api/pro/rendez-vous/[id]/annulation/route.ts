import { NextResponse } from 'next/server';
import { annuleLeRendezVous } from '@/lib/agenda-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * L'annulation d'un rendez-vous par le professionnel.
 *
 * C'est la sortie qui manquait : un rendez-vous confirmé ne se déplace pas en silence, mais
 * il fallait bien pouvoir s'en défaire. Elle libère la plage **et** prévient le client.
 */

export const dynamic = 'force-dynamic';

export async function POST(
  requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    corps = {};
  }
  const brut =
    typeof corps === 'object' && corps !== null ? (corps as { motif?: unknown }).motif : undefined;
  const motif = typeof brut === 'string' ? brut : '';

  const { id } = await params;
  const resultat = await annuleLeRendezVous(pro.entrepriseId, id, motif);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
