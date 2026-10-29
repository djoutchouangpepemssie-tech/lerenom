'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bouton, Carte, Puce, cn } from '@lerenom/ui';
import {
  LIBELLE_TYPE_PLAGE,
  dureeMinutes,
  heureDe,
  plagesDuJour,
  type TypePlage,
} from '@lerenom/core';

/**
 * La semaine d'un professionnel.
 *
 * **Une liste par jour, pas une grille horaire.** Une grille avec ses lignes de demi-heures
 * est la représentation attendue d'un agenda, et c'est un piège sur un téléphone de 390 px :
 * sept colonnes y deviennent illisibles, et un rendez-vous d'un quart d'heure se réduit à
 * quelques pixels. Un artisan consulte son agenda debout, entre deux chantiers, sur son
 * téléphone. Il veut savoir ce qu'il a aujourd'hui, dans l'ordre.
 *
 * Les jours s'empilent sur téléphone et se mettent en colonnes à partir du grand écran — la
 * même liste, relue autrement, sans second composant à maintenir.
 */

interface PlageAffichee {
  readonly id: string;
  readonly rendezVousId: string | null;
  readonly type: TypePlage;
  readonly debut: Date;
  readonly fin: Date;
  readonly expireLe: Date | null;
  readonly clientNom: string | null;
  readonly demandeReference: string | null;
  readonly statutRendezVous: string | null;
}

const COULEURS: Readonly<Record<TypePlage, string>> = {
  intervention: 'border-l-or bg-or/[0.06]',
  visite: 'border-l-encre-55 bg-encre/[0.04]',
  propose: 'border-l-alerte bg-alerte-fond',
  blocage: 'border-l-encre-40 bg-encre/[0.03]',
};

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

function nomDuJour(date: Date): string {
  // `getDay()` rend 0 pour dimanche ; notre semaine commence lundi.
  return JOURS[(date.getDay() + 6) % 7] ?? '';
}

/** Le premier du mois s'écrit « 1er ». Voir la page de l'agenda, même raison. */
function quantieme(date: Date): string {
  return date.getDate() === 1 ? '1er' : String(date.getDate());
}

function estAujourdhui(date: Date): boolean {
  const maintenant = new Date();
  return (
    date.getDate() === maintenant.getDate() &&
    date.getMonth() === maintenant.getMonth() &&
    date.getFullYear() === maintenant.getFullYear()
  );
}

/** « 2026-03-03T09:00 », ce qu'attend un `<input type="datetime-local">`. */
function pourChamp(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function SemaineAgenda({
  jours,
  plages,
  semainePrecedente,
  semaineSuivante,
  libelleSemaine,
  clients,
}: {
  readonly jours: readonly string[];
  readonly plages: readonly (Omit<PlageAffichee, 'debut' | 'fin' | 'expireLe'> & {
    readonly debut: string;
    readonly fin: string;
    readonly expireLe: string | null;
  })[];
  readonly semainePrecedente: string;
  readonly semaineSuivante: string;
  readonly libelleSemaine: string;
  readonly clients: readonly { readonly id: string; readonly nom: string }[];
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [type, setType] = useState<TypePlage>('intervention');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [clientId, setClientId] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [problemes, setProblemes] = useState<readonly { champ: string; message: string }[]>([]);

  const dates = jours.map((jour) => new Date(jour));
  const toutes = plages.map((plage) => ({
    ...plage,
    debut: new Date(plage.debut),
    fin: new Date(plage.fin),
    expireLe: plage.expireLe === null ? null : new Date(plage.expireLe),
  }));

  function ouvreLe(jour: Date): void {
    const neuf = new Date(jour);
    neuf.setHours(9, 0, 0, 0);
    const suivant = new Date(neuf);
    suivant.setHours(10, 0, 0, 0);
    setDebut(pourChamp(neuf));
    setFin(pourChamp(suivant));
    setType('intervention');
    setProblemes([]);
    setOuvert(jour.toISOString());
  }

  async function pose(): Promise<void> {
    setEnCours(true);
    setProblemes([]);
    try {
      const reponse = await fetch('/api/pro/agenda', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, debut, fin, clientId }),
      });
      if (reponse.ok) {
        setOuvert(null);
        router.refresh();
        return;
      }
      const corps = (await reponse.json()) as {
        problemes?: readonly { champ: string; message: string }[];
        erreur?: string;
      };
      setProblemes(
        corps.problemes ?? [{ champ: 'debut', message: corps.erreur ?? 'Enregistrement refusé.' }],
      );
    } catch {
      setProblemes([{ champ: 'debut', message: 'Nous n’avons pas pu joindre nos serveurs.' }]);
    } finally {
      setEnCours(false);
    }
  }

  async function annule(rendezVousId: string): Promise<void> {
    const motif = window.prompt('Pourquoi annulez-vous ? Votre client lira ce motif.', '');
    // `null` veut dire « j'ai renoncé » ; une chaîne vide veut dire « sans motif », ce qui
    // est permis. Les confondre annulerait un rendez-vous que personne n'a voulu annuler.
    if (motif === null) return;

    const reponse = await fetch(`/api/pro/rendez-vous/${rendezVousId}/annulation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ motif }),
    });
    if (reponse.ok) {
      router.refresh();
      return;
    }
    const corps = (await reponse.json()) as { erreur?: string };
    setProblemes([{ champ: 'debut', message: corps.erreur ?? 'Annulation refusée.' }]);
  }

  async function retire(id: string): Promise<void> {
    const reponse = await fetch(`/api/pro/agenda/${id}`, { method: 'DELETE' });
    if (reponse.ok) {
      router.refresh();
      return;
    }
    const corps = (await reponse.json()) as { erreur?: string };
    setProblemes([{ champ: 'debut', message: corps.erreur ?? 'Suppression refusée.' }]);
  }

  const champ =
    'border-bordure bg-papier text-encre focus:border-or mt-1.5 w-full rounded-[var(--radius-douce)] border px-3 py-2 text-sm outline-none';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-encre font-semibold">{libelleSemaine}</p>
        <nav aria-label="Navigation dans l’agenda" className="flex gap-4 text-sm font-semibold">
          <Link
            href={semainePrecedente}
            className="text-encre-55 hover:text-encre transition-colors"
          >
            ← Semaine précédente
          </Link>
          <Link href={semaineSuivante} className="text-encre-55 hover:text-encre transition-colors">
            Semaine suivante →
          </Link>
        </nav>
      </div>

      {problemes.length > 0 && ouvert === null && (
        <p role="alert" className="text-alerte mt-4 text-sm font-semibold">
          {problemes[0]?.message}
        </p>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-7">
        {dates.map((jour) => {
          const duJour = plagesDuJour(toutes, jour);
          const cle = jour.toISOString();

          return (
            <Carte key={cle} className={cn('p-4', estAujourdhui(jour) && 'border-or')}>
              <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                {nomDuJour(jour)} {quantieme(jour)} {MOIS[jour.getMonth()]}
                {estAujourdhui(jour) && ' · aujourd’hui'}
              </p>

              {duJour.length === 0 ? (
                <p className="text-encre-55 mt-3 text-sm">Rien de prévu.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {duJour.map((plage) => (
                    <li
                      key={plage.id}
                      className={cn(
                        'rounded-[var(--radius-douce)] border-l-2 px-3 py-2',
                        COULEURS[plage.type],
                      )}
                    >
                      <p className="text-encre text-sm font-semibold">
                        {heureDe(plage.debut)} – {heureDe(plage.fin)}
                      </p>
                      <p className="text-encre-70 text-xs">
                        {LIBELLE_TYPE_PLAGE[plage.type]}
                        {plage.clientNom !== null && ` · ${plage.clientNom}`}
                        {` · ${String(dureeMinutes(plage))} min`}
                      </p>
                      {plage.statutRendezVous === 'confirme' ? (
                        <>
                          <p className="text-encre-55 mt-1 text-xs">Confirmé par le client.</p>
                          {plage.rendezVousId !== null && (
                            <button
                              type="button"
                              onClick={() => void annule(plage.rendezVousId ?? '')}
                              className="text-encre-55 hover:text-alerte mt-1 text-xs font-semibold transition-colors"
                            >
                              Annuler et prévenir
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void retire(plage.id)}
                          className="text-encre-55 hover:text-alerte mt-1 text-xs font-semibold transition-colors"
                        >
                          Retirer
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {ouvert === cle ? (
                <div className="border-bordure mt-4 space-y-3 border-t pt-4">
                  <div>
                    <span className="text-encre block text-sm font-semibold">Nature</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(['intervention', 'visite', 'blocage', 'propose'] as const).map((valeur) => (
                        <Puce
                          key={valeur}
                          active={type === valeur}
                          onBascule={() => setType(valeur)}
                        >
                          {LIBELLE_TYPE_PLAGE[valeur]}
                        </Puce>
                      ))}
                    </div>
                  </div>

                  {type === 'propose' && (
                    <div>
                      <label
                        htmlFor={`client-${cle}`}
                        className="text-encre block text-sm font-semibold"
                      >
                        À qui ?
                      </label>
                      <select
                        id={`client-${cle}`}
                        value={clientId}
                        onChange={(evenement) => setClientId(evenement.target.value)}
                        className={champ}
                      >
                        <option value="">Choisissez un client</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor={`debut-${cle}`}
                      className="text-encre block text-sm font-semibold"
                    >
                      Début
                    </label>
                    <input
                      id={`debut-${cle}`}
                      type="datetime-local"
                      value={debut}
                      onChange={(evenement) => setDebut(evenement.target.value)}
                      className={champ}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`fin-${cle}`}
                      className="text-encre block text-sm font-semibold"
                    >
                      Fin
                    </label>
                    <input
                      id={`fin-${cle}`}
                      type="datetime-local"
                      value={fin}
                      onChange={(evenement) => setFin(evenement.target.value)}
                      className={champ}
                    />
                  </div>

                  {problemes.map((probleme) => (
                    <p
                      key={probleme.champ + probleme.message}
                      role="alert"
                      className="text-alerte text-xs font-semibold"
                    >
                      {probleme.message}
                    </p>
                  ))}

                  <div className="flex flex-wrap gap-2">
                    <Bouton aspect="or" onClick={() => void pose()} disabled={enCours}>
                      {enCours ? 'Enregistrement…' : 'Enregistrer'}
                    </Bouton>
                    <Bouton aspect="discret" onClick={() => setOuvert(null)} disabled={enCours}>
                      Annuler
                    </Bouton>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => ouvreLe(jour)}
                  className="text-encre-55 hover:text-encre mt-3 text-sm font-semibold transition-colors"
                >
                  + Ajouter
                </button>
              )}
            </Carte>
          );
        })}
      </div>
    </div>
  );
}
