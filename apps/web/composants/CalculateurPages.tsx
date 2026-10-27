'use client';

import { useState } from 'react';
import { Carte, Champ, cn } from '@lerenom/ui';
import { FORMULES, REGLES_VALIDEES, formatEuros, nombreDePages } from '@lerenom/core';

/**
 * « Combien de pages pour ma formule ? »
 *
 * Le calcul vient de `nombreDePages` dans `packages/core`, la même fonction que celle qui affiche
 * le compteur pendant l'inscription : un professionnel ne doit pas découvrir un autre chiffre
 * après avoir payé.
 */
export function CalculateurPages({ className }: { readonly className?: string }) {
  const [metiers, setMetiers] = useState('2');
  const [villesVoulues, setVillesVoulues] = useState('8');

  const nombreMetiers = Math.max(1, Math.min(69, Number(metiers) || 1));
  const villes = Math.max(1, Math.min(1285, Number(villesVoulues) || 1));

  const conseillee =
    FORMULES.find((formule) => {
      const limite = REGLES_VALIDEES.villesMax[formule];
      return limite === null || villes <= limite;
    }) ?? 'exclusif';

  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        <Champ
          etiquette="Combien de métiers exercez-vous ?"
          type="number"
          min={1}
          max={69}
          value={metiers}
          onChange={(evenement) => setMetiers(evenement.target.value)}
        />
        <Champ
          etiquette="Dans combien de villes ?"
          type="number"
          min={1}
          max={1285}
          value={villesVoulues}
          onChange={(evenement) => setVillesVoulues(evenement.target.value)}
        />
      </div>

      <ul className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {FORMULES.map((formule) => {
          const limite = REGLES_VALIDEES.villesMax[formule];
          const villesCouvertes = limite === null ? villes : Math.min(villes, limite);
          const pages = nombreDePages(villesCouvertes, nombreMetiers);
          const suffisante = limite === null || villes <= limite;
          const estConseillee = formule === conseillee;

          return (
            <li key={formule}>
              <Carte
                liseréOr={estConseillee}
                className={cn('h-full p-5', !suffisante && 'opacity-70')}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg capitalize">{formule}</h3>
                  {estConseillee && (
                    <span className="bg-or/20 text-or-fonce rounded-full px-2 py-0.5 text-[0.65rem] font-bold">
                      Conseillée
                    </span>
                  )}
                </div>

                <p className="text-encre mt-4 font-[family-name:var(--font-titre)] text-3xl">
                  {pages.toLocaleString('fr-FR')}
                </p>
                <p className="text-encre-55 text-sm">
                  {pages > 1 ? 'pages' : 'page'} où vous apparaissez
                </p>

                <p className="text-encre-70 mt-4 text-xs">
                  {limite === null
                    ? `Vos ${villes} villes × ${nombreMetiers} métiers`
                    : suffisante
                      ? `Vos ${villes} villes × ${nombreMetiers} métiers`
                      : `Limité à ${limite} villes sur les ${villes} souhaitées`}
                </p>

                <p className="border-bordure text-encre mt-3 border-t pt-3 text-sm font-semibold">
                  {formatEuros(REGLES_VALIDEES.prixMensuelHT[formule])} HT / mois
                </p>
              </Carte>
            </li>
          );
        })}
      </ul>

      <p className="text-encre-55 mt-5 text-sm">
        En descente de formule, vous choisissez les villes que vous gardez. Par défaut, nous
        conservons d’abord celle de votre siège, puis les villes ouvertes aux demandes, puis celles
        qui ouvrent bientôt, et enfin celles d’annuaire.
      </p>
    </div>
  );
}
