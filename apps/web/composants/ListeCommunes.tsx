'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BarrePuces, Champ, Puce, cn } from '@lerenom/ui';
import { nomVille } from '@/lib/affichage';

export interface CommuneListee {
  readonly code: string;
  readonly nom: string;
  readonly slug: string;
  readonly statut: 'ouvert' | 'bientot' | 'annuaire';
  readonly population: number | null;
  readonly codesPostaux: readonly string[];
}

const STATUTS = {
  ouvert: { libelle: 'Ouvert', classes: 'bg-succes-fond text-succes' },
  bientot: { libelle: 'Bientôt', classes: 'bg-alerte-fond text-alerte' },
  annuaire: { libelle: 'Annuaire', classes: 'bg-encre/[0.06] text-encre-55' },
} as const;

/** Sans accent et en minuscules : « Châtillon » se trouve en tapant « chatillon ». */
function normalise(texte: string): string {
  return texte.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * La liste complète des communes d'un département, cherchable, filtrable et triable.
 *
 * Avec 507 communes en Seine-et-Marne, une liste brute serait inutilisable : la recherche et le
 * filtre ne sont pas un agrément, ce sont eux qui rendent la page consultable.
 */
export function ListeCommunes({
  communes,
  className,
}: {
  readonly communes: readonly CommuneListee[];
  readonly className?: string;
}) {
  const [recherche, setRecherche] = useState('');
  const [statuts, setStatuts] = useState<readonly string[]>([]);
  const [tri, setTri] = useState<'population' | 'alphabetique'>('population');

  const filtrees = useMemo(() => {
    const requete = normalise(recherche.trim());

    const retenues = communes.filter((commune) => {
      if (statuts.length > 0 && !statuts.includes(commune.statut)) return false;
      if (requete === '') return true;
      return (
        normalise(commune.nom).includes(requete) ||
        commune.codesPostaux.some((code) => code.startsWith(requete))
      );
    });

    return [...retenues].sort((a, b) => {
      if (tri === 'alphabetique') return a.nom.localeCompare(b.nom, 'fr');
      return (b.population ?? 0) - (a.population ?? 0);
    });
  }, [communes, recherche, statuts, tri]);

  function basculeStatut(statut: string) {
    setStatuts((actuels) =>
      actuels.includes(statut) ? actuels.filter((s) => s !== statut) : [...actuels, statut],
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <Champ
          className="lg:max-w-sm"
          etiquette="Chercher une ville"
          placeholder="Nom de la ville ou code postal"
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
        />

        <BarrePuces etiquette="Filtrer par statut" className="lg:pb-1">
          {(['ouvert', 'bientot', 'annuaire'] as const).map((statut) => (
            <Puce
              key={statut}
              active={statuts.includes(statut)}
              onBascule={() => basculeStatut(statut)}
              compte={communes.filter((c) => c.statut === statut).length}
            >
              {STATUTS[statut].libelle}
            </Puce>
          ))}
        </BarrePuces>

        <BarrePuces etiquette="Trier" className="lg:ml-auto lg:pb-1">
          <Puce active={tri === 'population'} onBascule={() => setTri('population')}>
            Les plus peuplées
          </Puce>
          <Puce active={tri === 'alphabetique'} onBascule={() => setTri('alphabetique')}>
            De A à Z
          </Puce>
        </BarrePuces>
      </div>

      <p className="text-encre-55 mt-5 text-sm" aria-live="polite">
        {filtrees.length} {filtrees.length > 1 ? 'villes' : 'ville'} sur {communes.length}
      </p>

      {filtrees.length === 0 ? (
        <p className="border-bordure bg-creme text-encre-70 mt-6 rounded-[var(--radius-carte)] border p-6 text-sm">
          Aucune ville ne correspond. Essayez un autre nom, ou retirez un filtre.
        </p>
      ) : (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtrees.map((commune) => (
            <li key={commune.code}>
              <Link
                href={`/${commune.slug}`}
                className="border-bordure bg-carte hover:border-or flex min-h-12 items-center gap-3 rounded-[var(--radius-douce)] border px-4 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-encre block truncate text-sm font-semibold">
                    {nomVille(commune.nom)}
                  </span>
                  <span className="text-encre-40 block text-xs">
                    {commune.codesPostaux[0] ?? commune.code}
                    {commune.population !== null &&
                      ` · ${commune.population.toLocaleString('fr-FR')} hab.`}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold',
                    STATUTS[commune.statut].classes,
                  )}
                >
                  {STATUTS[commune.statut].libelle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
