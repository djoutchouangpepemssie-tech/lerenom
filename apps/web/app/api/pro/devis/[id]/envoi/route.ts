import { NextResponse } from 'next/server';
import { envoieDevis } from '@/lib/devis-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * L'envoi d'un devis : il reçoit son numéro, devient immuable, et part chez le client.
 *
 * La réponse dit **par où** il est parti. Un envoi silencieux laisserait le professionnel
 * croire que son client a reçu quelque chose alors que celui-ci n'a peut-être ni courriel ni
 * mobile enregistré.
 */

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
  const resultat = await envoieDevis(pro.entrepriseId, id);
  if (!resultat.ok) {
    return NextResponse.json(
      {
        erreur: resultat.message,
        ...(resultat.manquants !== undefined ? { manquants: resultat.manquants } : {}),
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ numero: resultat.numero, canaux: resultat.canaux });
}
