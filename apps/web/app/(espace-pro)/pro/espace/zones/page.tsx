import type { Metadata } from 'next';
import { MesZonesPayees } from '@/composants/MesZonesPayees';
import { zonesDuPro } from '@/lib/liste-attente-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * « Mes places » : où je peux être mis en avant, et où c'est complet.
 *
 * Jusqu'ici, un professionnel qui voulait une place sur une zone complète n'avait aucun moyen
 * de le faire savoir. C'est pourtant le moment où la rareté a de la valeur — pour lui comme
 * pour Le Renom.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes places',
  robots: { index: false, follow: false },
};

export default async function PageZones() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const zones = await zonesDuPro(pro.entrepriseId);

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mes places</h1>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        Sur chaque métier et chaque ville de votre périmètre, trois places sont mises en avant en
        haut des résultats : un Exclusif et deux Premium. Quand tout est pris, inscrivez-vous pour
        être prévenu — sans engagement et sans frais.
      </p>

      <MesZonesPayees zones={zones} />
    </>
  );
}
