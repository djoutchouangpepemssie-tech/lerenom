import { NextResponse } from 'next/server';
import { consommeLien, resoudLien } from '@lerenom/liens';
import { accepteDevisParLeClient } from '@/lib/devis-client';

/**
 * L'acceptation d'un devis par le client, depuis son lien.
 *
 * Le lien est consommé : accepter ne se refait pas, et un lien qui traîne dans une boîte mail
 * ne doit pas pouvoir réengager son destinataire.
 *
 * Les refus ne disent jamais si un devis existe : un jeton au hasard et un jeton périmé
 * reçoivent la même réponse.
 */

export const dynamic = 'force-dynamic';

export async function POST(
  _requete: Request,
  { params }: { readonly params: Promise<{ readonly jeton: string }> },
): Promise<NextResponse> {
  const { jeton } = await params;
  const resolution = await resoudLien(jeton);

  if (resolution.issue !== 'valide') {
    return NextResponse.json({ erreur: 'Ce lien n’est plus actif.' }, { status: 404 });
  }
  const { lien } = resolution;
  if (lien.action !== 'signer_devis' || lien.cibleId === null) {
    return NextResponse.json({ erreur: 'Ce lien n’ouvre pas un devis.' }, { status: 404 });
  }

  const resultat = await accepteDevisParLeClient(lien.cibleId);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  await consommeLien(lien.id);
  return NextResponse.json({ ok: true, factures: resultat.factures });
}
