import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ATOUTS_MAXIMUM } from '@lerenom/core';
import { enregistreFiche } from '@/lib/fiche-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * L'enregistrement de la fiche d'un professionnel.
 *
 * L'entreprise visée n'est **jamais** celle que le corps de la requête désigne : c'est celle de
 * la session. Accepter un identifiant d'entreprise ici permettrait à n'importe quel
 * professionnel connecté de réécrire la fiche d'un confrère.
 */

export const dynamic = 'force-dynamic';

const Creneau = z.object({
  debut: z.number().int().min(0).max(1440),
  fin: z.number().int().min(0).max(1440),
});
const Journee = z.array(Creneau).max(3);

const Fiche = z.object({
  description: z.string().max(5000),
  slogan: z.string().max(300),
  telephone: z.string().max(30),
  email: z.string().max(320),
  siteWeb: z.string().max(300),
  atouts: z.array(z.string().max(120)).max(ATOUTS_MAXIMUM * 2),
  decennaleNumero: z.string().max(80),
  decennaleAssureur: z.string().max(120),
  decennaleExpireLe: z.string().max(10),
  // Les créneaux sont des minutes depuis minuit : un entier par borne, trois plages par jour
  // au maximum. Au-delà, ce n'est plus un horaire d'ouverture mais un emploi du temps.
  horaires: z.object({
    lundi: Journee,
    mardi: Journee,
    mercredi: Journee,
    jeudi: Journee,
    vendredi: Journee,
    samedi: Journee,
    dimanche: Journee,
  }),
});

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

  const analyse = Fiche.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Formulaire incomplet.' }, { status: 400 });
  }

  const resultat = await enregistreFiche(pro.entrepriseId, analyse.data);
  if (!resultat.ok) {
    return NextResponse.json({ problemes: resultat.problemes }, { status: 422 });
  }

  return NextResponse.json({ completude: resultat.completude });
}
