import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocumentImprimable } from '@/composants/DocumentImprimable';
import { BarreImpression } from '@/composants/BarreImpression';
import { factureAImprimer } from '@/lib/document-a-imprimer';
import { proConnecte } from '@/lib/session-pro';

/**
 * Une facture, prête à imprimer ou à enregistrer en PDF.
 *
 * Réservée au professionnel qui l'a émise. Le client, lui, reçoit un lien signé : un
 * identifiant de facture deviné ne doit jamais ouvrir la facture de quelqu'un d'autre, et
 * `factureAImprimer` ne distingue pas « absente » de « à un autre » pour cette raison.
 *
 * `force-dynamic` : un document comptable ne se met pas en cache. Le RIB, l'échéance et les
 * mentions changent, et une facture servie depuis un cache serait une facture périmée avec
 * l'air d'être à jour.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Facture',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PageFactureImprimable({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const pro = await proConnecte();
  if (pro === null) notFound();

  const { id } = await params;
  const document = await factureAImprimer(pro.entrepriseId, id);
  if (document === null) notFound();

  return (
    <>
      <BarreImpression
        retour={`/pro/espace/factures/${id}`}
        manquants={document.conformite.manquants}
        emise={document.emiseLe !== null}
      />
      <DocumentImprimable document={document} />
    </>
  );
}
