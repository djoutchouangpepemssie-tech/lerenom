'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bouton, Carte } from '@lerenom/ui';
import { formatEuros } from '@lerenom/core';

/**
 * L'acceptation d'un devis par le client.
 *
 * Une confirmation précède le geste, et ce n'est pas une politesse : accepter engage à payer.
 * Le montant de l'acompte est redit à ce moment-là, parce que c'est la somme qui va
 * réellement être réclamée et qu'elle ne doit pas être une découverte.
 *
 * Ce que l'écran ne fait **pas** : proposer de refuser d'un clic. Un devis qu'on ne veut pas
 * se laisse expirer, ou se discute avec l'entreprise — un bouton « Refuser » transformerait
 * une négociation en fin de non-recevoir, et personne n'y gagnerait.
 */
export function AccepterDevis({
  jeton,
  acceptable,
  raisonRefus,
  acompteTTC,
}: {
  readonly jeton: string;
  readonly acceptable: boolean;
  readonly raisonRefus: string | null;
  readonly acompteTTC: number | null;
}) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  async function accepte(): Promise<void> {
    setEnCours(true);
    setRefus(null);
    try {
      const reponse = await fetch(`/api/devis/${jeton}/acceptation`, { method: 'POST' });
      if (reponse.ok) {
        router.refresh();
        return;
      }
      const corps = (await reponse.json()) as { erreur?: string };
      setRefus(corps.erreur ?? 'Ce devis n’a pas pu être accepté.');
    } catch {
      setRefus('Nous n’avons pas pu joindre nos serveurs.');
    } finally {
      setEnCours(false);
    }
  }

  if (!acceptable) {
    return (
      <Carte className="mt-6 p-5 sm:p-6">
        <p className="text-encre-70 text-sm">
          {raisonRefus ?? 'Ce devis ne peut plus être accepté en ligne.'}
        </p>
      </Carte>
    );
  }

  return (
    <Carte className="mt-6 p-5 sm:p-6">
      <p className="text-encre text-sm font-bold">Accepter ce devis</p>
      <p className="text-encre-70 mt-2 text-sm">
        En acceptant, vous commandez les travaux décrits ci-dessus.
        {acompteTTC !== null && ` Un acompte de ${formatEuros(acompteTTC)} vous sera demandé.`}
      </p>

      {refus !== null && (
        <p role="alert" className="text-alerte mt-3 text-sm font-semibold">
          {refus}
        </p>
      )}

      {confirme ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Bouton aspect="or" onClick={() => void accepte()} disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Oui, j’accepte ce devis'}
          </Bouton>
          <Bouton aspect="discret" onClick={() => setConfirme(false)} disabled={enCours}>
            Pas tout de suite
          </Bouton>
        </div>
      ) : (
        <Bouton aspect="or" className="mt-4" onClick={() => setConfirme(true)}>
          Accepter ce devis
        </Bouton>
      )}
    </Carte>
  );
}
