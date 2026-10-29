import { NextResponse } from 'next/server';
import { z } from 'zod';
import { classeLaDemande } from '@/lib/administration-demandes';
import { adminConnecte, inscritAuJournal } from '@/lib/session-admin';

/**
 * Le classement manuel d'une demande.
 *
 * Une demande mal classée part aux mauvais professionnels, qui la refusent : un client déçu
 * et trois pros dérangés pour rien. C'est la seule écriture de ce module pour l'instant, et
 * elle passe au journal d'audit comme les autres — « qui a décidé que c'était de la
 * plomberie ? » doit avoir une réponse.
 *
 * Le schéma est `.strict()` : une clé inconnue est refusée plutôt que retirée en silence.
 */

export const dynamic = 'force-dynamic';

const ROLES_AUTORISES = new Set(['administrateur', 'support']);

const Classement = z
  .object({
    demandeId: z.string().min(1).max(40),
    metierId: z.string().min(1).max(40),
  })
  .strict();

export async function PATCH(requete: Request): Promise<NextResponse> {
  const admin = await adminConnecte();
  if (admin === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }
  if (!ROLES_AUTORISES.has(admin.role)) {
    return NextResponse.json(
      { erreur: 'Le classement des demandes est réservé à l’administration et au support.' },
      { status: 403 },
    );
  }

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Classement.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Demande ou métier manquant.' }, { status: 400 });
  }

  const resultat = await classeLaDemande(analyse.data.demandeId, analyse.data.metierId);
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.message }, { status: 404 });
  }

  await inscritAuJournal(admin.adminId, 'demande.classer', 'demande', analyse.data.demandeId, {
    avant: resultat.avant,
    apres: resultat.apres,
  });

  return NextResponse.json({ ok: true });
}
