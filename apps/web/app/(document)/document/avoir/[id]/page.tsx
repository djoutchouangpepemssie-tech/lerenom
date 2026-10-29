import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocumentImprimable } from '@/composants/DocumentImprimable';
import { BarreImpression } from '@/composants/BarreImpression';
import { avoirAImprimer } from '@/lib/document-a-imprimer';
import { proConnecte } from '@/lib/session-pro';

/**
 * Un avoir, prêt à imprimer.
 *
 * Il est toujours émis : il n'existe pas d'avoir en préparation. La barre ne porte donc jamais
 * de consigne à compléter, seulement un constat si la facture d'origine en manquait.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Avoir',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PageAvoirImprimable({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const pro = await proConnecte();
  if (pro === null) notFound();

  const { id } = await params;
  const document = await avoirAImprimer(pro.entrepriseId, id);
  if (document === null) notFound();

  return (
    <>
      <BarreImpression retour="/pro/espace/factures" manquants={[]} emise />
      <DocumentImprimable document={document} />
    </>
  );
}
