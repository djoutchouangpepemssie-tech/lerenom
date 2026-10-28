import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FORMULES } from '@lerenom/core';
import { enregistreInscription } from '@/lib/inscription';
import { ouvreSession } from '@/lib/session-pro';

/**
 * L'inscription d'un professionnel.
 *
 * La route ne valide que la *forme* du corps reçu — qu'il y ait bien des chaînes là où on
 * attend des chaînes. Le fond est jugé par `valideInscription`, dans `@lerenom/core`, avec les
 * mêmes règles que celles qui guident l'écran. Deux contrôles écrits séparément finiraient par
 * diverger, et le professionnel verrait un formulaire vert refusé par le serveur.
 *
 * Elle ouvre la session dans le même mouvement : un professionnel qui vient de créer son
 * compte ne doit pas avoir à se reconnecter pour voir ce qu'il a créé.
 */

export const dynamic = 'force-dynamic';

const Inscription = z.object({
  siret: z.string().min(1).max(30),
  nomEntreprise: z.string().min(1).max(200),
  email: z.string().min(1).max(320),
  telephone: z.string().min(1).max(30),
  motDePasse: z.string().min(1).max(200),
  motDePasseConfirme: z.string().min(1).max(200),
  metiers: z.array(z.string().min(1).max(120)).min(1).max(20),
  metierPrincipal: z.string().min(1).max(120).nullable(),
  villes: z.array(z.string().min(1).max(12)).min(1).max(1500),
  communeSiege: z.string().min(1).max(12).nullable(),
  description: z.string().max(5000),
  formule: z.enum(FORMULES),
  annuel: z.boolean(),
});

export async function POST(requete: Request): Promise<NextResponse> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Inscription.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Formulaire incomplet.' }, { status: 400 });
  }

  const resultat = await enregistreInscription(analyse.data);

  if (!resultat.ok) {
    if (resultat.genre === 'saisie') {
      return NextResponse.json({ problemes: resultat.problemes }, { status: 422 });
    }
    // Une fiche déjà revendiquée et une adresse déjà utilisée sont des conflits, pas des
    // erreurs de saisie : 409 le dit, et l'écran sait alors proposer la connexion.
    const statut = resultat.genre === 'reference-inconnue' ? 422 : 409;
    return NextResponse.json(
      { erreur: resultat.message, genre: resultat.genre },
      { status: statut },
    );
  }

  await ouvreSession(resultat.utilisateurId);

  return NextResponse.json(
    {
      slug: resultat.slug,
      revendiquee: resultat.revendiquee,
      villesConservees: resultat.villesConservees,
      villesRetirees: resultat.villesRetirees,
      paiementRequis: resultat.paiementRequis,
    },
    { status: 201 },
  );
}
