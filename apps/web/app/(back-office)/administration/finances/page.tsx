import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { etatFinances } from '@/lib/administration-finances';
import { adminConnecte } from '@/lib/session-admin';

/**
 * Les finances.
 *
 * Un **prévisionnel**, pas une recette : rien n'encaisse, et `FactureLeRenom` est vide. Ce
 * que l'écran additionne est réel — les abonnements en cours et la dépense hors forfait déjà
 * consommée — mais personne n'a encore été facturé, et la page le dit avant tout chiffre.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Finances',
  robots: { index: false, follow: false, nocache: true },
};

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function euros(montant: number): string {
  return `${montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function moisEnToutesLettres(mois: string): string {
  const [annee, numero] = mois.split('-');
  return `${MOIS[Number(numero) - 1] ?? mois} ${annee}`;
}

export default async function PageFinances() {
  const admin = await adminConnecte();
  if (admin === null) redirect('/administration/connexion');

  const etat = await etatFinances();
  const { totaux, indicateurs, lignes } = etat;

  return (
    <>
      <h1 className="text-2xl font-bold">Finances</h1>

      {/* L'avertissement passe avant les chiffres, et non en note de bas de page : un
          prévisionnel lu comme une recette est un mensonge comptable, et celui qui le lit
          prendra des décisions dessus. */}
      <div className="mt-3 max-w-[72ch] rounded-[10px] border border-[#e4c9c9] bg-white px-4 py-3">
        <p className="text-[0.82rem] leading-relaxed text-[#45453f]">
          <strong>Ce qui suit est un prévisionnel, pas un chiffre d’affaires.</strong> Le Renom n’a
          émis <strong>aucune facture</strong> et n’encaisse rien : il manque le raccordement du
          paiement. Les montants ci-dessous sont ce qui serait facturé pour{' '}
          {moisEnToutesLettres(etat.mois)} d’après les abonnements en cours et les demandes déjà
          consommées hors forfait.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
          <p className="text-[0.68rem] font-bold tracking-[0.14em] text-[#6b6b66] uppercase">
            Abonnements du mois
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{euros(totaux.abonnementsHT)}</p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[#45453f]">
            Part récurrente, hors taxes. L’annuel est ramené au mois : dix mois payés pour douze.
          </p>
        </div>

        <div className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
          <p className="text-[0.68rem] font-bold tracking-[0.14em] text-[#6b6b66] uppercase">
            Hors forfait consommé
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{euros(totaux.horsForfaitHT)}</p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[#45453f]">
            Demandes acceptées au-delà du forfait. C’est de la consommation réelle, enregistrée à
            chaque acceptation.
          </p>
        </div>

        <div className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
          <p className="text-[0.68rem] font-bold tracking-[0.14em] text-[#6b6b66] uppercase">
            Total à facturer
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{euros(totaux.totalHT)}</p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[#45453f]">
            Hors taxes · {euros(totaux.totalTTC)} TTC, dont {euros(totaux.tva)} de TVA.
          </p>
        </div>

        <div className="rounded-[12px] border border-[#e4c9c9] bg-white p-4">
          <p className="text-[0.68rem] font-bold tracking-[0.14em] text-[#6b6b66] uppercase">
            Factures émises
          </p>
          <p className="mt-2 text-3xl font-bold text-[#8c1c1c] tabular-nums">
            {indicateurs.facturesEmises.toLocaleString('fr-FR')}
          </p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[#45453f]">
            {indicateurs.facturesEmises === 0
              ? 'Aucune. Rien n’a été facturé ni encaissé depuis l’ouverture.'
              : 'Factures réellement émises par Le Renom.'}
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-bold">Par abonné · {moisEnToutesLettres(etat.mois)}</h2>
      <p className="mt-1 text-sm text-[#45453f]">
        Du plus gros au plus petit. Un abonnement qui n’est pas « actif » est signalé : c’est une
        recette qu’on compte et qu’on ne touchera peut-être pas.
      </p>

      <div className="mt-3 overflow-x-auto rounded-[12px] border border-[#dcdcd8] bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#dcdcd8] text-left">
              <th className="px-4 py-2.5 font-semibold">Entreprise</th>
              <th className="px-4 py-2.5 font-semibold">Formule</th>
              <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Forfait</th>
              <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">Abonnement</th>
              <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                Hors forfait
              </th>
              <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.entrepriseId} className="border-b border-[#eceae6] last:border-0">
                <td className="px-4 py-2.5 font-medium">{ligne.entreprise}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {ligne.formule}
                  <span className="text-[#6b6b66]"> · {ligne.periodicite}</span>
                  {ligne.statut !== 'actif' && (
                    <span className="ml-2 rounded-[4px] bg-[#f6e4e4] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#8c1c1c]">
                      {ligne.statut}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-[#6b6b66] tabular-nums">
                  {ligne.demandesIncluses === 0
                    ? '—'
                    : `${ligne.demandesAcceptees} / ${ligne.demandesIncluses}`}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{euros(ligne.abonnementHT)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {ligne.horsForfaitHT === 0 ? '—' : euros(ligne.horsForfaitHT)}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {euros(ligne.totalHT)}
                </td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#6b6b66] italic">
                  Aucun abonnement en cours.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
