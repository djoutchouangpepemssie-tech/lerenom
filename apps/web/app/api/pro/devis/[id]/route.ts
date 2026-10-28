import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TAUX_TVA, UNITES } from '@lerenom/core';
import { enregistreDevis } from '@/lib/devis-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * L'enregistrement d'un devis.
 *
 * Le devis visé est cherché **dans l'entreprise de la session** : un identifiant deviné ne
 * donne accès à rien.
 */

export const dynamic = 'force-dynamic';

const Ligne = z.object({
  type: z.enum(['prestation', 'section', 'texte']),
  designation: z.string().min(1).max(300),
  detail: z.string().max(500),
  unite: z.enum(UNITES).nullable(),
  quantite: z.number().min(0).max(100000).nullable(),
  prixUnitaireHT: z.number().min(0).max(10000000).nullable(),
  tauxTva: z
    .number()
    .refine((taux): taux is (typeof TAUX_TVA)[number] => TAUX_TVA.includes(taux as 5.5))
    .nullable(),
});

const Devis = z.object({
  clientId: z.string().min(1).max(40).nullable(),
  type: z.enum(['estimatif', 'definitif']),
  lignes: z.array(Ligne).max(200),
  remisePourcent: z.number().min(0).max(100),
  acomptePourcent: z.union([z.literal(0), z.literal(30), z.literal(40)]),
  validiteJours: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  fraisDeplacementTTC: z.number().min(0).max(100000).nullable(),
  devisPayant: z.boolean(),
  piecesRemplaceesGardees: z.boolean(),
  mentionRetractation: z.boolean(),
});

export async function PUT(
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
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Devis.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Formulaire incomplet.' }, { status: 400 });
  }

  const { id } = await params;
  const resultat = await enregistreDevis(pro.entrepriseId, id, analyse.data);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  return NextResponse.json({ totaux: resultat.totaux, conformite: resultat.conformite });
}
