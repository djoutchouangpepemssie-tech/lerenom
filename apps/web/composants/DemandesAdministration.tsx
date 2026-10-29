'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DemandeAdministration, EtatDemandes } from '@/lib/administration-demandes';

/**
 * Le centre de distribution.
 *
 * Trois listes, une seule visible à la fois, et le détail d'une demande **se déplie sur
 * place** plutôt que d'ouvrir une page. Celui qui surveille la distribution passe d'une
 * demande à l'autre ; lui faire perdre sa liste à chaque coup d'œil le ferait renoncer à
 * regarder.
 *
 * Le détail montre la cascade telle qu'elle est : chaque professionnel, son tour, son rang,
 * ce qu'il a fait et le temps qu'il lui reste. Savoir qu'une demande est « en distribution »
 * n'apprend rien ; savoir que trois pros l'ont reçue il y a deux heures sans l'ouvrir apprend
 * tout.
 */

type Onglet = 'en-cours' | 'sans-preneur' | 'a-classer';

const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  envoyee: 'envoyée',
  ouverte: 'ouverte',
  acceptee: 'acceptée',
  refusee: 'refusée',
  expiree: 'expirée',
  retiree: 'retirée',
};

/** « dans 42 min », « il y a 3 h » — un délai se lit mieux qu'une heure. */
function delai(date: Date, maintenant: number): string {
  const minutes = Math.round((date.getTime() - maintenant) / 60_000);
  const passe = minutes < 0;
  const absolu = Math.abs(minutes);
  const quantite =
    absolu < 60
      ? `${String(absolu)} min`
      : absolu < 2880
        ? `${String(Math.round(absolu / 60))} h`
        : `${String(Math.round(absolu / 1440))} j`;
  return passe ? `il y a ${quantite}` : `dans ${quantite}`;
}

export function DemandesAdministration({
  etat,
  metiers,
}: {
  readonly etat: EtatDemandes;
  readonly metiers: readonly { readonly id: string; readonly nom: string }[];
}) {
  const [onglet, setOnglet] = useState<Onglet>(etat.aClasser.length > 0 ? 'a-classer' : 'en-cours');
  const [depliee, setDepliee] = useState<string | null>(null);

  const onglets = [
    { cle: 'en-cours' as const, libelle: 'En cours', nombre: etat.enCours.length },
    { cle: 'sans-preneur' as const, libelle: 'Sans preneur', nombre: etat.sansPreneur.length },
    { cle: 'a-classer' as const, libelle: 'À classer', nombre: etat.aClasser.length },
  ];

  const liste =
    onglet === 'en-cours'
      ? etat.enCours
      : onglet === 'sans-preneur'
        ? etat.sansPreneur
        : etat.aClasser;

  return (
    <>
      <div role="tablist" aria-label="Files de demandes" className="mt-6 flex flex-wrap gap-1">
        {onglets.map((candidat) => (
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
            <span className="ml-2 text-xs font-bold tabular-nums">{candidat.nombre}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {liste.map((demande) => (
          <Carte
            key={demande.id}
            demande={demande}
            onglet={onglet}
            metiers={metiers}
            depliee={depliee === demande.id}
            basculer={() => setDepliee(depliee === demande.id ? null : demande.id)}
          />
        ))}
        {liste.length === 0 && (
          <p className="rounded-[12px] border border-[#dcdcd8] bg-white px-4 py-8 text-center text-sm text-[#6b6b66] italic">
            {onglet === 'sans-preneur'
              ? 'Aucune demande n’est restée sans preneur. C’est la seule liste qu’on espère vide.'
              : onglet === 'a-classer'
                ? 'Le classement automatique s’en est sorti seul sur tout ce qui est arrivé.'
                : 'Aucune demande en distribution en ce moment.'}
          </p>
        )}
      </div>
    </>
  );
}

function Carte({
  demande,
  onglet,
  metiers,
  depliee,
  basculer,
}: {
  readonly demande: DemandeAdministration;
  readonly onglet: Onglet;
  readonly metiers: readonly { readonly id: string; readonly nom: string }[];
  readonly depliee: boolean;
  readonly basculer: () => void;
}) {
  const router = useRouter();
  const maintenant = Date.now();
  const [metierChoisi, setMetierChoisi] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  async function classe(): Promise<void> {
    setEnCours(true);
    setRefus(null);
    try {
      const reponse = await fetch('/api/administration/demandes', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ demandeId: demande.id, metierId: metierChoisi }),
      });
      if (!reponse.ok) {
        const retour = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(retour.erreur ?? 'Classement impossible.');
        return;
      }
      router.refresh();
    } catch {
      setRefus('Le réseau n’a pas répondu. Réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <article className="rounded-[12px] border border-[#dcdcd8] bg-white">
      <button
        type="button"
        onClick={basculer}
        aria-expanded={depliee}
        className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 text-left"
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-xs text-[#8a8a83]">{demande.reference}</span>
          <span className="font-semibold">{demande.metier ?? 'Métier non déterminé'}</span>
          <span className="text-sm text-[#6b6b66]">{demande.commune}</span>
          {demande.urgence !== 'normale' && (
            <span className="rounded-[4px] bg-[#fdf0e4] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#8a5a16]">
              {demande.urgence}
            </span>
          )}
          {!demande.telephoneVerifie && (
            <span className="rounded-[4px] bg-[#eceae6] px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-[#5c5c56]">
              mobile non vérifié
            </span>
          )}
        </span>
        <span className="flex items-center gap-4 text-sm text-[#6b6b66]">
          <span>
            {demande.acceptees} / {demande.objectifPros} accepté
            {demande.acceptees > 1 ? 's' : ''}
          </span>
          <span>déposée {delai(demande.deposeeLe, maintenant)}</span>
          <span aria-hidden>{depliee ? '▴' : '▾'}</span>
        </span>
      </button>

      {depliee && (
        <div className="border-t border-[#eceae6] px-4 py-3">
          {onglet === 'a-classer' && (
            <div className="mb-4 rounded-[8px] border border-[#e8dcc4] bg-[#fdfaf3] p-3">
              <p className="text-sm font-bold">Classer cette demande</p>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-[#5c5444]">
                {/* Le signalement d'un professionnel passe avant le score de la machine :
                    elle doute, lui sait. C'est le meilleur signal de mauvais classement qui
                    existe, et il n'était lu par personne. */}
                {demande.signaleeHorsMetier ? (
                  <strong>
                    Un professionnel a refusé cette demande en indiquant que ce n’est pas son
                    métier.
                  </strong>
                ) : demande.confiance === null ? (
                  'Le classement automatique n’a trouvé aucun métier.'
                ) : (
                  `Le classement automatique hésite : ${Math.round(demande.confiance * 100)} % de confiance.`
                )}{' '}
                Une demande mal classée part aux mauvais professionnels, qui la refusent.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={metierChoisi}
                  aria-label="Métier à attribuer"
                  onChange={(e) => setMetierChoisi(e.target.value)}
                  className="rounded-[8px] border border-[#cfcfc9] bg-white px-3 py-1.5 text-sm"
                >
                  <option value="">Choisir un métier…</option>
                  {metiers.map((metier) => (
                    <option key={metier.id} value={metier.id}>
                      {metier.nom}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={metierChoisi === '' || enCours}
                  onClick={() => void classe()}
                  className="rounded-[6px] border border-[#16181D] bg-[#16181D] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {enCours ? 'Enregistrement…' : 'Classer'}
                </button>
              </div>
              <p className="mt-2 text-[0.75rem] text-[#6b6b66]">
                Classer ne relance pas la distribution : renvoyer une demande déjà partie à trois
                professionnels en dérangerait trois autres et doublerait la facture.
              </p>
              {refus !== null && (
                <p role="alert" className="mt-2 text-sm font-medium text-[#8c1c1c]">
                  {refus}
                </p>
              )}
            </div>
          )}

          <p className="text-[0.68rem] font-bold tracking-[0.14em] text-[#6b6b66] uppercase">
            Professionnels sollicités
          </p>

          {demande.pros.length === 0 ? (
            <p className="mt-2 text-sm text-[#6b6b66] italic">
              Aucun professionnel n’a encore été sollicité.
            </p>
          ) : (
            // Le tableau défile dans son cadre plutôt que de pousser la page : six colonnes
            // ne tiennent pas dans 390 px, et un débordement de la page entière décale tout
            // le reste de l'écran, pas seulement le tableau.
            <div className="-mx-1 mt-2 overflow-x-auto px-1">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[#6b6b66]">
                    <th className="py-1 font-semibold">Entreprise</th>
                    <th className="py-1 font-semibold whitespace-nowrap">Tour · rang</th>
                    <th className="py-1 font-semibold">État</th>
                    <th className="py-1 font-semibold whitespace-nowrap">Ouverte</th>
                    <th className="py-1 font-semibold whitespace-nowrap">Échéance</th>
                    <th className="py-1 text-right font-semibold whitespace-nowrap">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {demande.pros.map((pro) => {
                    const expiree =
                      pro.repondueLe === null && pro.echeanceLe.getTime() < maintenant;
                    return (
                      <tr
                        key={`${String(pro.tour)}-${String(pro.rang)}`}
                        className="border-t border-[#f0eeea]"
                      >
                        <td className="py-1.5 pr-3">
                          {pro.entreprise}
                          {pro.manuel && (
                            <span className="ml-2 text-[0.65rem] font-bold text-[#6b6b66]">
                              envoi manuel
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 whitespace-nowrap tabular-nums">
                          {pro.tour} · {pro.rang}
                        </td>
                        <td
                          className={`py-1.5 ${
                            pro.statut === 'acceptee'
                              ? 'font-semibold text-[#1f6633]'
                              : pro.statut === 'refusee' || pro.statut === 'expiree'
                                ? 'text-[#8c1c1c]'
                                : ''
                          }`}
                        >
                          {LIBELLE_STATUT[pro.statut] ?? pro.statut}
                        </td>
                        <td className="py-1.5 whitespace-nowrap text-[#6b6b66]">
                          {pro.ouverteLe === null ? '—' : delai(pro.ouverteLe, maintenant)}
                        </td>
                        <td
                          className={`py-1.5 whitespace-nowrap ${expiree ? 'text-[#8c1c1c]' : 'text-[#6b6b66]'}`}
                        >
                          {pro.repondueLe !== null ? '—' : delai(pro.echeanceLe, maintenant)}
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap text-[#6b6b66] tabular-nums">
                          {pro.distanceKm === null ? '—' : `${pro.distanceKm.toFixed(1)} km`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-[0.75rem] text-[#6b6b66]">
            Client : {demande.client}
            {demande.prestation !== null && ` · ${demande.prestation}`}
            {demande.classeeParAdmin && ' · classée à la main'}
          </p>
        </div>
      )}
    </article>
  );
}
