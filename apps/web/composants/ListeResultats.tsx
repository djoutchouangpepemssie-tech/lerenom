'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Apparition, BarreCollante, Bouton, cn } from '@lerenom/ui';
import { REGLES_VALIDEES } from '@lerenom/core';
import type { ProAffiche } from '@/lib/donnees';
import { CarteResultat } from './CarteResultat';

/**
 * La liste de résultats et la sélection de professionnels.
 *
 * Le visiteur coche jusqu'à **3 professionnels** — la limite est celle de la règle validée, pas
 * un choix d'interface — et la barre collante lui dit combien il en a choisi. Son choix passe
 * avant l'algorithme de distribution : c'est écrit noir sur blanc sous la barre, parce qu'un
 * visiteur qui sélectionne lui-même doit savoir que sa sélection est respectée.
 */
/**
 * Compte l'ouverture d'une fiche depuis les résultats.
 *
 * Muet par construction : le visiteur part sur une autre page, lui signaler l'échec d'un
 * compteur n'aurait aucun sens. `sendBeacon` est fait pour cela — la requête part même si la
 * page se ferme dans la foulée.
 */
function compteOuverture(entrepriseId: string, metierId: string, communeId: string): void {
  try {
    const corps = JSON.stringify({ entrepriseId, type: 'fiche', metierId, communeId });
    navigator.sendBeacon('/api/mesure/clic', new Blob([corps], { type: 'application/json' }));
  } catch {
    // Un compteur perdu n'est pas une page cassée.
  }
}

export function ListeResultats({
  pros,
  dernierRangSponsorise,
  metierSlug,
  communeSlug,
  metierId,
  communeId,
}: {
  readonly pros: readonly ProAffiche[];
  readonly dernierRangSponsorise: number;
  readonly metierSlug: string;
  readonly communeSlug: string;
  readonly metierId: string;
  readonly communeId: string;
}) {
  const [selection, setSelection] = useState<readonly string[]>([]);
  const maximum = REGLES_VALIDEES.prosMaxParDemande;

  function bascule(slug: string) {
    setSelection((actuels) => {
      if (actuels.includes(slug)) return actuels.filter((s) => s !== slug);
      if (actuels.length >= maximum) return actuels;
      return [...actuels, slug];
    });
  }

  const lien =
    selection.length === 0
      ? `/demande?metier=${metierSlug}&ville=${communeSlug}`
      : `/demande?metier=${metierSlug}&ville=${communeSlug}&pros=${selection.join(',')}`;

  return (
    <>
      <ol className="space-y-3">
        {pros.map((pro, index) => {
          const choisi = selection.includes(pro.slug);
          const pleine = selection.length >= maximum && !choisi;

          return (
            <li key={pro.id}>
              {index === dernierRangSponsorise && dernierRangSponsorise > 0 && (
                <div className="mb-4 flex items-center gap-4">
                  <span className="bg-bordure h-px flex-1" />
                  <span className="text-encre-55 text-[0.7rem] font-bold tracking-[0.16em] uppercase">
                    Classement naturel
                  </span>
                  <span className="bg-bordure h-px flex-1" />
                </div>
              )}

              <Apparition index={Math.min(index, 8)}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => bascule(pro.slug)}
                    disabled={pleine}
                    aria-pressed={choisi}
                    title={
                      pleine
                        ? `Vous avez déjà choisi ${maximum} professionnels, le maximum par demande.`
                        : choisi
                          ? `Retirer ${pro.nom} de votre sélection`
                          : `Ajouter ${pro.nom} à votre sélection`
                    }
                    className={cn(
                      'mt-5 flex size-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                      choisi
                        ? 'border-or bg-or text-encre'
                        : pleine
                          ? 'border-bordure cursor-not-allowed opacity-40'
                          : 'border-bordure hover:border-or',
                    )}
                  >
                    {choisi && (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 12 12"
                        className="size-3.5 fill-none stroke-current stroke-[2]"
                      >
                        <path
                          d="M2 6.4l2.6 2.6L10 3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    <span className="sr-only">
                      {choisi ? 'Sélectionné' : 'Sélectionner'} {pro.nom}
                    </span>
                  </button>

                  {/* `onClickCapture` plutôt qu'un gestionnaire sur le lien : la carte en
                      contient plusieurs, et compter une ouverture de fiche ne dépend pas de
                      celui qu'on a touché. `sendBeacon` survit à la navigation — un `fetch`
                      ordinaire serait annulé au moment même où le clic compte. */}
                  <div
                    className="min-w-0 flex-1"
                    onClickCapture={() => compteOuverture(pro.id, metierId, communeId)}
                  >
                    <CarteResultat pro={pro} index={index} />
                  </div>
                </div>
              </Apparition>
            </li>
          );
        })}
      </ol>

      <BarreCollante className="mt-6">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-encre truncate text-sm font-bold">
              {selection.length === 0
                ? `Choisissez jusqu’à ${maximum} professionnels`
                : `${selection.length} sur ${maximum} ${selection.length > 1 ? 'sélectionnés' : 'sélectionné'}`}
            </p>
            <p className="text-encre-55 truncate text-xs">
              {selection.length === 0
                ? 'Ou laissez-nous choisir : votre demande partira aux mieux placés.'
                : 'Votre choix passe avant notre algorithme de distribution.'}
            </p>
          </div>
          <Link href={lien} className="shrink-0">
            <Bouton aspect="or">
              {selection.length === 0
                ? 'Demander un devis'
                : `Demander ${selection.length > 1 ? 'des devis' : 'un devis'}`}
            </Bouton>
          </Link>
        </div>
      </BarreCollante>
    </>
  );
}
