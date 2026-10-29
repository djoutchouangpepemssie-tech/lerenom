import type { Metadata } from 'next';
import Link from 'next/link';
import { Carte } from '@lerenom/ui';
import { formatEuros } from '@lerenom/core';
import { listeFactures } from '@/lib/factures-pro';
import { dateEtHeure } from '@/lib/affichage';
import { proConnecte } from '@/lib/session-pro';

/** La liste des factures. Elles naissent du devis signé, jamais d'une saisie. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes factures',
  robots: { index: false, follow: false },
};

const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  prete: 'Prête à émettre',
  emise: 'Émise',
  payee: 'Payée',
  annulee_par_avoir: 'Annulée par avoir',
};

const LIBELLE_TYPE: Readonly<Record<string, string>> = {
  acompte: 'Acompte',
  solde: 'Solde',
  libre: 'Facture',
};

export default async function PageFactures() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const factures = await listeFactures(pro.entrepriseId);

  // Une facture « émise » et non réglée est due ; une facture annulée par un avoir ne l'est
  // plus, et une facture non émise n'a jamais été réclamée.
  const dues = factures.filter((f) => f.statut === 'emise');
  const resteAEncaisser = dues.reduce((somme, f) => somme + f.montantAPayerTTC, 0);
  const impayees = dues.length;
  const maintenant = Date.now();
  const retard = dues.filter((f) => f.echeanceLe !== null && f.echeanceLe.getTime() < maintenant);
  const enRetard = retard.length;
  const montantEnRetard = retard.reduce((somme, f) => somme + f.montantAPayerTTC, 0);

  return (
    <>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mes factures</h1>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        Elles sont préparées à partir de vos devis signés. Une facture émise ne se modifie plus :
        une erreur se corrige par un avoir.
      </p>

      {/* Ce qui reste à encaisser, en haut et avant la liste : c'est la question qu'un
          artisan se pose en ouvrant cet écran, et il n'avait aucun moyen d'y répondre —
          rien n'enregistrait les paiements. Les factures en retard sont comptées à part :
          une somme due n'a pas le même poids selon qu'elle est à l'heure ou pas. */}
      {resteAEncaisser > 0 && (
        <Carte className="mt-5 p-5">
          <p className="text-encre-55 text-[0.68rem] font-bold tracking-[0.14em] uppercase">
            Reste à encaisser
          </p>
          <p className="text-encre mt-1.5 text-3xl font-bold tabular-nums">
            {formatEuros(resteAEncaisser)}
          </p>
          <p className="text-encre-70 mt-1.5 text-sm">
            {enRetard === 0
              ? `Sur ${impayees} facture${impayees > 1 ? 's' : ''} émise${impayees > 1 ? 's' : ''}, aucune n’a dépassé son échéance.`
              : `Dont ${formatEuros(montantEnRetard)} sur ${enRetard} facture${enRetard > 1 ? 's' : ''} dont l’échéance est passée.`}
          </p>
        </Carte>
      )}

      <div className="mt-7 space-y-3">
        {factures.length === 0 && (
          <Carte className="p-6">
            <p className="text-encre font-semibold">Aucune facture pour l’instant.</p>
            <p className="text-encre-70 mt-1.5 text-sm">
              Déclarez un devis signé et ses factures — acompte puis solde — seront préparées ici.
            </p>
          </Carte>
        )}

        {factures.map((facture) => (
          <Link key={facture.id} href={`/pro/espace/factures/${facture.id}`} className="block">
            <Carte className="hover:border-or/40 p-5 transition-colors">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-encre font-semibold">
                    {facture.numero ?? 'Prête, sans numéro'}
                    <span className="text-encre-55 ml-2 text-xs">
                      {LIBELLE_TYPE[facture.type] ?? facture.type}
                    </span>
                  </p>
                  <p className="text-encre-70 mt-1 text-sm">
                    {facture.clientNom ?? 'Client non rattaché'} ·{' '}
                    {facture.emiseLe === null
                      ? `préparée le ${dateEtHeure(facture.creeLe)}`
                      : `émise le ${dateEtHeure(facture.emiseLe)}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-encre-55 text-xs font-bold tracking-wide uppercase">
                    {LIBELLE_STATUT[facture.statut] ?? facture.statut}
                  </span>
                  <span className="text-encre font-[family-name:var(--font-titre)] text-xl">
                    {formatEuros(facture.montantAPayerTTC)}
                  </span>
                </div>
              </div>
            </Carte>
          </Link>
        ))}
      </div>
    </>
  );
}
