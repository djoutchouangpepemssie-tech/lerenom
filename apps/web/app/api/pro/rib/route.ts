import { NextResponse } from 'next/server';
import { saisitRib } from '@/lib/rib-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * La saisie d'un compte bancaire.
 *
 * Elle n'active rien : elle enregistre le compte et envoie un code au mobile déjà connu du
 * professionnel. Tant que ce code n'est pas saisi, l'ancien compte reste celui des factures.
 */

export const dynamic = 'force-dynamic';

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}

export async function POST(requete: Request): Promise<NextResponse> {
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

  const resultat = await saisitRib(pro.entrepriseId, {
    titulaire: texte(corps['titulaire']),
    iban: texte(corps['iban']),
    bic: texte(corps['bic']),
    banque: texte(corps['banque']),
  });

  if (!resultat.ok) {
    return NextResponse.json({ problemes: resultat.problemes }, { status: 422 });
  }

  return NextResponse.json({ ribId: resultat.ribId, mobileMasque: resultat.mobileMasque });
}
