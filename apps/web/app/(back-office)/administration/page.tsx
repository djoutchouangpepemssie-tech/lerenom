import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { etatPlateforme } from '@/lib/administration-accueil';
import { dateEtHeure } from '@/lib/affichage';
import { adminConnecte } from '@/lib/session-admin';

/**
 * L'accueil du back-office.
 *
 * Quatre indicateurs, et ils disent ce qui ne va pas plutôt que ce qui va. Le nombre
 * d'entreprises inscrites est flatteur et n'appelle aucune décision ; les demandes sans
 * preneur, oui. Un tableau de bord sert à savoir quoi faire en arrivant le matin.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Accueil',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PageAccueilAdministration() {
  const admin = await adminConnecte();
  if (admin === null) redirect('/administration/connexion');

  const etat = await etatPlateforme();

  return (
    <>
      <h1 className="text-2xl font-bold">Bonjour {admin.nom.split(' ')[0]}</h1>
      <p className="mt-1 text-sm text-[#6b6b66]">
        {etat.entreprisesVerifiees.toLocaleString('fr-FR')} entreprises vérifiées sur{' '}
        {etat.entreprises.toLocaleString('fr-FR')} référencées.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {etat.indicateurs.map((indicateur) => (
          <Link
            key={indicateur.cle}
            href={indicateur.lien}
            className={`block rounded-[12px] border bg-white p-4 transition-shadow hover:shadow-sm ${
              indicateur.alerte ? 'border-[#e4c9c9]' : 'border-[#dcdcd8]'
            }`}
          >
            <p className="text-[0.68rem] font-bold tracking-[0.14em] text-[#6b6b66] uppercase">
              {indicateur.libelle}
            </p>
            <p
              className={`mt-2 text-3xl font-bold tabular-nums ${
                indicateur.alerte ? 'text-[#8c1c1c]' : 'text-[#16181D]'
              }`}
            >
              {indicateur.valeur.toLocaleString('fr-FR')}
            </p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#45453f]">
              {indicateur.explication}
            </p>
          </Link>
        ))}
      </div>

      {etat.messagesEnAttente > 0 && (
        <div className="mt-6 rounded-[12px] border border-[#e4c9c9] bg-[#fdf3f3] p-5">
          <p className="text-sm font-bold text-[#8c1c1c]">
            Aucun message ne part : la plateforme est muette.
          </p>
          <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-[#5c3030]">
            {etat.messagesEnAttente.toLocaleString('fr-FR')} messages attendent
            {etat.plusVieuxMessage !== null && (
              <> — le plus ancien depuis le {dateEtHeure(etat.plusVieuxMessage)}</>
            )}
            . Tant qu’aucun opérateur SMS ni service de courriel n’est raccordé, les demandes
            distribuées ne préviennent personne, les devis ne s’ouvrent pas et les rendez-vous ne se
            rappellent pas. L’expéditeur tourne déjà : il ne manque que le fournisseur.
          </p>
          <p className="mt-2 text-[0.78rem] text-[#5c3030]">
            Les messages trop anciens sont abandonnés plutôt qu’envoyés en retard : le jour du
            raccordement, la file ne se déversera pas d’un coup sur les clients.
          </p>
        </div>
      )}

      <div className="mt-8 rounded-[12px] border border-[#dcdcd8] bg-white p-5">
        <p className="text-sm font-bold">Les huit autres univers arrivent</p>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-[#45453f]">
          Le back-office compte dix-sept modules en neuf univers. Seul l’accueil existe pour
          l’instant ; les onglets du haut mènent à des pages encore vides, et c’est volontaire —
          mieux vaut une page honnêtement absente qu’un écran qui fait semblant.
        </p>
      </div>
    </>
  );
}
