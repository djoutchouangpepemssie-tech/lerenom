import type { Metadata } from 'next';
import { ListeDemandesPro } from '@/composants/ListeDemandesPro';
import { demandesAcceptees, demandesEnAttente } from '@/lib/espace-pro';
import { proConnecte } from '@/lib/session-pro';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes demandes',
  robots: { index: false, follow: false },
};

export default async function PageDemandesPro() {
  // La disposition a déjà refusé l'accès si la session est absente ; ce garde-fou est là pour
  // le typage, et pour qu'un déplacement de fichier ne crée pas de page ouverte par accident.
  const pro = await proConnecte();
  if (pro === null) return null;

  const [enAttente, acceptees] = await Promise.all([
    demandesEnAttente(pro.entrepriseId),
    demandesAcceptees(pro.entrepriseId),
  ]);

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mes demandes</h1>
      <p className="text-encre-70 mt-2 max-w-[58ch]">
        Une demande acceptée est définitive et facturée ; un refus est gratuit. Les coordonnées du
        client ne vous sont transmises qu’après votre acceptation.
      </p>

      <div className="mt-7">
        <ListeDemandesPro enAttente={enAttente} acceptees={acceptees} />
      </div>
    </>
  );
}
