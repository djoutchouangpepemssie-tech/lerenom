import type { Metadata } from 'next';
import { FormulairePerimetre } from '@/composants/FormulairePerimetre';
import { perimetreDuPro } from '@/lib/zones-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * « Mon périmètre » : les métiers et les villes.
 *
 * L'inscription fixe un périmètre une fois ; la vie d'une entreprise le fait bouger. Sans cet
 * écran, ouvrir une ville ou ajouter un métier demandait de nous écrire.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mon périmètre',
  robots: { index: false, follow: false },
};

export default async function PagePerimetre() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const perimetre = await perimetreDuPro(pro.entrepriseId);
  if (perimetre === null) return null;

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mon périmètre</h1>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        Les métiers que vous exercez et les villes où vous intervenez. Ce sont eux qui décident des
        pages où vous apparaissez, et des demandes qui vous parviennent.
      </p>

      <div className="mt-7">
        <FormulairePerimetre perimetre={perimetre} />
      </div>
    </>
  );
}
