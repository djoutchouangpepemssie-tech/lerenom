'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bouton, Carte, ZoneTexte, cn } from '@lerenom/ui';
import {
  COMMENTAIRE_MAX,
  COMMENTAIRE_MIN,
  CRITERES_AVIS,
  NOTE_MAX,
  type CritereAvis,
} from '@lerenom/core';

/**
 * Le dépôt d'un avis, côté client.
 *
 * Deux choses sont dites franchement ici, parce qu'elles engagent :
 *   * l'avis **n'est pas publié tout de suite**. Il est relu, comme l'annonce la charte, et un
 *     refus est motivé. Le client doit le savoir avant d'écrire, pas après ;
 *   * un avis négatif est publié comme un autre. L'écrire est la seule façon de rendre la
 *     promesse crédible.
 */

const LIBELLES_NOTE = [
  'Très insatisfait',
  'Insatisfait',
  'Correct',
  'Satisfait',
  'Très satisfait',
] as const;

export interface CibleAvis {
  readonly nom: string;
  readonly ville: string | null;
}

function Etoiles({
  valeur,
  surValeur,
  etiquette,
  taille = 'grande',
}: {
  readonly valeur: number;
  readonly surValeur: (note: number) => void;
  readonly etiquette: string;
  readonly taille?: 'petite' | 'grande';
}) {
  return (
    <div role="radiogroup" aria-label={etiquette} className="flex gap-1">
      {Array.from({ length: NOTE_MAX }, (_, index) => index + 1).map((note) => (
        <button
          key={note}
          type="button"
          role="radio"
          aria-checked={valeur === note}
          aria-label={`${note} sur ${NOTE_MAX}`}
          onClick={() => surValeur(note)}
          className={cn(
            'rounded-[var(--radius-douce)] leading-none transition-transform',
            'focus-visible:ring-or/40 focus-visible:ring-4 focus-visible:outline-none',
            taille === 'grande' ? 'p-1 text-[2rem]' : 'p-0.5 text-xl',
            note <= valeur ? 'text-or' : 'text-encre/15',
            'hover:scale-110',
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function FormulaireAvis({
  jeton,
  cible,
  reference,
  prenom,
}: {
  readonly jeton: string;
  readonly cible: CibleAvis;
  readonly reference: string;
  readonly prenom: string;
}) {
  const [note, setNote] = useState(0);
  const [criteres, setCriteres] = useState<Partial<Record<CritereAvis, number>>>({});
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [depose, setDepose] = useState(false);

  const commentaireTropCourt =
    commentaire.trim() !== '' && commentaire.trim().length < COMMENTAIRE_MIN;

  async function envoie() {
    if (note === 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await fetch(`/api/suivi/${jeton}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deposer-avis',
          note,
          criteres,
          commentaire: commentaire.trim() === '' ? undefined : commentaire.trim(),
        }),
      });

      const brut: unknown = await reponse.json();
      const donnees = brut as { depose?: boolean; erreur?: string };

      if (!reponse.ok || donnees.depose !== true) {
        setErreur(donnees.erreur ?? 'Votre avis n’a pas pu être enregistré.');
        return;
      }
      setDepose(true);
    } catch {
      setErreur('Votre avis n’a pas pu être envoyé. Vérifiez votre connexion et réessayez.');
    } finally {
      setEnvoi(false);
    }
  }

  if (depose) {
    return (
      <Carte className="mx-auto max-w-[40rem] p-7 text-center">
        <span className="bg-succes-fond text-succes mx-auto flex size-14 items-center justify-center rounded-full text-2xl">
          ✓
        </span>
        <h2 className="mt-5 text-2xl">Merci {prenom}</h2>
        <p className="text-encre-70 mx-auto mt-3 max-w-[46ch] text-sm leading-relaxed">
          Votre avis est enregistré. Il est relu avant publication, comme tous les avis : nous
          vérifions qu’il vient bien d’une intervention réelle et qu’il ne contient pas de
          coordonnées personnelles. Vous serez prévenu de sa publication, ou de son refus et de son
          motif.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Bouton aspect="contour">Retour à l’accueil</Bouton>
          </Link>
          <Link href="/charte-avis">
            <Bouton aspect="discret">Lire la charte des avis</Bouton>
          </Link>
        </div>
      </Carte>
    );
  }

  return (
    <div className="mx-auto max-w-[40rem]">
      <Carte className="p-5 md:p-7">
        <p className="text-encre-55 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
          Demande {reference}
        </p>
        <h2 className="mt-3 text-2xl">
          Comment s’est passée votre intervention avec {cible.nom} ?
        </h2>
        <p className="text-encre-70 mt-2 text-sm leading-relaxed">
          Votre avis aide les prochains clients à choisir. Il est relu avant publication, et un avis
          négatif est publié comme un autre : nous ne refusons jamais un avis parce qu’il est
          sévère.
        </p>

        {/* ── Note d'ensemble ──────────────────────────────────────────── */}
        <div className="border-bordure mt-7 border-t pt-6">
          <p className="font-bold">Votre note d’ensemble</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Etoiles valeur={note} surValeur={setNote} etiquette="Note d’ensemble" />
            <span className="text-encre-70 text-sm">
              {note === 0 ? 'Choisissez une note' : LIBELLES_NOTE[note - 1]}
            </span>
          </div>
        </div>

        {/* ── Critères ─────────────────────────────────────────────────── */}
        <div className="border-bordure mt-6 border-t pt-6">
          <p className="font-bold">Dans le détail (facultatif)</p>
          <ul className="mt-3 space-y-3">
            {CRITERES_AVIS.map((critere) => (
              <li key={critere.cle} className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-encre-70 text-sm">{critere.libelle}</span>
                <Etoiles
                  taille="petite"
                  etiquette={critere.libelle}
                  valeur={criteres[critere.cle] ?? 0}
                  surValeur={(valeur) =>
                    setCriteres((precedent) => ({ ...precedent, [critere.cle]: valeur }))
                  }
                />
              </li>
            ))}
          </ul>
        </div>

        {/* ── Commentaire ──────────────────────────────────────────────── */}
        <div className="border-bordure mt-6 border-t pt-6">
          <ZoneTexte
            etiquette="Votre commentaire (facultatif)"
            rows={5}
            value={commentaire}
            maxLength={COMMENTAIRE_MAX}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ce qui s’est bien passé, ce qui aurait pu être mieux…"
            aide={`N’indiquez ni numéro de téléphone, ni adresse : ces informations ne sont pas publiées. ${String(commentaire.length)} / ${String(COMMENTAIRE_MAX)} caractères.`}
            erreur={
              commentaireTropCourt
                ? `Au moins ${String(COMMENTAIRE_MIN)} caractères, ou laissez vide.`
                : undefined
            }
          />
        </div>

        {erreur !== null && (
          <p
            role="alert"
            className="bg-erreur-fond text-erreur mt-5 rounded-[var(--radius-douce)] px-4 py-3 text-sm"
          >
            {erreur}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Bouton
            aspect="or"
            taille="grand"
            onClick={() => void envoie()}
            disabled={note === 0 || commentaireTropCourt}
            chargement={envoi}
            title={note === 0 ? 'Choisissez d’abord une note.' : undefined}
          >
            Déposer mon avis
          </Bouton>
          <Link href="/charte-avis" className="text-encre-55 text-sm underline">
            Charte des avis
          </Link>
        </div>
      </Carte>
    </div>
  );
}
