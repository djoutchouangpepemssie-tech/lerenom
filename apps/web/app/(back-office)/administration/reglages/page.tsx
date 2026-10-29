import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ReglagesAdministration } from '@/composants/ReglagesAdministration';
import { etatReglages } from '@/lib/administration-reglages';
import { adminConnecte } from '@/lib/session-admin';

/**
 * Les réglages.
 *
 * L'écran qui rend praticable une promesse écrite depuis le début : changer un délai sans
 * déploiement. La distribution relisait déjà la table `parametres` à chaque demande, et le
 * semis y avait posé les valeurs initiales — mais rien ne permettait d'en changer une
 * autrement qu'à la main, en SQL, sur la base de production.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Réglages',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PageReglages() {
  const admin = await adminConnecte();
  if (admin === null) redirect('/administration/connexion');

  const etat = await etatReglages();

  return (
    <>
      <h1 className="text-2xl font-bold">Réglages</h1>
      <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
        Les seuils que la distribution relit à chaque demande, les comptes qui ont accès à cet
        écran, et la trace de tout ce qui a été fait ici. Un réglage changé s’applique à la demande
        suivante, sans déploiement — et l’ancienne valeur n’est pas effacée, elle est datée.
      </p>

      {etat.surDefaut === etat.reglages.length && (
        <p className="mt-4 rounded-[10px] border border-[#dcdcd8] bg-white px-4 py-3 text-[0.82rem] leading-relaxed text-[#45453f]">
          Aucun réglage n’a jamais été posé : les huit valeurs ci-dessous sont celles du code. C’est
          l’état normal d’une plateforme qui n’a pas encore eu besoin d’ajuster quoi que ce soit —
          pas un défaut.
        </p>
      )}

      <ReglagesAdministration etat={etat} />
    </>
  );
}
