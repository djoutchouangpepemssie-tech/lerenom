'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bouton, Carte } from '@lerenom/ui';

/**
 * L'émission d'une facture.
 *
 * Une confirmation précède le geste, et ce n'est pas une politesse : émettre attribue un
 * numéro définitif et rend le document immuable. On ne revient pas dessus, on émet un avoir.
 */
export function BoutonEmission({ factureId }: { readonly factureId: string }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  async function emet(): Promise<void> {
    setEnCours(true);
    setRefus(null);
    try {
      const reponse = await fetch(`/api/pro/factures/${factureId}/emission`, { method: 'POST' });
      if (reponse.ok) {
        router.refresh();
        return;
      }
      const corps = (await reponse.json()) as { erreur?: string };
      setRefus(corps.erreur ?? 'Cette facture n’a pas pu être émise.');
    } catch {
      setRefus('Nous n’avons pas pu joindre nos serveurs.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Carte className="p-5">
      <p className="text-encre text-sm font-bold">Émettre cette facture</p>
      <p className="text-encre-70 mt-2 text-sm">
        Elle recevra son numéro définitif et deviendra immuable. Une erreur se corrigera par un
        avoir, jamais par une modification.
      </p>

      {refus !== null && (
        <p role="alert" className="text-alerte mt-3 text-sm font-semibold">
          {refus}
        </p>
      )}

      {confirme ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Bouton aspect="or" onClick={() => void emet()} disabled={enCours}>
            {enCours ? 'Émission…' : 'Oui, émettre'}
          </Bouton>
          <Bouton aspect="discret" onClick={() => setConfirme(false)} disabled={enCours}>
            Annuler
          </Bouton>
        </div>
      ) : (
        <Bouton aspect="or" className="mt-4" onClick={() => setConfirme(true)}>
          Émettre la facture
        </Bouton>
      )}
    </Carte>
  );
}
