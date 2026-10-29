'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ZoneDuPro } from '@/lib/liste-attente-pro';

/**
 * Mes zones payantes, et les listes d'attente.
 *
 * **Les zones complètes d'abord.** Ce sont les seules où il y a quelque chose à décider : une
 * zone où tout est libre n'appelle pas une attente, elle appelle un achat.
 *
 * **Le rang est annoncé en clair**, parce que c'est la seule chose que le professionnel veut
 * savoir. « Vous êtes inscrit » ne dit rien ; « deuxième sur trois » dit s'il faut espérer.
 *
 * **Rien n'est facturé ici et l'écran le répète.** Une liste d'attente qui ressemble à un
 * tunnel d'achat fait renoncer ceux qui n'ont pas encore décidé — et ce sont justement eux
 * qu'on veut compter.
 */

export function MesZonesPayees({ zones }: { readonly zones: readonly ZoneDuPro[] }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  async function agit(
    zone: ZoneDuPro,
    formule: 'premium' | 'exclusif',
    action: 'rejoindre' | 'quitter',
  ): Promise<void> {
    const cle = `${zone.metierId}-${zone.communeCode}-${formule}`;
    setEnCours(cle);
    setRefus(null);
    try {
      const reponse = await fetch('/api/pro/liste-attente', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          metierId: zone.metierId,
          communeId: zone.communeCode,
          formule,
        }),
      });
      if (!reponse.ok) {
        const retour = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(retour.erreur ?? 'Action impossible.');
        return;
      }
      router.refresh();
    } catch {
      setRefus('Le réseau n’a pas répondu. Réessayez.');
    } finally {
      setEnCours(null);
    }
  }

  if (zones.length === 0) {
    return (
      <p className="text-encre-70 mt-6 max-w-[62ch]">
        Votre périmètre est vide : ajoutez un métier et une ville pour voir les places disponibles.
      </p>
    );
  }

  return (
    <>
      {refus !== null && (
        <p role="alert" className="mt-4 text-sm font-semibold text-[#8c1c1c]">
          {refus}
        </p>
      )}
      <div className="mt-6 space-y-4">
        {zones.map((zone) => (
          <Zone
            key={`${zone.metierId}-${zone.communeCode}`}
            zone={zone}
            enCours={enCours}
            agit={agit}
          />
        ))}
      </div>
    </>
  );
}

function Zone({
  zone,
  enCours,
  agit,
}: {
  readonly zone: ZoneDuPro;
  readonly enCours: string | null;
  readonly agit: (
    zone: ZoneDuPro,
    formule: 'premium' | 'exclusif',
    action: 'rejoindre' | 'quitter',
  ) => Promise<void>;
}) {
  const bouton =
    'rounded-[8px] border border-[#cfcfc9] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-[#16181D] disabled:opacity-50';
  const placesPremiumLibres = Math.max(0, zone.premiumMax - zone.premiumVendus);

  return (
    <article className="rounded-[12px] border border-[#dcdcd8] bg-white p-4">
      <h2 className="font-semibold">
        {zone.metier} · {zone.commune}
      </h2>
      {zone.maPlace !== null && (
        <p className="mt-1 text-[0.82rem] font-semibold text-[#2c5733]">
          Vous détenez ici {zone.maPlace === 'exclusif' ? 'la place Exclusif' : 'une place Premium'}
          .
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Place
          titre="Exclusif"
          explication="La première place, et la seule. Engagement de douze mois."
          libres={zone.exclusifPris ? 0 : 1}
          total={1}
          monRang={zone.monRangExclusif}
          enAttente={zone.enAttenteExclusif}
          jeLaDetiens={zone.maPlace === 'exclusif'}
          occupe={enCours === `${zone.metierId}-${zone.communeCode}-exclusif`}
          bouton={bouton}
          rejoindre={() => void agit(zone, 'exclusif', 'rejoindre')}
          quitter={() => void agit(zone, 'exclusif', 'quitter')}
        />
        <Place
          titre="Premium"
          explication={`Six places au plus, dont deux s’affichent à la fois : chacune obtient donc sa part des affichages.`}
          libres={placesPremiumLibres}
          total={zone.premiumMax}
          monRang={zone.monRangPremium}
          enAttente={zone.enAttentePremium}
          jeLaDetiens={zone.maPlace === 'premium'}
          occupe={enCours === `${zone.metierId}-${zone.communeCode}-premium`}
          bouton={bouton}
          rejoindre={() => void agit(zone, 'premium', 'rejoindre')}
          quitter={() => void agit(zone, 'premium', 'quitter')}
        />
      </div>
    </article>
  );
}

function Place({
  titre,
  explication,
  libres,
  total,
  monRang,
  enAttente,
  jeLaDetiens,
  occupe,
  bouton,
  rejoindre,
  quitter,
}: {
  readonly titre: string;
  readonly explication: string;
  readonly libres: number;
  readonly total: number;
  readonly monRang: number | null;
  readonly enAttente: number;
  readonly jeLaDetiens: boolean;
  readonly occupe: boolean;
  readonly bouton: string;
  readonly rejoindre: () => void;
  readonly quitter: () => void;
}) {
  return (
    <div className="rounded-[10px] bg-[#f6f5f2] p-3">
      <p className="text-[0.68rem] font-bold tracking-[0.12em] text-[#6b6b66] uppercase">{titre}</p>
      <p className="mt-1 text-[0.8rem] leading-relaxed text-[#45453f]">{explication}</p>

      {jeLaDetiens ? (
        <p className="mt-2 text-[0.82rem] font-semibold">Vous l’occupez.</p>
      ) : libres > 0 ? (
        <p className="mt-2 text-[0.82rem]">
          <span className="font-semibold">
            {libres} place{libres > 1 ? 's' : ''} libre{libres > 1 ? 's' : ''}
          </span>{' '}
          sur {total}. Écrivez-nous pour la prendre.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[0.82rem]">
            <span className="font-semibold">Complet</span> ·{' '}
            {enAttente === 0 ? 'personne n’attend' : `${enAttente} en attente`}
          </p>
          {monRang === null ? (
            <>
              <button
                type="button"
                disabled={occupe}
                className={`${bouton} mt-2`}
                onClick={rejoindre}
              >
                Me prévenir si une place se libère
              </button>
              <p className="mt-1.5 text-[0.75rem] text-[#6b6b66]">
                Sans engagement et sans frais : vous serez prévenu, c’est vous qui déciderez.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[0.82rem] font-semibold">
                Vous êtes {monRang}
                <sup>{monRang === 1 ? 'er' : 'e'}</sup> sur {enAttente}.
              </p>
              <button
                type="button"
                disabled={occupe}
                className={`${bouton} mt-2`}
                onClick={quitter}
              >
                Me retirer de la liste
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
