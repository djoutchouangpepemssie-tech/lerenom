import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { assembleFacturx } from '@/lib/facture-pdf';
import { facturxDeLaFacture } from '@/lib/facturx-facture';
import { factureAImprimer } from '@/lib/document-a-imprimer';
import { NavigateurAbsent, rendEnPdf } from '@/lib/rendu-pdf';
import { proConnecte } from '@/lib/session-pro';

/**
 * La facture complète : un PDF lisible, avec son XML Factur-X dedans.
 *
 * C'est le fichier que le professionnel envoie à son client, et le seul qui soit une facture
 * électronique au sens de la norme. Le XML téléchargeable séparément reste disponible — un
 * comptable peut vouloir la pièce seule — mais c'est celui-ci qui fait foi.
 *
 * Le rendu demande un navigateur sur le serveur, et il n'y en a pas en production
 * aujourd'hui. Dans ce cas la route le dit en français, avec la marche à suivre, plutôt que
 * de renvoyer une erreur technique : le professionnel garde l'impression depuis son
 * navigateur, qui fonctionne.
 */

export const dynamic = 'force-dynamic';
/** Un rendu de navigateur dépasse largement le délai par défaut d'une route. */
export const maxDuration = 60;

export async function GET(
  _requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  const { id } = await params;
  const [document, xml] = await Promise.all([
    factureAImprimer(pro.entrepriseId, id),
    facturxDeLaFacture(pro.entrepriseId, id),
  ]);

  if (document === null || xml === null) {
    return NextResponse.json(
      { erreur: 'Cette facture n’existe pas, ou elle n’est pas encore émise.' },
      { status: 404 },
    );
  }
  // Une facture sans numéro n'est pas une facture : la règle BR-02 d'EN 16931 l'exige, et
  // l'article L441-9 du code de commerce avant elle. Produire le fichier quand même donnerait
  // une pièce que le destinataire ne pourra pas comptabiliser.
  if (document.numero === null) {
    return NextResponse.json(
      {
        erreur: 'Cette facture n’a pas de numéro : elle ne peut pas être émise au format Factur-X.',
      },
      { status: 409 },
    );
  }

  // L'adresse est reconstruite depuis l'en-tête de la requête : le navigateur serveur appelle
  // le site par la même porte que les visiteurs, et une adresse écrite en dur se tromperait
  // dès le premier changement de domaine.
  const entetes = await headers();
  const hote = entetes.get('host');
  if (hote === null) {
    return NextResponse.json({ erreur: 'Requête sans hôte.' }, { status: 400 });
  }
  const protocole = entetes.get('x-forwarded-proto') ?? 'http';
  const adresse = `${protocole}://${hote}/document/facture/${id}`;

  const boite = await cookies();
  const session = boite.getAll().map((cookie) => ({
    nom: cookie.name,
    valeur: cookie.value,
    domaine: hote.split(':')[0] ?? 'localhost',
  }));

  let rendu: Uint8Array;
  try {
    rendu = await rendEnPdf(adresse, session);
  } catch (erreur) {
    if (erreur instanceof NavigateurAbsent) {
      return NextResponse.json(
        {
          erreur:
            'La génération du PDF n’est pas encore disponible sur ce serveur. En attendant, ouvrez la facture et utilisez l’impression de votre navigateur, puis téléchargez le XML Factur-X à part.',
        },
        { status: 503 },
      );
    }
    throw erreur;
  }

  const octets = await assembleFacturx({
    pdf: rendu,
    xml,
    numero: document.numero,
    emetteur: document.emetteur.nom,
    emiseLe: document.emiseLe ?? new Date(),
  });

  return new NextResponse(Buffer.from(octets), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="facture-${document.numero}.pdf"`,
      // Un document comptable ne se met pas en cache : il porte un numéro et une date.
      'cache-control': 'no-store',
    },
  });
}
