import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agitSurLeProfessionnel } from '@/lib/administration-professionnels';
import { adminConnecte, inscritAuJournal } from '@/lib/session-admin';

/**
 * Vérifier, dévérifier, suspendre, réactiver une entreprise.
 *
 * Toutes ces écritures passent au journal d'audit, et pour une raison concrète : vérifier une
 * fiche, c'est autoriser quelqu'un à recevoir les coordonnées de clients. Suspendre, c'est
 * couper ses revenus. Dans six mois, « qui a vérifié cette entreprise, et quand ? » doit avoir
 * une réponse — y compris si la réponse est gênante.
 *
 * Le schéma est `.strict()` : une clé inconnue est refusée plutôt que retirée en silence. Sans
 * cela, un champ glissé dans le corps serait ignoré sans bruit, et le refus qu'on croit écrit
 * dans le commentaire ne serait écrit que là.
 */

export const dynamic = 'force-dynamic';

/**
 * La vérification est réservée à l'administration.
 *
 * Le support peut classer une demande — c'est du tri. Il ne décide pas qui entre dans
 * l'annuaire ni qui en sort : ce geste engage la plateforme devant les clients qu'il expose.
 */
const ROLES_AUTORISES = new Set(['administrateur']);

const Action = z
  .object({
    entrepriseId: z.string().min(1).max(40),
    action: z.enum(['verifier', 'retirer-verification', 'suspendre', 'reactiver']),
    motif: z.string().max(500).optional(),
  })
  .strict();

export async function PATCH(requete: Request): Promise<NextResponse> {
  const admin = await adminConnecte();
  if (admin === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }
  if (!ROLES_AUTORISES.has(admin.role)) {
    return NextResponse.json(
      { erreur: 'La vérification des entreprises est réservée à l’administration.' },
      { status: 403 },
    );
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Action.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Entreprise ou action manquante.' }, { status: 400 });
  }
  const { entrepriseId, action, motif } = analyse.data;

  const resultat = await agitSurLeProfessionnel(entrepriseId, action, motif ?? null);
  if (!resultat.ok) {
    // 422 plutôt que 404 : l'entreprise existe le plus souvent, c'est le geste qui est refusé
    // (fiche non revendiquée, motif de suspension absent). Un 404 ferait croire à une
    // disparition.
    return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  }

  await inscritAuJournal(admin.adminId, `entreprise.${action}`, 'entreprise', entrepriseId, {
    avant: resultat.avant,
    apres: resultat.apres,
  });

  return NextResponse.json({ ok: true });
}
