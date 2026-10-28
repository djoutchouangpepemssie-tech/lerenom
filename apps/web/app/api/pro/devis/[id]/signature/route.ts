import { NextResponse } from 'next/server';
import { signeDevisEtPrepareFactures } from '@/lib/factures-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * La signature d'un devis, déclarée par le professionnel.
 *
 * Tant qu'aucun lien client n'existe, c'est lui qui sait : le client a signé sur papier, ou
 * dit oui au téléphone. La signature en ligne, le jour venu, appellera ce même chemin.
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
  const resultat = await signeDevisEtPrepareFactures(pro.entrepriseId, id);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  return NextResponse.json({ factures: resultat.factures });
}
