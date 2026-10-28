import type { Metadata } from 'next';
import { FormulaireFiche } from '@/composants/FormulaireFiche';
import { ficheDuPro } from '@/lib/fiche-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * « Ma fiche » : ce que le professionnel montre au public.
 *
 * L'écran d'inscription promet qu'on complète sa fiche ensuite — photos, horaires, assurance.
 * C'est ici que cette promesse se tient, et c'est aussi ici qu'on dit clairement ce que chaque
 * élément rapporte : la complétude décide du classement naturel.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ma fiche',
  robots: { index: false, follow: false },
};

export default async function PageFiche() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const fiche = await ficheDuPro(pro.entrepriseId);
  if (fiche === null) return null;

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Ma fiche</h1>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        C’est ce que voient les visiteurs avant de vous appeler. Chaque élément rempli vous fait
        monter dans le classement naturel — la colonne de droite dit lequel rapporte le plus.
      </p>

      <div className="mt-7">
        <FormulaireFiche fiche={fiche} />
      </div>
    </>
  );
}
