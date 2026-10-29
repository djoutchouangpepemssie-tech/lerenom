import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditeurDevis } from '@/composants/EditeurDevis';
import { devisDuPro } from '@/lib/devis-pro';
import { proConnecte } from '@/lib/session-pro';

/** Un devis : ses lignes, ses conditions, ses mentions obligatoires. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Devis',
  robots: { index: false, follow: false },
};

export default async function PageUnDevis({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const pro = await proConnecte();
  if (pro === null) return null;

  const { id } = await params;
  const devis = await devisDuPro(pro.entrepriseId, id);
  // Un identifiant deviné ne donne rien : la recherche est faite dans l'entreprise de la
  // session, et l'absence se traite comme une page qui n'existe pas.
  if (devis === null) notFound();

  return (
    <>
      <Link
        href="/pro/espace/devis"
        className="text-encre-55 hover:text-encre text-sm font-semibold transition-colors"
      >
        ← Tous mes devis
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">{devis.numero ?? 'Nouveau devis'}</h1>
        <Link
          href={`/document/devis/${id}`}
          className="text-encre hover:text-or-fonce text-sm font-semibold underline decoration-[1.5px] underline-offset-4 transition-colors"
        >
          Voir le document imprimable
        </Link>
      </div>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        {devis.modifiable
          ? 'Les mentions obligatoires sont suivies à droite : tant qu’il en manque une, l’envoi reste fermé.'
          : 'Ce devis a été remis à votre client. Il se consulte, il ne se modifie plus.'}
      </p>

      <div className="mt-7">
        <EditeurDevis devis={devis} />
      </div>
    </>
  );
}
