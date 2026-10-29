import type { Metadata } from 'next';
import { FormulaireDocuments } from '@/composants/FormulaireDocuments';
import { parametresDocuments } from '@/lib/parametres-documents';
import { proConnecte } from '@/lib/session-pro';

/**
 * Les réglages des devis et des factures.
 *
 * L'écran existe pour une raison précise : une facture incomplète expose à une amende, et elle
 * ne se corrige plus une fois émise. Mieux vaut remplir ces champs une fois, à froid, que
 * découvrir ce qui manque au moment d'envoyer la facture d'un chantier terminé.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes documents',
  robots: { index: false, follow: false },
};

export default async function PageDocuments() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const parametres = await parametresDocuments(pro.entrepriseId);

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mes documents</h1>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        Les mentions que vos devis et vos factures doivent porter. Nous ne pouvons pas les deviner :
        elles ne figurent dans aucun registre public. Remplies une fois, elles s’impriment sur tous
        vos documents.
      </p>

      <div className="mt-7">
        <FormulaireDocuments initial={parametres} />
      </div>
    </>
  );
}
