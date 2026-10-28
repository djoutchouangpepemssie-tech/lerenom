'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bouton, Carte, cn } from '@lerenom/ui';
import type { ReponseConfirmation } from '@lerenom/core';

/**
 * « L'intervention a-t-elle eu lieu ? »
 *
 * Une question, trois réponses, un clic. C'est la pièce qui manquait à toute la chaîne des
 * avis : sans elle, seul le professionnel pouvait déclarer ses chantiers, et celui qui ne
 * déclare jamais rien n'avait jamais de mauvais avis.
 *
 * La réponse « oui » enchaîne directement sur le dépôt d'avis, sur la même page : le client
 * est là, il se souvient, et un message de plus serait un message de trop.
 */

const REPONSES: readonly {
  readonly cle: ReponseConfirmation;
  readonly titre: string;
  readonly detail: string;
}[] = [
  {
    cle: 'oui',
    titre: 'Oui, l’intervention a eu lieu',
    detail: 'Vous pourrez donner votre avis juste après, si vous le souhaitez.',
  },
  {
    cle: 'pas-encore',
    titre: 'Pas encore, c’est prévu',
    detail: 'Nous vous reposerons la question dans quelques jours.',
  },
  {
    cle: 'non',
    titre: 'Non, et ce n’est plus prévu',
    detail: 'Dites-nous pourquoi si vous le voulez : cela nous aide à surveiller la qualité.',
  },
];

export function ConfirmationIntervention({
  jeton,
  nomPro,
  reference,
  surConfirmation,
}: {
  readonly jeton: string;
  readonly nomPro: string;
  readonly reference: string;
  /**
   * Appelé quand le client confirme. Le jeton reçu ouvre le dépôt d'avis : le serveur le
   * délivre à qui tient déjà un lien valide sur cette demande, donc il n'élargit aucun accès.
   */
  readonly surConfirmation: (jetonAvis: string) => void;
}) {
  const [choix, setChoix] = useState<ReponseConfirmation | null>(null);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [repondu, setRepondu] = useState<ReponseConfirmation | null>(null);

  async function repond(reponse: ReponseConfirmation) {
    setEnvoi(true);
    setErreur(null);
    try {
      const requete = await fetch(`/api/suivi/${jeton}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirmer-intervention',
          reponse,
          ...(reponse === 'non' && motif.trim() !== '' ? { motif: motif.trim() } : {}),
        }),
      });

      const brut: unknown = await requete.json();
      const donnees = brut as { enregistre?: boolean; jetonAvis?: string; erreur?: string };

      if (!requete.ok || donnees.enregistre !== true) {
        setErreur(donnees.erreur ?? 'Votre réponse n’a pas pu être enregistrée.');
        return;
      }

      if (reponse === 'oui' && donnees.jetonAvis !== undefined) {
        surConfirmation(donnees.jetonAvis);
        return;
      }
      setRepondu(reponse);
    } catch {
      setErreur('Votre réponse n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.');
    } finally {
      setEnvoi(false);
    }
  }

  if (repondu !== null) {
    return (
      <Carte className="mx-auto max-w-[36rem] p-7 text-center">
        <span className="bg-succes-fond text-succes mx-auto flex size-14 items-center justify-center rounded-full text-2xl">
          ✓
        </span>
        <h2 className="mt-5 text-2xl">Merci, c’est noté</h2>
        <p className="text-encre-70 mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed">
          {repondu === 'pas-encore'
            ? 'Nous vous reposerons la question dans quelques jours. Vous pourrez donner votre avis une fois l’intervention terminée.'
            : 'Nous avons pris note. Un conseiller regardera ce dossier : un professionnel qui accepte une demande doit aller au bout, et nous y veillons.'}
        </p>
        <div className="mt-8">
          <Link href="/">
            <Bouton aspect="contour">Retour à l’accueil</Bouton>
          </Link>
        </div>
      </Carte>
    );
  }

  return (
    <Carte className="mx-auto max-w-[38rem] p-5 md:p-7">
      <p className="text-encre-55 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
        Demande {reference}
      </p>
      <h2 className="mt-3 text-2xl">Votre intervention avec {nomPro} a-t-elle eu lieu ?</h2>
      <p className="text-encre-70 mt-2 text-sm leading-relaxed">
        Une seule question, et elle nous sert à deux choses : savoir si tout s’est bien passé, et
        n’inviter à donner un avis que les clients qui ont réellement vu passer un professionnel.
      </p>

      <ul className="mt-6 space-y-3">
        {REPONSES.map((reponse) => (
          <li key={reponse.cle}>
            <button
              type="button"
              onClick={() => setChoix(reponse.cle)}
              aria-pressed={choix === reponse.cle}
              className={cn(
                'w-full rounded-[var(--radius-carte)] border px-4 py-3.5 text-left transition-colors',
                choix === reponse.cle ? 'border-or bg-or/6' : 'border-bordure hover:border-or/50',
              )}
            >
              <span className="block font-bold">{reponse.titre}</span>
              <span className="text-encre-55 mt-0.5 block text-sm">{reponse.detail}</span>
            </button>
          </li>
        ))}
      </ul>

      {choix === 'non' && (
        <div className="mt-5">
          <label htmlFor="motif-non" className="text-encre text-sm font-semibold">
            Que s’est-il passé ? (facultatif)
          </label>
          <textarea
            id="motif-non"
            rows={3}
            value={motif}
            maxLength={300}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Il n’est jamais venu, nous n’avons pas trouvé d’accord…"
            className="border-bordure bg-creme text-encre focus-visible:border-or focus-visible:ring-or/30 mt-2 w-full resize-y rounded-[var(--radius-douce)] border px-4 py-3 leading-relaxed outline-none focus-visible:ring-4"
          />
        </div>
      )}

      {erreur !== null && (
        <p
          role="alert"
          className="bg-erreur-fond text-erreur mt-5 rounded-[var(--radius-douce)] px-4 py-3 text-sm"
        >
          {erreur}
        </p>
      )}

      <div className="mt-6">
        <Bouton
          aspect="or"
          taille="grand"
          disabled={choix === null}
          chargement={envoi}
          onClick={() => {
            if (choix !== null) void repond(choix);
          }}
          title={choix === null ? 'Choisissez une réponse.' : undefined}
        >
          Valider ma réponse
        </Bouton>
      </div>
    </Carte>
  );
}
