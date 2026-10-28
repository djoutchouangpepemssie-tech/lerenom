'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bouton, Carte } from '@lerenom/ui';
import { LONGUEUR_CODE, formateIban } from '@lerenom/core';

/**
 * La saisie d'un compte bancaire, puis sa confirmation par code.
 *
 * Deux temps, et l'écran le dit avant de commencer : enregistrer ne change rien tant que le
 * code reçu par SMS n'est pas saisi. C'est la parade à la fraude la plus courante sur ce
 * genre de plateforme — détourner les virements d'un artisan dont on a pris le compte — et
 * elle ne vaut que si le professionnel comprend pourquoi on la lui impose. Un contrôle de
 * sécurité qu'on subit sans le comprendre finit par être contourné par celui qu'il protège.
 *
 * L'IBAN s'affiche par groupes de quatre pendant la frappe, comme sur un relevé : c'est ainsi
 * qu'il se relit, et une relecture est exactement ce qu'on veut encourager ici.
 */

type Probleme = { readonly champ: string; readonly message: string };

export function FormulaireRib({
  mobileMasque,
  ribEnAttenteId,
  remplacement,
}: {
  readonly mobileMasque: string | null;
  /** L'identifiant d'un compte déjà saisi et pas encore confirmé, s'il y en a un. */
  readonly ribEnAttenteId: string | null;
  /** `true` quand un compte est déjà actif : le ton et les avertissements changent. */
  readonly remplacement: boolean;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(ribEnAttenteId !== null);
  const [etape, setEtape] = useState<'saisie' | 'code'>(
    ribEnAttenteId === null ? 'saisie' : 'code',
  );
  const [ribId, setRibId] = useState<string | null>(ribEnAttenteId);

  const [titulaire, setTitulaire] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [banque, setBanque] = useState('');
  const [code, setCode] = useState('');

  const [enCours, setEnCours] = useState(false);
  const [problemes, setProblemes] = useState<readonly Probleme[]>([]);
  const [refus, setRefus] = useState<string | null>(null);

  function messagePour(champ: string): string | undefined {
    return problemes.find((probleme) => probleme.champ === champ)?.message;
  }

  async function enregistre(): Promise<void> {
    setEnCours(true);
    setProblemes([]);
    setRefus(null);
    try {
      const reponse = await fetch('/api/pro/rib', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ titulaire, iban, bic, banque }),
      });
      if (reponse.ok) {
        const corps = (await reponse.json()) as { ribId: string };
        setRibId(corps.ribId);
        setEtape('code');
        return;
      }
      const corps = (await reponse.json()) as { problemes?: readonly Probleme[]; erreur?: string };
      setProblemes(corps.problemes ?? []);
      if (corps.problemes === undefined) setRefus(corps.erreur ?? 'Enregistrement impossible.');
    } catch {
      setRefus('Nous n’avons pas pu joindre nos serveurs.');
    } finally {
      setEnCours(false);
    }
  }

  async function valide(): Promise<void> {
    if (ribId === null) return;
    setEnCours(true);
    setRefus(null);
    try {
      const reponse = await fetch(`/api/pro/rib/${ribId}/confirmation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (reponse.ok) {
        setOuvert(false);
        setEtape('saisie');
        setCode('');
        router.refresh();
        return;
      }
      const corps = (await reponse.json()) as { erreur?: string };
      setRefus(corps.erreur ?? 'Ce code n’a pas été accepté.');
    } catch {
      setRefus('Nous n’avons pas pu joindre nos serveurs.');
    } finally {
      setEnCours(false);
    }
  }

  const champ =
    'border-bordure bg-papier text-encre focus:border-or mt-1.5 w-full rounded-[var(--radius-douce)] border px-3 py-2 text-sm outline-none';

  // Sans mobile enregistré, la confirmation ne peut pas avoir lieu — et le serveur refusera.
  // Le dire ici, avant la saisie, plutôt que d'accepter un IBAN pour le rejeter ensuite :
  // faire taper des coordonnées bancaires pour rien est le genre de séquence qui fait perdre
  // confiance au moment précis où on en demande.
  if (mobileMasque === null) {
    return (
      <Carte className="p-5">
        <p className="text-encre text-sm font-bold">Un mobile est nécessaire</p>
        <p className="text-encre-70 mt-2 text-sm">
          Changer de coordonnées bancaires se confirme par un code envoyé à votre mobile : c’est ce
          qui empêche un tiers de détourner vos encaissements. Renseignez d’abord un numéro sur
          votre compte.
        </p>
      </Carte>
    );
  }

  if (!ouvert) {
    return (
      <Bouton aspect={remplacement ? 'discret' : 'or'} onClick={() => setOuvert(true)}>
        {remplacement ? 'Changer de compte' : 'Enregistrer un compte bancaire'}
      </Bouton>
    );
  }

  return (
    <Carte className="p-5">
      <p className="text-encre text-sm font-bold">
        {etape === 'saisie'
          ? remplacement
            ? 'Changer de compte bancaire'
            : 'Enregistrer un compte bancaire'
          : 'Confirmer par le code reçu'}
      </p>

      {refus !== null && (
        <p role="alert" className="text-alerte mt-3 text-sm font-semibold">
          {refus}
        </p>
      )}

      {etape === 'saisie' ? (
        <div className="mt-3 space-y-4">
          <p className="text-encre-70 text-sm">
            Rien ne change tant que vous n’avez pas saisi le code que nous enverrons
            {` au ${mobileMasque}`}.
            {remplacement &&
              ' Vos factures déjà émises continueront d’indiquer le compte sur lequel elles ont été réclamées.'}
          </p>

          <div>
            <label htmlFor="rib-titulaire" className="text-encre block text-sm font-semibold">
              Titulaire du compte
            </label>
            <input
              id="rib-titulaire"
              value={titulaire}
              onChange={(evenement) => setTitulaire(evenement.target.value)}
              autoComplete="off"
              aria-invalid={messagePour('titulaire') !== undefined}
              className={champ}
            />
            {messagePour('titulaire') !== undefined && (
              <p role="alert" className="text-alerte mt-1.5 text-xs font-semibold">
                {messagePour('titulaire')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="rib-iban" className="text-encre block text-sm font-semibold">
              IBAN
            </label>
            <input
              id="rib-iban"
              value={iban}
              // Reformaté à chaque frappe, comme sur un relevé : c'est ainsi qu'on le relit,
              // et c'est une relecture qu'on cherche à encourager.
              onChange={(evenement) => setIban(formateIban(evenement.target.value))}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="FR76 3000 1007 9412 3456 7890 185"
              aria-invalid={messagePour('iban') !== undefined}
              className={`${champ} font-mono`}
            />
            {messagePour('iban') !== undefined && (
              <p role="alert" className="text-alerte mt-1.5 text-xs font-semibold">
                {messagePour('iban')}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rib-bic" className="text-encre block text-sm font-semibold">
                BIC
              </label>
              <input
                id="rib-bic"
                value={bic}
                onChange={(evenement) => setBic(evenement.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
                placeholder="BNPAFRPP"
                aria-invalid={messagePour('bic') !== undefined}
                className={`${champ} font-mono`}
              />
              {messagePour('bic') !== undefined && (
                <p role="alert" className="text-alerte mt-1.5 text-xs font-semibold">
                  {messagePour('bic')}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="rib-banque" className="text-encre block text-sm font-semibold">
                Banque <span className="text-encre-55 font-normal">(facultatif)</span>
              </label>
              <input
                id="rib-banque"
                value={banque}
                onChange={(evenement) => setBanque(evenement.target.value)}
                autoComplete="off"
                className={champ}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Bouton aspect="or" onClick={() => void enregistre()} disabled={enCours}>
              {enCours ? 'Envoi…' : 'Recevoir le code'}
            </Bouton>
            <Bouton aspect="discret" onClick={() => setOuvert(false)} disabled={enCours}>
              Annuler
            </Bouton>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <p className="text-encre-70 text-sm">
            Nous avons envoyé un code au {mobileMasque}. Si vous n’êtes pas à l’origine de ce
            changement, ne saisissez rien et prévenez-nous.
          </p>

          <div>
            <label htmlFor="rib-code" className="text-encre block text-sm font-semibold">
              Code à {LONGUEUR_CODE} chiffres
            </label>
            <input
              id="rib-code"
              value={code}
              onChange={(evenement) => setCode(evenement.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={LONGUEUR_CODE}
              className={`${champ} max-w-[12rem] font-mono tracking-[0.4em]`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Bouton aspect="or" onClick={() => void valide()} disabled={enCours}>
              {enCours ? 'Vérification…' : 'Confirmer le compte'}
            </Bouton>
            <Bouton
              aspect="discret"
              onClick={() => {
                setEtape('saisie');
                setRefus(null);
              }}
              disabled={enCours}
            >
              Corriger la saisie
            </Bouton>
          </div>
        </div>
      )}
    </Carte>
  );
}
