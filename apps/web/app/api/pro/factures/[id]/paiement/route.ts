import { NextResponse } from 'next/server';
import { z } from 'zod';
import { annuleLePaiement, marqueFacturePayee } from '@/lib/factures-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * L'encaissement d'une facture.
 *
 * `POST` enregistre le paiement, `DELETE` le défait. Rien n'est effacé dans les deux cas :
 * seuls le statut et la date de paiement bougent, et le déclencheur de la base veille sur
 * les montants, le numéro et le RIB — une facture émise ne se réécrit pas.
 *
 * Le schéma est `.strict()` : une clé inconnue est refusée plutôt que retirée en silence.
 */

export const dynamic = 'force-dynamic';

const Paiement = z
  .object({
    // Une date au format `AAAA-MM-JJ` : le professionnel enregistre souvent un virement reçu
    // l'avant-veille, et dater tout au jour de la saisie fausserait son suivi de trésorerie.
    payeeLe: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

export async function POST(
  requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  // Un corps vide est accepté : « marquer payée aujourd'hui » n'a rien à transmettre, et
  // exiger un objet vide du client serait une cérémonie sans objet.
  let corps: unknown;
  try {
    const texte = await requete.text();
    corps = texte === '' ? {} : JSON.parse(texte);
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const analyse = Paiement.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json({ erreur: 'Date de paiement invalide.' }, { status: 400 });
  }

  const { id } = await params;
  // Minuit UTC : la date saisie désigne un jour, pas un instant. L'interpréter à l'heure du
  // serveur ferait basculer un paiement du 31 au 1er selon l'endroit d'où l'on regarde.
  const payeeLe =
    analyse.data.payeeLe === undefined
      ? new Date()
      : new Date(`${analyse.data.payeeLe}T00:00:00.000Z`);

  const resultat = await marqueFacturePayee(pro.entrepriseId, id, payeeLe);
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _requete: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
  const pro = await proConnecte();
  if (pro === null) {
    return NextResponse.json({ erreur: 'Votre session a expiré.' }, { status: 401 });
  }

  const { id } = await params;
  const resultat = await annuleLePaiement(pro.entrepriseId, id);
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.message }, { status: 422 });
  return NextResponse.json({ ok: true });
}
