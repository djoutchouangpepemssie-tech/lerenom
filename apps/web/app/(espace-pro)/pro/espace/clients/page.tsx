import type { Metadata } from 'next';
import { CarnetClients } from '@/composants/CarnetClients';
import { clientsDuPro } from '@/lib/clients-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * « Mes clients ».
 *
 * Le carnet manquait entièrement : le code vérifiait qu'un client appartient bien à
 * l'entreprise et en listait pour un menu, mais rien n'en créait jamais. Un devis partait donc
 * sans client, la facture qui en naît aussi — et une facture sans destinataire identifié n'est
 * pas une facture.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes clients',
  robots: { index: false, follow: false },
};

export default async function PageClients() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const clients = await clientsDuPro(pro.entrepriseId);

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mes clients</h1>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        Les personnes et les entreprises pour qui vous travaillez. Un devis s’adresse à l’une
        d’elles, et c’est ce qui permet d’en tirer une facture : une facture sans destinataire
        identifié n’en est pas une.
      </p>

      <CarnetClients clients={clients} />
    </>
  );
}
