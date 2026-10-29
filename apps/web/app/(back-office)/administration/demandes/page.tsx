import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DemandesAdministration } from '@/composants/DemandesAdministration';
import { etatDemandes, metiersDisponibles } from '@/lib/administration-demandes';
import { adminConnecte } from '@/lib/session-admin';

/**
 * Le centre de distribution.
 *
 * C'est l'écran qui dit si le produit fait son travail : une demande déposée doit trouver un
 * professionnel, et tout le reste n'existe que pour cela.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Demandes',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PageDemandes() {
  const admin = await adminConnecte();
  if (admin === null) redirect('/administration/connexion');

  const [etat, metiers] = await Promise.all([etatDemandes(), metiersDisponibles()]);
  const { indicateurs } = etat;

  const cartes = [
    {
      cle: 'distribution',
      libelle: 'En distribution',
      valeur: indicateurs.enDistribution,
      explication: 'Parties aux professionnels, en attente d’une réponse.',
      alerte: false,
    },
    {
      cle: 'sans-preneur',
      libelle: 'Sans preneur',
      valeur: indicateurs.sansPreneur,
      explication:
        indicateurs.sansPreneur === 0
          ? 'Aucune demande n’est restée sur le carreau.'
          : 'Personne n’a accepté. Chacune est un client déçu.',
      alerte: indicateurs.sansPreneur > 0,
    },
    {
      cle: 'a-classer',
      libelle: 'À classer',
      valeur: indicateurs.aClasser,
      explication:
        indicateurs.aClasser === 0
          ? 'Le classement automatique s’en sort seul.'
          : 'Le classement automatique doute. Mal classée, une demande part aux mauvais pros.',
      alerte: indicateurs.aClasser > 0,
    },
    {
      cle: 'non-verifiees',
      libelle: 'Mobile non vérifié',
      valeur: indicateurs.nonVerifiees,
      explication:
        'Déposées, jamais confirmées par SMS, donc jamais distribuées. Rien ne part tant qu’aucun opérateur n’est raccordé.',
      alerte: false,
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Demandes</h1>
      <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
        La cascade, telle qu’elle est maintenant. Dépliez une demande pour voir quels professionnels
        l’ont reçue, à quel tour, qui l’a ouverte et combien de temps il reste à chacun.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartes.map((carte) => (
          <div
            key={carte.cle}
            className={`rounded-[12px] border bg-white p-4 ${
              carte.alerte ? 'border-[#e4c9c9]' : 'border-[#dcdcd8]'
            }`}
          >
            <p className="text-[0.68rem] font-bold tracking-[0.14em] text-[#6b6b66] uppercase">
              {carte.libelle}
            </p>
            <p
              className={`mt-2 text-3xl font-bold tabular-nums ${
                carte.alerte ? 'text-[#8c1c1c]' : 'text-[#16181D]'
              }`}
            >
              {carte.valeur.toLocaleString('fr-FR')}
            </p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#45453f]">
              {carte.explication}
            </p>
          </div>
        ))}
      </div>

      <DemandesAdministration etat={etat} metiers={metiers} />
    </>
  );
}
