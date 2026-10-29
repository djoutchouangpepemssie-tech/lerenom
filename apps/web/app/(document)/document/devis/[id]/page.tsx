import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocumentImprimable } from '@/composants/DocumentImprimable';
import { BarreImpression } from '@/composants/BarreImpression';
import { devisAImprimer } from '@/lib/document-a-imprimer';
import { proConnecte } from '@/lib/session-pro';

/** Un devis, prêt à imprimer, vu par le professionnel qui l'établit. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Devis',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PageDevisImprimable({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const pro = await proConnecte();
  if (pro === null) notFound();

  const { id } = await params;
  const document = await devisAImprimer(pro.entrepriseId, id);
  if (document === null) notFound();

  return (
    <>
      <BarreImpression
        retour={`/pro/espace/devis/${id}`}
        manquants={document.conformite.manquants}
        emise={document.emiseLe !== null}
      />
      <DocumentImprimable document={document} />
    </>
  );
}
