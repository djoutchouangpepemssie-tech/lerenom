'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bouton, Carte } from '@lerenom/ui';
import { MOTIF_LONGUEUR_MINIMALE, formatEuros } from '@lerenom/core';

/**
 * L'émission d'un avoir sur une facture.
 *
 * Le formulaire ne s'ouvre pas de lui-même : corriger une facture est un geste rare, et un
 * champ de saisie posé en permanence sous un document comptable invite à le modifier. Il faut
 * le demander.
 *
 * Les erreurs s'affichent toutes ensemble, par champ. Le montant est pré-rempli avec ce qui
 * reste à créditer — le cas le plus fréquent est l'annulation complète — mais reste
 * modifiable : un avoir partiel est tout aussi légitime.
 */

interface AvoirExistant {
  readonly id: string;
  readonly numero: string;
  readonly motif: string;
  readonly montantTTC: number;
  readonly emisLe: Date;
}

export function FormulaireAvoir({
  factureId,
  resteACrediterTTC,
  avoirs,
}: {
  readonly factureId: string;
  readonly resteACrediterTTC: number;
  readonly avoirs: readonly AvoirExistant[];
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  // Avec une virgule : c'est ainsi que le montant s'écrit partout ailleurs sur cette page,
  // et un champ pré-rempli « 325.26 » invite à croire que le point est attendu.
  const [montant, setMontant] = useState(resteACrediterTTC.toFixed(2).replace('.', ','));
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [problemes, setProblemes] = useState<readonly { champ: string; message: string }[]>([]);

  const toutCredite = resteACrediterTTC <= 0;

  function messagePour(champ: string): string | undefined {
    return problemes.find((probleme) => probleme.champ === champ)?.message;
  }

  async function emet(): Promise<void> {
    setEnCours(true);
    setProblemes([]);
    try {
      const reponse = await fetch(`/api/pro/factures/${factureId}/avoir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // La virgule décimale est ce que tape un francophone ; le point est ce que lit
        // `Number`. Convertir ici évite un « indiquez le montant » incompréhensible.
        body: JSON.stringify({ montantTTC: Number(montant.replace(',', '.')), motif }),
      });
      if (reponse.ok) {
        setOuvert(false);
        setMotif('');
        router.refresh();
        return;
      }
      const corps = (await reponse.json()) as {
        problemes?: readonly { champ: string; message: string }[];
      };
      setProblemes(
        corps.problemes ?? [{ champ: 'facture', message: 'Cet avoir n’a pas pu être émis.' }],
      );
    } catch {
      setProblemes([{ champ: 'facture', message: 'Nous n’avons pas pu joindre nos serveurs.' }]);
    } finally {
      setEnCours(false);
    }
  }

  const erreurGenerale = messagePour('facture');
  const erreurMontant = messagePour('montantTTC');
  const erreurMotif = messagePour('motif');

  return (
    <Carte className="p-5">
      <p className="text-encre text-sm font-bold">
        {avoirs.length === 0 ? 'Corriger par un avoir' : 'Avoirs sur cette facture'}
      </p>

      {avoirs.length > 0 && (
        <ul className="mt-3 space-y-3">
          {avoirs.map((avoir) => (
            <li key={avoir.id} className="border-bordure border-l-2 pl-3">
              <p className="text-encre text-sm font-semibold">
                {avoir.numero} · −{formatEuros(avoir.montantTTC)}
              </p>
              <p className="text-encre-70 mt-0.5 text-xs">{avoir.motif}</p>
            </li>
          ))}
        </ul>
      )}

      {toutCredite ? (
        <p className="text-encre-70 mt-3 text-sm">
          Cette facture est entièrement créditée : elle est annulée, et reste au livre avec ses
          avoirs en face.
        </p>
      ) : (
        <p className="text-encre-70 mt-3 text-sm">
          Une facture émise ne se modifie pas. L’avoir constate ce que vous devez à votre client et
          porte son propre numéro ; la facture d’origine reste telle qu’elle lui a été remise. Reste
          à créditer : {formatEuros(resteACrediterTTC)}.
        </p>
      )}

      {erreurGenerale !== undefined && (
        <p role="alert" className="text-alerte mt-3 text-sm font-semibold">
          {erreurGenerale}
        </p>
      )}

      {!toutCredite &&
        (ouvert ? (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="avoir-montant" className="text-encre block text-sm font-semibold">
                Montant à créditer (TTC)
              </label>
              <input
                id="avoir-montant"
                type="text"
                inputMode="decimal"
                value={montant}
                onChange={(evenement) => setMontant(evenement.target.value)}
                aria-invalid={erreurMontant !== undefined}
                aria-describedby={erreurMontant === undefined ? undefined : 'avoir-montant-erreur'}
                className="border-bordure bg-papier text-encre focus:border-or mt-1.5 w-full rounded-[var(--radius-douce)] border px-3 py-2 text-sm outline-none"
              />
              {erreurMontant !== undefined && (
                <p
                  id="avoir-montant-erreur"
                  role="alert"
                  className="text-alerte mt-1.5 text-xs font-semibold"
                >
                  {erreurMontant}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="avoir-motif" className="text-encre block text-sm font-semibold">
                Motif
              </label>
              <p className="text-encre-55 mt-0.5 text-xs">
                Il figure sur le document : écrivez-le pour qu’il reste compréhensible dans un an.
              </p>
              <textarea
                id="avoir-motif"
                rows={3}
                value={motif}
                onChange={(evenement) => setMotif(evenement.target.value)}
                minLength={MOTIF_LONGUEUR_MINIMALE}
                aria-invalid={erreurMotif !== undefined}
                aria-describedby={erreurMotif === undefined ? undefined : 'avoir-motif-erreur'}
                placeholder="Erreur de quantité sur la main-d’œuvre : 2 heures facturées au lieu d’une."
                className="border-bordure bg-papier text-encre focus:border-or placeholder:text-encre-40 mt-1.5 w-full rounded-[var(--radius-douce)] border px-3 py-2 text-sm outline-none"
              />
              {erreurMotif !== undefined && (
                <p
                  id="avoir-motif-erreur"
                  role="alert"
                  className="text-alerte mt-1.5 text-xs font-semibold"
                >
                  {erreurMotif}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Bouton aspect="or" onClick={() => void emet()} disabled={enCours}>
                {enCours ? 'Émission…' : 'Émettre l’avoir'}
              </Bouton>
              <Bouton aspect="discret" onClick={() => setOuvert(false)} disabled={enCours}>
                Annuler
              </Bouton>
            </div>
          </div>
        ) : (
          <Bouton aspect="discret" className="mt-4" onClick={() => setOuvert(true)}>
            Émettre un avoir
          </Bouton>
        ))}
    </Carte>
  );
}
