import { NextResponse } from 'next/server';
import { z } from 'zod';
import { creeUnClient, modifieUnClient } from '@/lib/clients-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * Le carnet de clients d'un professionnel.
 *
 * `POST` crée, `PATCH` modifie. Aucune suppression : un client porte des factures émises, et
 * l'effacer romprait le lien d'une pièce qui fait foi.
 *
 * Le schéma est `.strict()` : une clé inconnue est refusée plutôt que retirée en silence.
 */

export const dynamic = 'force-dynamic';

const Client = z
  .object({
    nom: z.string().max(140),
    email: z.string().max(160),
    telephone: z.string().max(30),
    adresse: z.string().max(200),
    codePostal: z.string().max(10),
    ville: z.string().max(100),
    professionnel: z.boolean(),
    siren: z.string().max(20),
  })
  .strict();

const Modification = Client.extend({ id: z.string().min(1).max(40) }).strict();

export async function POST(requete: Request): Promise<NextResponse> {
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

  const analyse = Client.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Saisie incomplète.' }, { status: 400 });
  }

  const resultat = await creeUnClient(pro.entrepriseId, analyse.data);
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  return NextResponse.json({ id: resultat.id });
}

export async function PATCH(requete: Request): Promise<NextResponse> {
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

  const analyse = Modification.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Saisie incomplète.' }, { status: 400 });
  }
  const { id, ...saisie } = analyse.data;

  const resultat = await modifieUnClient(pro.entrepriseId, id, saisie);
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  return NextResponse.json({ id: resultat.id });
}
