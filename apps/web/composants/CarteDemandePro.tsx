'use client';

import { useState } from 'react';
import { Bouton, Carte, Minuteur, Puce, cn } from '@lerenom/ui';
import { dateEtHeure, telephoneLisible } from '@/lib/affichage';
import type { DemandeAcceptee, DemandeEnAttente } from '@/lib/espace-pro';

/**
 * Une demande proposée à un professionnel, ou déjà acceptée par lui.
 *
 * Avant acceptation, le client n'est **ni nommé ni joignable** : ni prénom, ni téléphone, ni
 * adresse précise. C'est la promesse faite au client quand il a déposé sa demande, et elle
 * n'est pas qu'une affaire d'affichage — les coordonnées ne sont même pas lues en base tant
 * que la demande n'est pas acceptée.
 *
 * Le prix est annoncé **avant** le clic, jamais découvert après. Un professionnel doit savoir
 * ce qu'une acceptation lui coûte au moment où il décide.
 */

const MOTIFS = [
  { cle: 'indisponible', libelle: 'Je ne suis pas disponible' },
  { cle: 'trop-loin', libelle: 'C’est trop loin de chez moi' },
  { cle: 'pas-mon-metier', libelle: 'Ce n’est pas mon métier' },
  { cle: 'budget-trop-bas', libelle: 'Le budget est trop bas' },
] as const;

const URGENCES: Readonly<Record<string, string>> = {
  normale: 'Pas pressé',
  rapide: 'Rapidement',
  urgente: 'Urgent — sous 2 heures',
};

export function CarteDemandePro({
  demande,
  acceptee,
  surChangement,
}: {
  readonly demande: DemandeEnAttente | DemandeAcceptee;
  readonly acceptee: boolean;
  readonly surChangement: () => void;
}) {
  const [ouvertRefus, setOuvertRefus] = useState(false);
  const [envoi, setEnvoi] = useState<null | 'accepter' | 'refuser' | 'declarer'>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const details = acceptee ? (demande as DemandeAcceptee) : null;

  async function agit(corps: Record<string, unknown>, quoi: 'accepter' | 'refuser' | 'declarer') {
    setEnvoi(quoi);
    setErreur(null);
    try {
      const reponse = await fetch(`/api/pro/demandes/${demande.distributionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const brut: unknown = await reponse.json();
      const donnees = brut as { erreur?: string };

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? 'L’opération a échoué.');
        return;
      }
      surChangement();
    } catch {
      setErreur('L’opération a échoué. Vérifiez votre connexion et réessayez.');
    } finally {
      setEnvoi(null);
    }
  }

  return (
    <Carte className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{demande.besoin}</h3>
            {demande.urgence === 'urgente' && <Puce>Urgent</Puce>}
          </div>
          <p className="text-encre-55 mt-1 text-sm">
            {demande.ville}
            {demande.quartier !== null && ` · ${demande.quartier}`}
            {demande.distanceKm !== null && ` · à ${demande.distanceKm.toFixed(1)} km`}
          </p>
        </div>
        {!acceptee && <Minuteur echeance={demande.echeanceLe} />}
      </div>

      <p className="text-encre-70 mt-4 text-sm leading-relaxed">{demande.description}</p>

      <dl className="border-bordure mt-4 grid gap-x-6 gap-y-2 border-t pt-4 text-sm sm:grid-cols-2">
        <Ligne cle="Délai souhaité" valeur={URGENCES[demande.urgence] ?? demande.urgence} />
        {demande.budget !== null && <Ligne cle="Budget annoncé" valeur={demande.budget} />}
        <Ligne cle="Pourquoi vous" valeur={demande.raisonRang} />
        <Ligne cle="Reçue le" valeur={dateEtHeure(demande.envoyeeLe)} />
      </dl>

      {/* ── Coordonnées : seulement après acceptation ──────────────────── */}
      {details !== null && (
        <div className="border-or/25 bg-or/[0.05] mt-4 rounded-[var(--radius-carte)] border p-4">
          <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Coordonnées du client
          </p>
          <p className="mt-2 font-bold">{details.clientPrenom}</p>
          {details.adresse !== null && <p className="text-encre-70 text-sm">{details.adresse}</p>}
          <div className="mt-3 flex flex-wrap gap-2.5">
            <a href={`tel:${details.clientTelephone.replace(/\s/g, '')}`}>
              <Bouton aspect="or" taille="petit">
                Appeler {telephoneLisible(details.clientTelephone)}
              </Bouton>
            </a>
            <a href={`mailto:${details.clientEmail}`}>
              <Bouton aspect="contour" taille="petit">
                Écrire
              </Bouton>
            </a>
          </div>
        </div>
      )}

      {erreur !== null && (
        <p
          role="alert"
          className="bg-erreur-fond text-erreur mt-4 rounded-[var(--radius-douce)] px-4 py-3 text-sm"
        >
          {erreur}
        </p>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {!acceptee && !ouvertRefus && (
        <div className="border-bordure mt-5 flex flex-wrap items-center gap-3 border-t pt-5">
          <Bouton
            aspect="or"
            chargement={envoi === 'accepter'}
            disabled={envoi !== null || demande.libelleAcceptation === null}
            onClick={() => void agit({ action: 'accepter' }, 'accepter')}
            title={
              demande.libelleAcceptation === null
                ? 'Votre formule ne donne pas accès aux demandes urgentes.'
                : undefined
            }
          >
            {demande.libelleAcceptation ?? 'Accepter'}
          </Bouton>
          <Bouton aspect="discret" disabled={envoi !== null} onClick={() => setOuvertRefus(true)}>
            Refuser
          </Bouton>
          <span className="text-encre-55 text-xs">
            {demande.libelleAcceptation === null
              ? 'Les demandes urgentes sont réservées aux formules payantes.'
              : 'L’acceptation est définitive. Le refus est gratuit.'}
          </span>
        </div>
      )}

      {!acceptee && ouvertRefus && (
        <div className="border-bordure mt-5 border-t pt-5">
          <p className="text-sm font-bold">Pourquoi refusez-vous ?</p>
          <p className="text-encre-55 mt-1 text-sm">
            Le motif est obligatoire, et il nous sert vraiment : il corrige ce que nous vous
            envoyons. Refuser ne vous coûte rien.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MOTIFS.map((motif) => (
              <Bouton
                key={motif.cle}
                aspect="contour"
                taille="petit"
                disabled={envoi !== null}
                onClick={() => void agit({ action: 'refuser', motif: motif.cle }, 'refuser')}
              >
                {motif.libelle}
              </Bouton>
            ))}
          </div>
          <button
            type="button"
            className="text-encre-55 mt-3 text-sm underline"
            onClick={() => setOuvertRefus(false)}
          >
            Finalement, je garde cette demande
          </button>
        </div>
      )}

      {details !== null && (
        <div className="border-bordure mt-5 flex flex-wrap items-center gap-3 border-t pt-5">
          {details.travauxDeclares ? (
            <p className={cn('text-succes text-sm font-bold')}>
              ✓ Intervention déclarée réalisée — le client sera invité à déposer un avis
            </p>
          ) : (
            <>
              <Bouton
                aspect="contour"
                taille="petit"
                chargement={envoi === 'declarer'}
                disabled={envoi !== null}
                onClick={() => void agit({ action: 'declarer-travaux' }, 'declarer')}
              >
                J’ai réalisé l’intervention
              </Bouton>
              <span className="text-encre-55 text-xs">
                C’est ce qui déclenche la demande d’avis au client.
              </span>
            </>
          )}
        </div>
      )}
    </Carte>
  );
}

function Ligne({ cle, valeur }: { readonly cle: string; readonly valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-encre-55 shrink-0">{cle}</dt>
      <dd className="min-w-0 text-right font-semibold">{valeur}</dd>
    </div>
  );
}
