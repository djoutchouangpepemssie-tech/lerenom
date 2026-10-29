import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { etatCroissance } from '@/lib/administration-croissance';
import { adminConnecte } from '@/lib/session-admin';

/**
 * La croissance.
 *
 * Ce que chaque abonné reçoit pour son argent. Trois tables de mesure dormaient vides depuis
 * le premier jour ; elles sont maintenant alimentées, et cet écran les lit.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Croissance',
  robots: { index: false, follow: false, nocache: true },
};

function pourcentage(part: number | null): string {
  return part === null ? '—' : `${(part * 100).toFixed(1).replace('.', ',')} %`;
}

export default async function PageCroissance() {
  const admin = await adminConnecte();
  if (admin === null) redirect('/administration/connexion');

  const etat = await etatCroissance();
  const { indicateurs, lignes, jours } = etat;
  const maximum = Math.max(1, ...jours.map((j) => j.affichages));

  const cartes = [
    {
      cle: 'affichages',
      libelle: 'Affichages (30 j)',
      valeur: indicateurs.affichages.toLocaleString('fr-FR'),
      explication: 'Combien de fois une fiche est apparue dans une page de résultats.',
      alerte: false,
    },
    {
      cle: 'clics',
      libelle: 'Fiches ouvertes',
      valeur: indicateurs.clics.toLocaleString('fr-FR'),
      explication: 'Visiteurs qui sont allés voir la fiche après l’avoir vue dans la liste.',
      alerte: false,
    },
    {
      cle: 'taux',
      libelle: 'Taux d’ouverture',
      valeur: pourcentage(indicateurs.tauxOuverture),
      explication:
        indicateurs.tauxOuverture === null
          ? 'Rien n’a encore été affiché : il n’y a pas de taux à calculer.'
          : 'Part des affichages qui ont mené à une fiche.',
      alerte: false,
    },
    {
      cle: 'sans-audience',
      libelle: 'Payants sans audience',
      valeur: indicateurs.payantsSansAudience.toLocaleString('fr-FR'),
      explication:
        indicateurs.payantsSansAudience === 0
          ? 'Tous les abonnés payants ont été vus au moins une fois.'
          : 'Ils paient et n’ont été affichés nulle part. C’est la première cause de résiliation.',
      alerte: indicateurs.payantsSansAudience > 0,
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Croissance</h1>
      <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
        Ce que chaque abonné reçoit pour son argent. La mesure a commencé le jour où elle a été
        posée : les semaines d’avant sont vides, et elles le resteront. Les appels ne sont pas
        comptés — ils demandent des numéros de suivi, donc un opérateur téléphonique, qui n’est pas
        raccordé.
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
              {carte.valeur}
            </p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#45453f]">
              {carte.explication}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold">Jour par jour</h2>
      {jours.length === 0 ? (
        <p className="mt-3 rounded-[12px] border border-[#dcdcd8] bg-white px-4 py-8 text-center text-sm text-[#6b6b66] italic">
          Aucune mesure enregistrée. La première visite d’une page de résultats ouvrira la première
          ligne.
        </p>
      ) : (
        /* Un histogramme en barres pleines plutôt qu'une courbe : sur quelques jours de
           mesure, une courbe laisserait croire à une tendance là où il n'y a que des
           points. */
        <div className="mt-3 rounded-[12px] border border-[#dcdcd8] bg-white p-4">
          <ol className="space-y-1.5">
            {jours.map((jour) => (
              // `flex-wrap` et une barre qui passe en dernier : à 390 px, une étiquette de
              // date fixe, une barre proportionnelle et un libellé chiffré ne tenaient pas
              // sur une ligne, et le tout poussait la page de quatre pixels. La barre passe
              // à la ligne plutôt que de déborder.
              <li
                key={jour.jour}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem]"
              >
                <span className="w-20 shrink-0 text-[#6b6b66] tabular-nums">{jour.jour}</span>
                <span
                  className="order-last h-3 rounded-[2px] bg-[#16181D] sm:order-none"
                  style={{ width: `${Math.max(2, (jour.affichages / maximum) * 45)}%` }}
                  aria-hidden
                />
                <span className="tabular-nums">
                  {jour.affichages.toLocaleString('fr-FR')} affichage
                  {jour.affichages > 1 ? 's' : ''} · {jour.ouvertures.toLocaleString('fr-FR')}{' '}
                  ouverture
                  {jour.ouvertures > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <h2 className="mt-8 text-lg font-bold">Par entreprise</h2>
      <p className="mt-1 text-sm text-[#45453f]">
        Les abonnés payants d’abord, et parmi eux ceux qui reçoivent le moins.
      </p>
      <div className="mt-3 overflow-x-auto rounded-[12px] border border-[#dcdcd8] bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#dcdcd8] text-left">
              <th className="px-4 py-2.5 font-semibold">Entreprise</th>
              <th className="px-4 py-2.5 font-semibold">Formule</th>
              <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">Affichages</th>
              <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                dont sponsorisés
              </th>
              <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                Fiches ouvertes
              </th>
              <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">Taux</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.entrepriseId} className="border-b border-[#eceae6] last:border-0">
                <td className="px-4 py-2.5 font-medium">{ligne.entreprise}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {ligne.formule}
                  {ligne.formule !== 'gratuit' && ligne.affichages === 0 && (
                    <span className="ml-2 rounded-[4px] bg-[#f6e4e4] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#8c1c1c]">
                      jamais affiché
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {ligne.affichages.toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-2.5 text-right text-[#6b6b66] tabular-nums">
                  {ligne.affichagesSponsorises.toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {ligne.ouverturesFiche.toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {pourcentage(ligne.tauxOuverture)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
