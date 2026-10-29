import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PremiumAdministration } from '@/composants/PremiumAdministration';
import { etatPremium } from '@/lib/administration-premium';
import { adminConnecte } from '@/lib/session-admin';

/**
 * Premium et Exclusif.
 *
 * L'écran du stock : ce qui est vendu, ce qui est libre, ce que cela rapporte. Il n'attribue
 * pas de place — vendre engage une facture et un prélèvement, et rien n'encaisse encore.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Premium et Exclusif',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PagePremium() {
  const admin = await adminConnecte();
  if (admin === null) redirect('/administration/connexion');

  const etat = await etatPremium();
  const { indicateurs } = etat;

  const cartes = [
    {
      cle: 'recette',
      libelle: 'Recette mensuelle HT',
      valeur: `${indicateurs.recetteMensuelleHT.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`,
      explication:
        'Somme des abonnements en cours, l’annuel ramené au mois — dix mois payés pour douze.',
      alerte: false,
    },
    {
      cle: 'exclusifs',
      libelle: 'Exclusifs vendus',
      valeur: indicateurs.exclusifsVendus.toLocaleString('fr-FR'),
      explication: 'Un seul par métier et par ville. C’est la place la plus rare du catalogue.',
      alerte: false,
    },
    {
      cle: 'premium',
      libelle: 'Premium vendus',
      valeur: indicateurs.premiumVendus.toLocaleString('fr-FR'),
      explication: 'Six au plus par zone, qui tournent sur les deux places affichées.',
      alerte: false,
    },
    {
      cle: 'attente',
      libelle: 'En attente d’une place',
      valeur: indicateurs.enAttente.toLocaleString('fr-FR'),
      explication:
        indicateurs.enAttente === 0
          ? 'Aucune demande non servie. Les zones complètes n’ont pas encore de candidats.'
          : 'Des professionnels veulent payer et ne le peuvent pas : la demande est là, l’offre manque.',
      alerte: indicateurs.enAttente > 0,
    },
    {
      cle: 'sursis',
      libelle: 'Places en sursis',
      valeur: indicateurs.enSursis.toLocaleString('fr-FR'),
      explication:
        indicateurs.enSursis === 0
          ? 'Aucun abonné payant n’est tombé sous la note minimale.'
          : 'Sous la note minimale : ils paient, et leur emplacement ne s’affiche plus.',
      alerte: indicateurs.enSursis > 0,
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Premium et Exclusif</h1>
      <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
        Ce qui se vend n’est pas un abonnement, c’est{' '}
        <strong>une place sur un métier dans une ville</strong>. La rareté est le produit : un
        Exclusif et six Premium par zone, trois places affichées en haut de page. Cet écran montre
        l’état de ce stock ; il ne vend rien, parce que rien n’encaisse encore.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
              {carte.valeur}
            </p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#45453f]">
              {carte.explication}
            </p>
          </div>
        ))}
      </div>

      <PremiumAdministration etat={etat} />
    </>
  );
}
