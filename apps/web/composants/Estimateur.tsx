'use client';

import { useMemo, useState } from 'react';
import { Carte, Champ, Liste, cn } from '@lerenom/ui';

export interface PrestationEstimee {
  readonly slug: string;
  readonly nom: string;
  readonly unite: string;
  readonly minTTC: number;
  readonly maxTTC: number;
}

export interface MetierEstime {
  readonly slug: string;
  readonly nom: string;
  readonly tauxTva: number;
  readonly prestations: readonly PrestationEstimee[];
}

export interface UniversEstime {
  readonly slug: string;
  readonly nom: string;
  readonly couleur: string;
  readonly metiers: readonly MetierEstime[];
}

const LIBELLES_UNITE: Record<string, { court: string; question: string }> = {
  forfait: { court: 'forfait', question: 'Nombre d’interventions' },
  heure: { court: 'h', question: 'Nombre d’heures' },
  unite: { court: 'u', question: 'Quantité' },
  m2: { court: 'm²', question: 'Surface en m²' },
  ml: { court: 'ml', question: 'Longueur en mètres' },
  jour: { court: 'jour', question: 'Nombre de jours' },
};

/** Majoration constatée selon le délai souhaité. Une urgence se paie, et ça s'annonce. */
const DELAIS = [
  { cle: 'souple', libelle: 'Je ne suis pas pressé', facteur: 1 },
  { cle: 'semaine', libelle: 'Dans la semaine', facteur: 1.1 },
  { cle: 'urgent', libelle: 'En urgence, sous 2 heures', facteur: 1.45 },
] as const;

function formate(montant: number): string {
  return montant.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}

/**
 * L'estimateur du guide des prix.
 *
 * Il montre **le détail de son calcul**, et pas seulement un résultat. Une fourchette sortie
 * d'une boîte noire n'aide personne à discuter un devis ; une fourchette dont on voit le calcul,
 * si. Et il répète que seul un devis engage un professionnel.
 */
export function Estimateur({
  univers,
  className,
}: {
  readonly univers: readonly UniversEstime[];
  readonly className?: string;
}) {
  const [universSlug, setUniversSlug] = useState(univers[0]?.slug ?? '');
  const universCourant = univers.find((u) => u.slug === universSlug) ?? univers[0];

  const [metierSlug, setMetierSlug] = useState(universCourant?.metiers[0]?.slug ?? '');
  const metierCourant =
    universCourant?.metiers.find((m) => m.slug === metierSlug) ?? universCourant?.metiers[0];

  const [prestationSlug, setPrestationSlug] = useState(metierCourant?.prestations[0]?.slug ?? '');
  const prestation =
    metierCourant?.prestations.find((p) => p.slug === prestationSlug) ??
    metierCourant?.prestations[0];

  const [quantite, setQuantite] = useState('1');
  const [delai, setDelai] = useState<(typeof DELAIS)[number]['cle']>('souple');

  const estimation = useMemo(() => {
    if (prestation === undefined) return null;
    const nombre = Number(quantite.replace(',', '.'));
    if (!Number.isFinite(nombre) || nombre <= 0) return null;

    const facteur = DELAIS.find((d) => d.cle === delai)?.facteur ?? 1;
    return {
      base: { min: prestation.minTTC, max: prestation.maxTTC },
      quantite: nombre,
      facteur,
      min: prestation.minTTC * nombre * facteur,
      max: prestation.maxTTC * nombre * facteur,
    };
  }, [prestation, quantite, delai]);

  function changeUnivers(slug: string) {
    const nouveau = univers.find((u) => u.slug === slug);
    setUniversSlug(slug);
    const premierMetier = nouveau?.metiers[0];
    setMetierSlug(premierMetier?.slug ?? '');
    setPrestationSlug(premierMetier?.prestations[0]?.slug ?? '');
  }

  function changeMetier(slug: string) {
    const nouveau = universCourant?.metiers.find((m) => m.slug === slug);
    setMetierSlug(slug);
    setPrestationSlug(nouveau?.prestations[0]?.slug ?? '');
  }

  if (universCourant === undefined || metierCourant === undefined) return null;

  const unite = prestation !== undefined ? LIBELLES_UNITE[prestation.unite] : undefined;

  return (
    <Carte className={cn('p-5 md:p-7', className)}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Liste
          etiquette="Univers"
          value={universSlug}
          onChange={(e) => changeUnivers(e.target.value)}
        >
          {univers.map((u) => (
            <option key={u.slug} value={u.slug}>
              {u.nom}
            </option>
          ))}
        </Liste>

        <Liste etiquette="Métier" value={metierSlug} onChange={(e) => changeMetier(e.target.value)}>
          {universCourant.metiers.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.nom}
            </option>
          ))}
        </Liste>

        <Liste
          etiquette="Prestation"
          value={prestationSlug}
          onChange={(e) => setPrestationSlug(e.target.value)}
        >
          {metierCourant.prestations.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.nom}
            </option>
          ))}
        </Liste>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Champ
          etiquette={unite?.question ?? 'Quantité'}
          type="text"
          inputMode="decimal"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          aide={
            prestation !== undefined
              ? `Prix exprimé pour ${unite?.court ?? prestation.unite}`
              : undefined
          }
        />

        <Liste
          etiquette="Délai souhaité"
          value={delai}
          onChange={(e) => setDelai(e.target.value as (typeof DELAIS)[number]['cle'])}
        >
          {DELAIS.map((d) => (
            <option key={d.cle} value={d.cle}>
              {d.libelle}
            </option>
          ))}
        </Liste>

        <div className="flex items-end">
          <p className="text-encre-55 text-sm">
            TVA applicable à ce métier :{' '}
            <strong className="text-encre">{metierCourant.tauxTva} %</strong>. Le taux réel dépend
            de votre logement.
          </p>
        </div>
      </div>

      <div className="border-or/30 bg-or/[0.06] mt-6 rounded-[var(--radius-carte)] border p-5 md:p-6">
        {estimation === null ? (
          <p className="text-encre-70 text-sm">
            Indiquez une quantité pour obtenir une estimation.
          </p>
        ) : (
          <>
            <p className="text-or-fonce text-[0.68rem] font-bold tracking-[0.16em] uppercase">
              Fourchette estimée, TTC
            </p>
            <p className="text-encre mt-2 font-[family-name:var(--font-titre)] text-[clamp(2rem,5vw,3rem)] leading-none">
              {formate(estimation.min)} – {formate(estimation.max)} €
            </p>

            <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div className="border-or/15 flex justify-between gap-4 border-b pb-2">
                <dt className="text-encre-70">Prix constaté</dt>
                <dd className="text-encre font-semibold">
                  {formate(estimation.base.min)} – {formate(estimation.base.max)} € /{' '}
                  {unite?.court ?? ''}
                </dd>
              </div>
              <div className="border-or/15 flex justify-between gap-4 border-b pb-2">
                <dt className="text-encre-70">Quantité</dt>
                <dd className="text-encre font-semibold">
                  × {estimation.quantite.toLocaleString('fr-FR')}
                </dd>
              </div>
              <div className="border-or/15 flex justify-between gap-4 border-b pb-2">
                <dt className="text-encre-70">Majoration de délai</dt>
                <dd className="text-encre font-semibold">
                  × {estimation.facteur.toLocaleString('fr-FR')}
                </dd>
              </div>
              <div className="border-or/15 flex justify-between gap-4 border-b pb-2">
                <dt className="text-encre-70">TVA</dt>
                <dd className="text-encre font-semibold">{metierCourant.tauxTva} % (comprise)</dd>
              </div>
            </dl>

            <p className="text-encre-55 mt-5 text-xs leading-relaxed">
              Cette estimation est un repère, pas un prix. Elle ne tient compte ni de l’état réel du
              chantier, ni des accès, ni des fournitures choisies. Seul un devis détaillé engage un
              professionnel — et il est obligatoire avant toute intervention à domicile.
            </p>
          </>
        )}
      </div>
    </Carte>
  );
}
