import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enregistreParametresDocuments } from '@/lib/parametres-documents';
import { proConnecte } from '@/lib/session-pro';

/**
 * Les réglages des documents d'un professionnel.
 *
 * L'entreprise visée est celle de la session, jamais celle que le corps désignerait.
 *
 * Aucun champ n'est requis : un professionnel doit pouvoir enregistrer ce qu'il sait et revenir
 * pour le reste. Les deux contraintes qui restent ont une raison. Un taux de pénalités **nul**
 * est refusé — on ne renonce pas d'avance aux pénalités de retard, et `null` existe déjà pour
 * dire « taux légal ». Un délai de paiement est borné à quatre-vingt-dix jours, le plafond que
 * le code de commerce autorise par convention entre professionnels.
 */

export const dynamic = 'force-dynamic';

const texteOuNull = (max: number) => z.string().trim().min(1).max(max).nullable();

const Parametres = z.object({
  formeJuridique: texteOuNull(60),
  capitalSocialEuros: z.number().min(0).max(1_000_000_000).nullable(),
  immatriculationRegistre: z.enum(['rcs', 'rm']).nullable(),
  immatriculationLieu: texteOuNull(80),
  numeroTva: texteOuNull(20),
  franchiseTva: z.boolean(),
  assuranceAssureur: texteOuNull(120),
  assuranceContrat: texteOuNull(60),
  assuranceCouverture: texteOuNull(160),
  mediateurNom: texteOuNull(120),
  mediateurUrl: texteOuNull(200),
  penalitesTauxAnnuel: z.number().gt(0).max(100).nullable(),
  delaiPaiementJours: z.number().int().min(0).max(90),
  escompte: texteOuNull(400),
  conditionsGenerales: texteOuNull(4000),
  piedDePage: texteOuNull(400),
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

  const analyse = Parametres.safeParse(corps);
  if (!analyse.success) {
    const premier = analyse.error.issues[0];
    return NextResponse.json(
      {
        erreur:
          premier?.path[0] === 'penalitesTauxAnnuel'
            ? 'Un taux de pénalités doit être supérieur à zéro. Laissez le champ vide pour appliquer le taux légal.'
            : 'Une des valeurs saisies n’est pas acceptable.',
      },
      { status: 400 },
    );
  }

  await enregistreParametresDocuments(pro.entrepriseId, analyse.data);
  return NextResponse.json({ ok: true });
}
