'use client';

import { useState } from 'react';
import { Bouton, MentionSponsorise, Modale, cn } from '@lerenom/ui';
import { expliqueRang } from '@lerenom/core';
import type { RaisonRang } from '@lerenom/core';

/**
 * Le bouton « Pourquoi ce résultat ? » et son explication.
 *
 * Le texte vient de `expliqueRang` dans `packages/core` : il est écrit une seule fois, et c'est
 * le même mot pour mot sur la page de résultats, sur la page ville et dans la page publique
 * « Comment nous classons ». Une transparence qui varie selon l'écran n'en est pas une.
 */
export function ExplicationRang({
  raison,
  sombre = false,
}: {
  readonly raison: RaisonRang;
  readonly sombre?: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);
  const sponsorise = raison !== 'classement-naturel';

  return (
    <>
      {sponsorise ? (
        <MentionSponsorise
          className={cn(
            sombre &&
              '[&_span]:border-creme/20 [&_span]:bg-creme/10 [&_span]:text-creme/80 [&_button]:text-creme/65',
          )}
          onPourquoi={() => setOuverte(true)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOuverte(true)}
          className="text-encre-55 hover:text-or-fonce text-[0.7rem] font-semibold underline decoration-dotted underline-offset-2 transition-colors"
        >
          Pourquoi ce résultat ?
        </button>
      )}

      <Modale
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        titre="Pourquoi ce résultat ?"
        largeur="large"
        actions={
          <Bouton aspect="contour" onClick={() => setOuverte(false)}>
            J’ai compris
          </Bouton>
        }
      >
        <p className="text-encre-70">
          {expliqueRang({ entrepriseId: '', rang: 0, sponsorise, raison })}
        </p>
      </Modale>
    </>
  );
}
