'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { BarrePuces, Liste, Puce } from '@lerenom/ui';

export interface ProprietesFiltres {
  readonly prestations: readonly { readonly slug: string; readonly nom: string }[];
  readonly comptes: {
    readonly urgence: number;
    readonly disponible: number;
    readonly bienNote: number;
    readonly partenaires: number;
    readonly decennale: number;
  };
}

const FILTRES = [
  { cle: 'urgence', libelle: 'Intervient en urgence' },
  { cle: 'dispo', libelle: 'Disponible aujourd’hui' },
  { cle: 'note', libelle: 'Note de 4,5 et plus' },
  { cle: 'partenaires', libelle: 'Partenaires Le Renom' },
  { cle: 'decennale', libelle: 'Décennale vérifiée' },
] as const;

const COMPTES: Record<(typeof FILTRES)[number]['cle'], keyof ProprietesFiltres['comptes']> = {
  urgence: 'urgence',
  dispo: 'disponible',
  note: 'bienNote',
  partenaires: 'partenaires',
  decennale: 'decennale',
};

/**
 * Les filtres de la page de résultats.
 *
 * Ils vivent dans l'adresse, pas dans l'état du composant : une recherche filtrée se partage,
 * se met en favori et survit au rechargement. C'est aussi ce qui permet au serveur de refaire
 * le classement avec les bons candidats — filtrer après coup laisserait un emplacement payé
 * occupé par une entreprise que le visiteur a justement écartée.
 *
 * Chaque puce affiche le nombre de professionnels qu'elle laisserait : un filtre qui vide la
 * page sans prévenir est une impasse.
 */
export function FiltresResultats({ prestations, comptes }: ProprietesFiltres) {
  const parametres = useSearchParams();
  const chemin = usePathname();
  const routeur = useRouter();
  const [enCours, demarre] = useTransition();

  function applique(modifications: Record<string, string | null>) {
    const suivants = new URLSearchParams(parametres.toString());
    for (const [cle, valeur] of Object.entries(modifications)) {
      if (valeur === null) suivants.delete(cle);
      else suivants.set(cle, valeur);
    }
    const requete = suivants.toString();
    demarre(() =>
      routeur.replace(requete === '' ? chemin : `${chemin}?${requete}`, { scroll: false }),
    );
  }

  const actifs = FILTRES.filter((f) => parametres.get(f.cle) === '1').length;
  const prestationActive = parametres.get('prestation');
  const tri = parametres.get('tri') ?? 'pertinence';

  return (
    <div aria-busy={enCours} className={enCours ? 'opacity-70 transition-opacity' : undefined}>
      <BarrePuces etiquette="Filtrer les professionnels">
        {FILTRES.map((filtre) => {
          const actif = parametres.get(filtre.cle) === '1';
          const compte = comptes[COMPTES[filtre.cle]];
          return (
            <Puce
              key={filtre.cle}
              active={actif}
              compte={compte}
              desactivee={compte === 0 && !actif}
              titre={
                compte === 0 && !actif
                  ? 'Aucun professionnel de cette page ne remplit ce critère.'
                  : undefined
              }
              onBascule={() => applique({ [filtre.cle]: actif ? null : '1' })}
            >
              {filtre.libelle}
            </Puce>
          );
        })}
      </BarrePuces>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        {prestations.length > 0 && (
          <Liste
            className="sm:max-w-xs"
            etiquette="Filtrer par prestation"
            value={prestationActive ?? ''}
            onChange={(evenement) =>
              applique({
                prestation: evenement.target.value === '' ? null : evenement.target.value,
              })
            }
          >
            <option value="">Toutes les prestations</option>
            {prestations.map((prestation) => (
              <option key={prestation.slug} value={prestation.slug}>
                {prestation.nom}
              </option>
            ))}
          </Liste>
        )}

        <Liste
          className="sm:max-w-[14rem]"
          etiquette="Trier le classement naturel"
          value={tri}
          onChange={(evenement) =>
            applique({
              tri: evenement.target.value === 'pertinence' ? null : evenement.target.value,
            })
          }
        >
          <option value="pertinence">Score de qualité</option>
          <option value="note">Les mieux notés</option>
          <option value="avis">Le plus d’avis</option>
        </Liste>

        {(actifs > 0 || prestationActive !== null || tri !== 'pertinence') && (
          <button
            type="button"
            onClick={() =>
              applique({
                urgence: null,
                dispo: null,
                note: null,
                partenaires: null,
                decennale: null,
                prestation: null,
                tri: null,
              })
            }
            className="text-encre-55 hover:text-or-fonce min-h-11 self-start text-sm font-semibold underline underline-offset-4 transition-colors sm:self-end"
          >
            Tout effacer
          </button>
        )}
      </div>

      {tri !== 'pertinence' && (
        <p className="text-encre-55 mt-3 text-xs">
          Le tri ne réordonne que le classement naturel : les emplacements payés gardent leur place,
          c’est ce qui a été vendu, et ils restent étiquetés « Sponsorisé ».
        </p>
      )}
    </div>
  );
}
