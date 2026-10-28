import type { Metadata } from 'next';
import { FormulaireAgences } from '@/composants/FormulaireAgences';
import { agencesDuPro } from '@/lib/agences-pro';
import { proConnecte } from '@/lib/session-pro';

/**
 * « Mes agences » : d'où l'on part, et jusqu'où l'on va.
 *
 * L'inscription crée une agence sur la commune du siège, avec le rayon par défaut. Sans cet
 * écran, une entreprise à deux adresses ne pouvait en déclarer qu'une, et personne ne pouvait
 * corriger un rayon — alors que c'est lui qui décide des demandes reçues.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes agences',
  robots: { index: false, follow: false },
};

export default async function PageAgences() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const donnees = await agencesDuPro(pro.entrepriseId);
  if (donnees === null) return null;

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mes agences</h1>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        D’où vous partez, et jusqu’où vous allez. C’est ici que se règle la portée de chaque agence
        — et, dès que vos communes seront géocodées, le rayon au-delà duquel une demande ne vous
        sera plus proposée.
      </p>

      <div className="mt-7">
        <FormulaireAgences donnees={donnees} />
      </div>
    </>
  );
}
