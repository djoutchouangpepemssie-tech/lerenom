'use client';

import { useState } from 'react';
import { Bouton, Carte, Champ, cn } from '@lerenom/ui';
import type { AgenceDuPro, AgencesDuPro } from '@/lib/agences-pro';

/**
 * Les agences d'un professionnel.
 *
 * Une agence est un point et un rayon : c'est elle qui décide si une demande est à portée.
 * L'écran le dit en toutes lettres, parce qu'un rayon réglé au hasard se paie en demandes
 * jamais reçues — ou en déplacements inutiles.
 *
 * Il dit aussi ce qu'il ne fait pas : écrire une rue ne déplace pas le point. Tant qu'aucun
 * service de géocodage n'est raccordé, les distances se mesurent depuis le centre de la
 * commune. Le taire laisserait un professionnel régler son rayon sur une position qui n'est
 * pas la sienne.
 */

type Brouillon = Omit<AgenceDuPro, 'id' | 'communeNom' | 'positionnee'> & {
  readonly id?: string;
  readonly cle: string;
};

export function FormulaireAgences({ donnees }: { readonly donnees: AgencesDuPro }) {
  const [agences, setAgences] = useState<readonly Brouillon[]>(() =>
    donnees.agences.map((agence) => ({ ...agence, cle: agence.id })),
  );
  const [enregistrement, setEnregistrement] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  function change(cle: string, champs: Partial<Brouillon>) {
    setAgences((actuelles) =>
      actuelles.map((agence) => (agence.cle === cle ? { ...agence, ...champs } : agence)),
    );
  }

  function designePrincipale(cle: string) {
    setAgences((actuelles) =>
      actuelles.map((agence) => ({ ...agence, principale: agence.cle === cle })),
    );
  }

  function ajoute() {
    const premiere = donnees.communes[0];
    if (premiere === undefined) return;
    setAgences((actuelles) => [
      ...actuelles,
      {
        cle: `nouvelle-${String(Date.now())}`,
        nom: '',
        adresse: '',
        codePostal: '',
        communeId: premiere.code,
        rayonKm: donnees.rayonParDefautKm,
        contactNom: '',
        contactTelephone: '',
        contactEmail: '',
        notifierParSms: true,
        notifierParEmail: true,
        principale: actuelles.length === 0,
      },
    ]);
  }

  async function enregistre(): Promise<void> {
    setEnregistrement(true);
    setRefus(null);
    setSucces(null);
    try {
      const reponse = await fetch('/api/pro/agences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agences: agences.map(({ cle: _cle, ...agence }) => agence),
        }),
      });
      if (reponse.ok) {
        const corps = (await reponse.json()) as { nombre: number };
        setSucces(
          corps.nombre === 1
            ? 'Votre agence est enregistrée.'
            : `Vos ${String(corps.nombre)} agences sont enregistrées.`,
        );
        return;
      }
      const corps = (await reponse.json()) as { erreur?: string };
      setRefus(corps.erreur ?? 'Vos agences n’ont pas pu être enregistrées.');
    } catch {
      setRefus(
        'Nous n’avons pas pu joindre nos serveurs. Votre saisie est conservée : réessayez dans un instant.',
      );
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div className="max-w-3xl">
      {succes !== null && (
        <p
          role="status"
          className="border-succes/25 bg-succes-fond text-succes mb-6 rounded-[var(--radius-carte)] border p-4 text-sm font-semibold"
        >
          {succes}
        </p>
      )}
      {refus !== null && (
        <p
          role="alert"
          className="border-alerte/25 bg-alerte-fond text-alerte mb-6 rounded-[var(--radius-carte)] border p-4 text-sm font-semibold"
        >
          {refus}
        </p>
      )}

      <p className="border-alerte/25 bg-alerte-fond text-alerte mb-6 rounded-[var(--radius-carte)] border p-4 text-sm">
        <strong className="font-bold">Le rayon n’a pas encore d’effet.</strong> Aucun service de
        géocodage n’est raccordé : ni les communes ni les adresses n’ont de coordonnées, et les
        demandes vous parviennent donc selon les <em>villes</em> de votre périmètre, pas selon une
        distance. Réglez-le tout de même — il s’appliquera dès le raccordement, sans que vous ayez à
        y revenir.
      </p>

      <div className="space-y-5">
        {agences.map((agence) => (
          <Carte key={agence.cle} className={cn('p-5', agence.principale && 'border-or/40')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg">
                {agence.nom === '' ? 'Agence' : agence.nom}
                {agence.principale && (
                  <span className="bg-or/15 text-or-fonce ml-2.5 rounded-full px-2.5 py-0.5 text-xs font-bold">
                    Principale
                  </span>
                )}
              </h2>
              <div className="flex gap-2">
                {!agence.principale && (
                  <>
                    <button
                      type="button"
                      onClick={() => designePrincipale(agence.cle)}
                      className="text-or-fonce hover:text-encre min-h-11 px-2 text-sm font-semibold transition-colors"
                    >
                      En faire la principale
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAgences((actuelles) => actuelles.filter((a) => a.cle !== agence.cle))
                      }
                      className="text-encre-55 hover:text-alerte min-h-11 px-2 text-sm font-semibold transition-colors"
                    >
                      Retirer
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Champ
                etiquette="Nom de l’agence"
                value={agence.nom}
                onChange={(e) => change(agence.cle, { nom: e.target.value })}
                placeholder="Agence de Montreuil"
                aide="Facultatif. Utile seulement si vous en avez plusieurs."
              />
              <Champ
                etiquette="Code postal"
                value={agence.codePostal}
                inputMode="numeric"
                onChange={(e) => change(agence.cle, { codePostal: e.target.value })}
              />
            </div>

            <Champ
              className="mt-4"
              etiquette="Adresse"
              value={agence.adresse}
              onChange={(e) => change(agence.cle, { adresse: e.target.value })}
              placeholder="12 rue de la Roquette"
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-encre text-sm font-semibold">Ville</span>
                <select
                  value={agence.communeId}
                  onChange={(e) => change(agence.cle, { communeId: e.target.value })}
                  className="border-bordure bg-carte text-encre focus:border-or mt-1.5 min-h-12 w-full rounded-[var(--radius-douce)] border px-3 text-sm focus:outline-none"
                >
                  {donnees.communes.map((commune) => (
                    <option key={commune.code} value={commune.code}>
                      {commune.nom}
                    </option>
                  ))}
                </select>
                <span className="text-encre-55 mt-1.5 block text-xs">
                  Parmi les villes de votre périmètre.
                </span>
              </label>

              <label className="block">
                <span className="text-encre text-sm font-semibold">
                  Rayon d’intervention : {agence.rayonKm} km
                </span>
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={agence.rayonKm}
                  onChange={(e) => change(agence.cle, { rayonKm: Number(e.target.value) })}
                  className="accent-or mt-3 w-full"
                />
                <span className="text-encre-55 mt-1.5 block text-xs">
                  Il s’appliquera au raccordement du géocodage : au-delà, les demandes ne vous
                  seront plus proposées.
                </span>
              </label>
            </div>

            <div className="border-bordure mt-5 border-t pt-5">
              <p className="text-encre text-sm font-semibold">Qui prévenir pour cette agence</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Champ
                  etiquette="Nom du contact"
                  value={agence.contactNom}
                  onChange={(e) => change(agence.cle, { contactNom: e.target.value })}
                />
                <Champ
                  etiquette="Téléphone"
                  type="tel"
                  value={agence.contactTelephone}
                  onChange={(e) => change(agence.cle, { contactTelephone: e.target.value })}
                />
                <Champ
                  etiquette="Adresse électronique"
                  type="email"
                  value={agence.contactEmail}
                  onChange={(e) => change(agence.cle, { contactEmail: e.target.value })}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-5">
                <Case
                  coche={agence.notifierParSms}
                  onBascule={() => change(agence.cle, { notifierParSms: !agence.notifierParSms })}
                >
                  Prévenir par SMS
                </Case>
                <Case
                  coche={agence.notifierParEmail}
                  onBascule={() =>
                    change(agence.cle, { notifierParEmail: !agence.notifierParEmail })
                  }
                >
                  Prévenir par courriel
                </Case>
              </div>
            </div>
          </Carte>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Bouton
          aspect="or"
          taille="grand"
          onClick={() => void enregistre()}
          disabled={enregistrement}
        >
          {enregistrement ? 'Enregistrement…' : 'Enregistrer mes agences'}
        </Bouton>
        <Bouton aspect="contour" onClick={ajoute} disabled={donnees.communes.length === 0}>
          Ajouter une agence
        </Bouton>
      </div>
    </div>
  );
}

function Case({
  coche,
  onBascule,
  children,
}: {
  readonly coche: boolean;
  readonly onBascule: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={coche}
        onChange={onBascule}
        className="accent-or size-4.5 shrink-0"
      />
      <span className="text-encre">{children}</span>
    </label>
  );
}
