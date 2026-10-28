import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RAYON_MAXIMUM_KM, RAYON_MINIMUM_KM, enregistreAgences } from '@/lib/agences-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * Les agences d'un professionnel.
 *
 * La liste complète est envoyée d'un coup, et non agence par agence : exactement une agence
 * est principale, et traiter cette contrainte modification par modification laisserait
 * forcément passer un état où il y en a zéro ou deux.
 */

export const dynamic = 'force-dynamic';

const Agence = z.object({
  id: z.string().min(1).max(40).optional(),
  nom: z.string().max(120),
  adresse: z.string().max(200),
  codePostal: z.string().max(10),
  communeId: z.string().min(1).max(12),
  rayonKm: z.number().min(RAYON_MINIMUM_KM).max(RAYON_MAXIMUM_KM),
  contactNom: z.string().max(120),
  contactTelephone: z.string().max(30),
  contactEmail: z.string().max(320),
  notifierParSms: z.boolean(),
  notifierParEmail: z.boolean(),
  principale: z.boolean(),
});

const Agences = z.object({ agences: z.array(Agence).min(1).max(20) });

export async function PUT(requete: Request): Promise<NextResponse> {
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

  const analyse = Agences.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Formulaire incomplet.' }, { status: 400 });
  }

  const resultat = await enregistreAgences(pro.entrepriseId, analyse.data.agences);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  return NextResponse.json({ nombre: resultat.nombre });
}
