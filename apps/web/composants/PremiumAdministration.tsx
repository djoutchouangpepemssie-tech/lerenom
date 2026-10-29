'use client';

import { useState } from 'react';
import type {
  AbonnementAdministration,
  EtatPremium,
  ZoneCommerciale,
} from '@/lib/administration-premium';

/**
 * Premium et Exclusif, à surveiller.
 *
 * **Les zones d'abord, les abonnés ensuite.** Ce qui se vend est une place sur un métier dans
 * une ville ; l'abonnement n'en est que la facture. Ouvrir sur la liste des abonnés
 * raconterait l'histoire à l'envers.
 *
 * **Chaque zone montre ce qui est vendu et ce qui s'affiche**, parce que les deux chiffres
 * diffèrent et qu'on les confond : six Premium peuvent être vendus, deux seulement sont
 * affichés à la fois, et chacun obtient donc un tiers des affichages. Une zone qui n'afficherait
 * que son nombre de vendus laisserait croire qu'on peut en vendre sans fin.
 *
 * **Aucun bouton pour attribuer une place.** Vendre engage une facture, un prélèvement et, pour
 * l'Exclusif, douze mois d'engagement. Tant que rien n'encaisse, attribuer ici donnerait une
 * place sans contrepartie et un abonné qui se croit facturé.
 */

type Onglet = 'zones' | 'abonnes';

function euros(montant: number): string {
  return `${montant.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
}

function pourcentage(part: number): string {
  return `${Math.round(part * 100)} %`;
}

export function PremiumAdministration({ etat }: { readonly etat: EtatPremium }) {
  const [onglet, setOnglet] = useState<Onglet>('zones');

  return (
    <>
      <div role="tablist" aria-label="Vue commerciale" className="mt-6 flex flex-wrap gap-1">
        {[
          { cle: 'zones' as const, libelle: 'Zones vendues', compte: etat.zones.length },
          {
            cle: 'abonnes' as const,
            libelle: 'Abonnés',
            compte: etat.abonnements.length,
          },
        ].map((candidat) => (
          <button
            key={candidat.cle}
            role="tab"
            type="button"
            aria-selected={onglet === candidat.cle}
            onClick={() => setOnglet(candidat.cle)}
            className={`rounded-t-[8px] border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              onglet === candidat.cle
                ? 'border-[#16181D] text-[#16181D]'
                : 'border-transparent text-[#6b6b66] hover:text-[#16181D]'
            }`}
          >
            {candidat.libelle}
            <span className="ml-1.5 tabular-nums opacity-70">{candidat.compte}</span>
          </button>
        ))}
      </div>

      {onglet === 'zones' && (
        <>
          <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-[#45453f]">
            Seules les zones où au moins une place est vendue apparaissent : le catalogue entier
            ferait des dizaines de milliers de lignes vides, et la seule information utile — où la
            rareté est atteinte — s’y noierait.
          </p>
          <div className="mt-4 space-y-3">
            {etat.zones.map((zone) => (
              <CarteZone
                key={`${zone.metierId}-${zone.communeCode}`}
                zone={zone}
                placesAffichees={etat.placesAffichees}
              />
            ))}
            {etat.zones.length === 0 && (
              <p className="rounded-[12px] border border-[#dcdcd8] bg-white px-4 py-8 text-center text-sm text-[#6b6b66] italic">
                Aucune place vendue pour l’instant.
              </p>
            )}
          </div>
        </>
      )}

      {onglet === 'abonnes' && (
        <div className="mt-4 overflow-x-auto rounded-[12px] border border-[#dcdcd8] bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#dcdcd8] text-left">
                <th className="px-4 py-2.5 font-semibold">Entreprise</th>
                <th className="px-4 py-2.5 font-semibold">Formule</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Places détenues</th>
                <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                  Par mois HT
                </th>
              </tr>
            </thead>
            <tbody>
              {etat.abonnements.map((abonnement) => (
                <LigneAbonne key={abonnement.id} abonnement={abonnement} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CarteZone({
  zone,
  placesAffichees,
}: {
  readonly zone: ZoneCommerciale;
  readonly placesAffichees: number;
}) {
  const complet = zone.exclusif !== null && zone.placesPremiumRestantes === 0;

  return (
    <article className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-semibold">
          {zone.metier} · {zone.commune}
        </h2>
        <p className="text-[0.82rem] text-[#6b6b66]">
          <span className="font-semibold text-[#16181D] tabular-nums">
            {euros(zone.recetteMensuelleHT)}
          </span>{' '}
          par mois HT sur {euros(zone.potentielMensuelHT)} possibles
        </p>
      </div>

      <p className="mt-2 text-[0.82rem] text-[#45453f]">
        {zone.exclusif === null ? (
          <span className="text-[#8a5a16]">
            Exclusif libre — {zone.concurrents} entreprise{zone.concurrents > 1 ? 's' : ''}{' '}
            référencée{zone.concurrents > 1 ? 's' : ''} sur cette zone.
          </span>
        ) : (
          <>
            <strong>Exclusif</strong> : {zone.exclusif}
          </>
        )}
      </p>

      <p className="mt-1 text-[0.82rem] text-[#45453f]">
        <strong>Premium</strong> : {zone.premium.length === 0 ? 'aucun' : zone.premium.join(', ')}
      </p>

      <p className="mt-2 text-[0.78rem] leading-relaxed text-[#6b6b66]">
        {zone.premium.length} place{zone.premium.length > 1 ? 's' : ''} Premium vendue
        {zone.premium.length > 1 ? 's' : ''} sur {zone.premium.length + zone.placesPremiumRestantes}
        {/* La rotation ne se mentionne que lorsqu'il y en a une. Écrire « deux s'affichent à
            la fois, soit 100 % des affichages » quand il n'y a que deux vendus se lit comme
            une contradiction, et fait douter du chiffre plutôt que de l'expliquer. */}
        {zone.premium.length > placesAffichees && (
          <>
            {' '}
            · {placesAffichees} s’affichent à la fois, soit {pourcentage(zone.partAffichagePremium)}{' '}
            des affichages pour chacun
          </>
        )}
        {zone.premium.length > 0 && zone.premium.length <= placesAffichees && (
          <>
            {' '}
            · tous s’affichent en permanence, la rotation ne commence qu’au-delà de{' '}
            {placesAffichees}
          </>
        )}
        {complet && ' · zone complète'}
        {zone.enAttente > 0 && (
          <>
            {' '}
            · <strong className="text-[#8a5a16]">{zone.enAttente} en attente d’une place</strong>
          </>
        )}
      </p>
    </article>
  );
}

function LigneAbonne({ abonnement }: { readonly abonnement: AbonnementAdministration }) {
  return (
    <tr className="border-b border-[#eceae6] last:border-0">
      <td className="px-4 py-2.5">
        <span className="font-medium">{abonnement.entreprise}</span>
        <span className="block text-[0.78rem] text-[#6b6b66]">
          depuis le {abonnement.debuteLe.toLocaleDateString('fr-FR')}
          {abonnement.engageJusquA !== null &&
            ` · engagé jusqu’au ${abonnement.engageJusquA.toLocaleDateString('fr-FR')}`}
        </span>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {abonnement.formule}
        <span className="text-[#6b6b66]"> · {abonnement.periodicite}</span>
        {abonnement.statut !== 'actif' && (
          <span className="ml-2 rounded-[4px] bg-[#f6e4e4] px-1.5 py-0.5 text-[0.65rem] font-bold text-[#8c1c1c]">
            {abonnement.statut}
          </span>
        )}
        {abonnement.souslaNoteMinimale && (
          <span
            title="Sous la note minimale : l’emplacement payé est suspendu tant qu’elle n’est pas remontée."
            className="ml-2 rounded-[4px] bg-[#fdf0e4] px-1.5 py-0.5 text-[0.65rem] font-bold text-[#8a5a16]"
          >
            place en sursis
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
        {abonnement.emplacements}
        {abonnement.emplacements === 0 &&
          (abonnement.formule === 'premium' || abonnement.formule === 'exclusif') && (
            <span className="ml-2 text-[0.78rem] text-[#8a5a16]">paie sans place attribuée</span>
          )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{euros(abonnement.prixMensuelHT)}</td>
    </tr>
  );
}
