import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Carte } from '@lerenom/ui';
import { LIBELLES_UNITE, formatEuros } from '@lerenom/core';
import { BoutonEmission } from '@/composants/BoutonEmission';
import { FormulaireAvoir } from '@/composants/FormulaireAvoir';
import { etatCreditFacture } from '@/lib/avoirs-pro';
import { factureDuPro } from '@/lib/factures-pro';
import { dateEtHeure } from '@/lib/affichage';
import { proConnecte } from '@/lib/session-pro';

/** Une facture : ce qu'elle porte, et ce qu'elle engage une fois émise. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Facture',
  robots: { index: false, follow: false },
};

export default async function PageUneFacture({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const pro = await proConnecte();
  if (pro === null) return null;

  const { id } = await params;
  const facture = await factureDuPro(pro.entrepriseId, id);
  if (facture === null) notFound();

  // Les avoirs ne concernent qu'une facture émise : avant l'émission, une erreur se corrige
  // en modifiant le document, et proposer un avoir brouillerait cette distinction.
  const credit = facture.emettable ? null : await etatCreditFacture(pro.entrepriseId, id);

  return (
    <>
      <Link
        href="/pro/espace/factures"
        className="text-encre-55 hover:text-encre text-sm font-semibold transition-colors"
      >
        ← Toutes mes factures
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-[clamp(1.6rem,3.6vw,2.2rem)]">
          {facture.numero ?? 'Facture prête à émettre'}
        </h1>
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          <Link
            href={`/document/facture/${id}`}
            className="text-encre hover:text-or-fonce text-sm font-semibold underline decoration-[1.5px] underline-offset-4 transition-colors"
          >
            Voir le document imprimable
          </Link>
          {/* Le XML ne s'offre que sur une facture émise : avant, il n'y a ni numéro ni date,
              donc rien qui constitue une facture au sens comptable. */}
          {!facture.emettable && (
            <a
              href={`/api/pro/factures/${id}/facturx`}
              className="text-encre-55 hover:text-encre text-sm font-semibold underline decoration-[1.5px] underline-offset-4 transition-colors"
            >
              Télécharger le XML Factur-X
            </a>
          )}
        </span>
      </div>
      <p className="text-encre-70 mt-2 max-w-[62ch]">
        {facture.emettable
          ? 'Vérifiez-la avant de l’émettre : une fois émise, elle ne se modifie plus et une erreur se corrige par un avoir.'
          : `Émise le ${facture.emiseLe === null ? '—' : dateEtHeure(facture.emiseLe)}. ${
              facture.statut === 'annulee_par_avoir'
                ? 'Annulée par avoir : elle reste au livre, avec son avoir en face.'
                : 'Elle ne se modifie plus.'
            }`}
      </p>

      <div className="mt-7 grid max-w-4xl gap-6 lg:grid-cols-[1fr_17rem] lg:items-start">
        <Carte className="p-5">
          <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            {facture.type === 'acompte' ? 'Acompte' : 'Solde'}
            {facture.devisNumero !== null && ` · devis ${facture.devisNumero}`}
          </p>

          <ul className="border-bordure mt-5 divide-y divide-[var(--color-bordure)] border-t border-b">
            {facture.lignes.map((ligne) => (
              <li key={ligne.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                <span
                  className={
                    ligne.type === 'section'
                      ? 'text-encre w-full font-bold'
                      : 'text-encre min-w-0 flex-1 text-sm'
                  }
                >
                  {ligne.designation}
                  {ligne.detail !== undefined && (
                    <span className="text-encre-55 block text-xs">{ligne.detail}</span>
                  )}
                </span>
                {ligne.quantite !== undefined && ligne.prixUnitaireHT !== undefined && (
                  <span className="text-encre-70 shrink-0 text-sm">
                    {ligne.quantite} {ligne.unite === undefined ? '' : LIBELLES_UNITE[ligne.unite]}{' '}
                    × {formatEuros(ligne.prixUnitaireHT)}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-encre-55">Total hors taxes</dt>
              <dd className="text-encre font-semibold">{formatEuros(facture.totalHT)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-encre-55">TVA</dt>
              <dd className="text-encre font-semibold">{formatEuros(facture.totalTVA)}</dd>
            </div>
            {facture.acompteDejaFactureTTC > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-encre-55">Acompte déjà facturé</dt>
                <dd className="text-encre font-semibold">
                  − {formatEuros(facture.acompteDejaFactureTTC)}
                </dd>
              </div>
            )}
            {facture.type === 'acompte' && facture.montantAPayerTTC < facture.totalTTC && (
              // Sans cette ligne, on passe de « TVA 112,20 € » à « À payer 370,26 € » sans
              // que rien n'explique le saut : les lignes décrivent la commande entière,
              // l'acompte n'en réclame qu'une part. Un client qui lit la facture doit
              // pouvoir refaire le calcul.
              <div className="flex justify-between gap-3">
                <dt className="text-encre-55">
                  Acompte demandé
                  {facture.totalTTC > 0 &&
                    ` · ${String(Math.round((facture.montantAPayerTTC / facture.totalTTC) * 100))} %`}
                </dt>
                <dd className="text-encre font-semibold">
                  sur {formatEuros(facture.totalTTC)} TTC
                </dd>
              </div>
            )}
            <div className="border-bordure flex justify-between gap-3 border-t pt-3">
              <dt className="text-encre font-bold">À payer</dt>
              <dd className="text-encre font-[family-name:var(--font-titre)] text-2xl">
                {formatEuros(facture.montantAPayerTTC)}
              </dd>
            </div>
          </dl>
        </Carte>

        <div className="space-y-5">
          <Carte className="p-5">
            <p className="text-encre text-sm font-bold">Coordonnées bancaires</p>
            {facture.rib === null ? (
              <p className="text-encre-70 mt-2 text-sm">
                Aucun relevé bancaire actif. La facture s’émet quand même — un client peut payer
                autrement — mais elle n’indiquera pas où virer.
              </p>
            ) : (
              <div className="mt-3 text-sm">
                <p className="text-encre font-semibold">{facture.rib.titulaire}</p>
                <p className="text-encre-70 mt-1 font-mono text-xs break-all">{facture.rib.iban}</p>
                {facture.rib.banque !== null && (
                  <p className="text-encre-55 mt-1 text-xs">{facture.rib.banque}</p>
                )}
                <p className="text-encre-55 mt-3 text-xs">
                  {facture.emettable
                    ? 'Ce relevé sera figé sur la facture au moment de l’émission.'
                    : 'Figé à l’émission : il ne suivra pas un changement de banque.'}
                </p>
              </div>
            )}
          </Carte>

          {facture.emettable && <BoutonEmission factureId={facture.id} />}

          {credit !== null && (
            <FormulaireAvoir
              factureId={facture.id}
              resteACrediterTTC={credit.resteACrediterTTC}
              avoirs={credit.avoirs}
            />
          )}
        </div>
      </div>
    </>
  );
}
