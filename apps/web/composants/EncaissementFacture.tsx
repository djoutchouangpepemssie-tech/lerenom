'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Enregistrer le paiement d'une facture, ou le défaire.
 *
 * **La date est modifiable, et par défaut c'est aujourd'hui.** Un virement se constate
 * rarement le jour où il arrive ; dater tous les encaissements du jour de la saisie fausserait
 * le suivi de trésorerie, qui est précisément ce qu'on vient chercher ici.
 *
 * **Se défaire d'un clic malheureux ne demande pas un avoir.** Le statut revient à « émise »,
 * la date s'efface, et rien d'autre ne bouge : les montants, le numéro et le RIB sont tenus
 * par la base, pas par cet écran.
 */

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EncaissementFacture({
  factureId,
  payeeLe,
}: {
  readonly factureId: string;
  readonly payeeLe: Date | null;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [date, setDate] = useState(aujourdhui());
  const [occupe, setOccupe] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  async function envoie(methode: 'POST' | 'DELETE'): Promise<void> {
    setOccupe(true);
    setRefus(null);
    try {
      const reponse = await fetch(`/api/pro/factures/${factureId}/paiement`, {
        method: methode,
        ...(methode === 'POST'
          ? {
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ payeeLe: date }),
            }
          : {}),
      });
      if (!reponse.ok) {
        const retour = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        setRefus(retour.erreur ?? 'Enregistrement impossible.');
        return;
      }
      setOuvert(false);
      router.refresh();
    } catch {
      setRefus('Le réseau n’a pas répondu. Réessayez.');
    } finally {
      setOccupe(false);
    }
  }

  const bouton =
    'rounded-[8px] border border-[#cfcfc9] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-[#16181D] disabled:opacity-50';

  if (payeeLe !== null) {
    return (
      <div>
        <p className="text-sm font-semibold text-[#2f6b47]">
          Payée le {payeeLe.toLocaleDateString('fr-FR')}
        </p>
        <button
          type="button"
          disabled={occupe}
          className={`${bouton} mt-2`}
          onClick={() => void envoie('DELETE')}
        >
          Ce n’était pas payé
        </button>
        {refus !== null && (
          <p role="alert" className="mt-2 text-sm font-semibold text-[#8c1c1c]">
            {refus}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {ouvert ? (
        <>
          <label htmlFor={`paiement-${factureId}`} className="block text-[0.8rem] font-semibold">
            Reçu le
          </label>
          <input
            id={`paiement-${factureId}`}
            type="date"
            value={date}
            max={aujourdhui()}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-[6px] border border-[#cfcfc9] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#16181D]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={occupe}
              className={`${bouton} border-[#16181D] bg-[#16181D] text-white`}
              onClick={() => void envoie('POST')}
            >
              Enregistrer le paiement
            </button>
            <button type="button" className={bouton} onClick={() => setOuvert(false)}>
              Annuler
            </button>
          </div>
        </>
      ) : (
        <button type="button" className={bouton} onClick={() => setOuvert(true)}>
          Marquer payée
        </button>
      )}
      {refus !== null && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[#8c1c1c]">
          {refus}
        </p>
      )}
    </div>
  );
}
