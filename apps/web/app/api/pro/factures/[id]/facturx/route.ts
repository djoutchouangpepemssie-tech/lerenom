import { NextResponse } from 'next/server';
import { NOM_FICHIER_FACTURX } from '@lerenom/core';
import { facturxDeLaFacture } from '@/lib/facturx-facture';
import { proConnecte } from '@/lib/session-pro';

/**
 * Le XML Factur-X d'une facture émise.
 *
 * Il sera un jour incorporé au PDF — c'est tout l'objet de Factur-X. En attendant la
 * génération serveur du PDF (voir `QUESTIONS.md` §Q35), il se télécharge seul : un
 * professionnel peut le remettre à son comptable, et c'est aussi la seule façon de vérifier
 * de bout en bout que le fichier est juste.
 *
 * Le nom du fichier n'est pas libre : `factur-x.xml` est imposé par la norme, et un
 * destinataire qui en cherche un autre ne trouvera rien.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  _requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  const { id } = await params;
  const xml = await facturxDeLaFacture(pro.entrepriseId, id);
  if (xml === null) {
    return NextResponse.json(
      { erreur: 'Cette facture n’existe pas, ou elle n’est pas encore émise.' },
      { status: 404 },
    );
  }

  return new NextResponse(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'content-disposition': `attachment; filename="${NOM_FICHIER_FACTURX}"`,
      // Un document comptable ne se met pas en cache : il porte un numéro et une date.
      'cache-control': 'no-store',
    },
  });
}
