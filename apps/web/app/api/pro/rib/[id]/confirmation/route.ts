import { NextResponse } from 'next/server';
import { codeBienForme } from '@lerenom/core';
import { confirmeRib } from '@/lib/rib-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * La confirmation d'un changement de compte bancaire.
 *
 * C'est le moment où le nouveau compte devient celui des prochaines factures, et l'ancien un
 * compte remplacé — jamais supprimé, puisque des factures émises le désignent.
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

  let saisie: unknown;
  try {
    saisie = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }
  const corps =
    typeof saisie === 'object' && saisie !== null ? (saisie as Record<string, unknown>) : {};
  const code = typeof corps['code'] === 'string' ? corps['code'].trim() : '';

  // Une saisie mal formée ne consomme pas d'essai : la limite protège contre la force brute,
  // pas contre un doigt qui glisse sur le pavé numérique.
  if (!codeBienForme(code)) {
    return NextResponse.json({ erreur: 'Le code compte six chiffres.' }, { status: 422 });
  }

  const { id } = await params;
  const resultat = await confirmeRib(pro.entrepriseId, id, code);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message, issue: resultat.issue }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
