import { NextResponse } from 'next/server';
import { emetAvoir } from '@/lib/avoirs-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * L'émission d'un avoir sur une facture.
 *
 * La saisie vient du navigateur : elle est donc suspecte jusqu'à preuve du contraire. Le
 * montant est lu comme un nombre et rien d'autre — une chaîne, un tableau ou `Infinity`
 * ressortent en problème de saisie, jamais en exception à cinq cents.
 */

export const dynamic = 'force-dynamic';

function nombreOuNaN(valeur: unknown): number {
  return typeof valeur === 'number' ? valeur : Number.NaN;
}

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}

export async function POST(
  requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  let saisie: unknown;
  try {
    saisie = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }
  const corps =
    typeof saisie === 'object' && saisie !== null ? (saisie as Record<string, unknown>) : {};

  const { id } = await params;
  const resultat = await emetAvoir(pro.entrepriseId, id, {
    montantTTC: nombreOuNaN(corps['montantTTC']),
    motif: texte(corps['motif']),
  });

  if (!resultat.ok) {
    return NextResponse.json({ problemes: resultat.problemes }, { status: 422 });
  }

  return NextResponse.json({ numero: resultat.numero, factureAnnulee: resultat.factureAnnulee });
}
