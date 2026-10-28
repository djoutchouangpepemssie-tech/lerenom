import type { Metadata } from 'next';
import Link from 'next/link';
import { Carte } from '@lerenom/ui';
import { formatEuros } from '@lerenom/core';
import { BoutonNouveauDevis } from '@/composants/BoutonNouveauDevis';
import { listeDevis } from '@/lib/devis-pro';
import { dateEtHeure } from '@/lib/affichage';
import { proConnecte } from '@/lib/session-pro';

/** La liste des devis d'un professionnel. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes devis',
  robots: { index: false, follow: false },
};

const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  signe: 'Signé',
  refuse: 'Refusé',
  expire: 'Expiré',
};

export default async function PageDevis() {
  const pro = await proConnecte();
  if (pro === null) return null;

  const devis = await listeDevis(pro.entrepriseId);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">Mes devis</h1>
          <p className="text-encre-70 mt-2 max-w-[62ch]">
            Un devis reçoit son numéro au moment de l’envoi, et ne se modifie plus ensuite.
          </p>
        </div>
        <BoutonNouveauDevis />
      </div>

      <div className="mt-7 space-y-3">
        {devis.length === 0 && (
          <Carte className="p-6">
            <p className="text-encre font-semibold">Aucun devis pour l’instant.</p>
            <p className="text-encre-70 mt-1.5 text-sm">
              Le premier que vous établirez portera le numéro 0001 de l’année.
            </p>
          </Carte>
        )}

        {devis.map((ligne) => (
          <Link key={ligne.id} href={`/pro/espace/devis/${ligne.id}`} className="block">
            <Carte className="hover:border-or/40 p-5 transition-colors">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-encre font-semibold">
                    {ligne.numero ?? 'Brouillon sans numéro'}
                    {ligne.version > 1 && (
                      <span className="text-encre-55 ml-2 text-xs">version {ligne.version}</span>
                    )}
                  </p>
                  <p className="text-encre-70 mt-1 text-sm">
                    {ligne.clientNom ?? 'Client non rattaché'} ·{' '}
                    {ligne.envoyeLe === null
                      ? `créé le ${dateEtHeure(ligne.creeLe)}`
                      : `envoyé le ${dateEtHeure(ligne.envoyeLe)}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-encre-55 text-xs font-bold tracking-wide uppercase">
                    {LIBELLE_STATUT[ligne.statut] ?? ligne.statut}
                  </span>
                  <span className="text-encre font-[family-name:var(--font-titre)] text-xl">
                    {formatEuros(ligne.totalTTC)}
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
