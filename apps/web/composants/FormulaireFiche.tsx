'use client';

import { useMemo, useState } from 'react';
import { Anneau, Bouton, Carte, Champ, ZoneTexte, cn } from '@lerenom/ui';
import {
  ATOUTS_MAXIMUM,
  JOURS,
  LIBELLE_JOUR,
  LONGUEUR_PRESENTATION_UTILE,
  completudeFiche,
  criteresFiche,
  heureLisible,
  heuresProposees,
  problemesHoraires,
  type CritereFiche,
  type Creneau,
  type Horaires,
  type Jour,
} from '@lerenom/core';
// Un **type** seulement : importer une valeur depuis ce module embarquerait Prisma — et donc
// `pg`, `dns`, `fs` — dans le paquet envoyé au navigateur. La construction le refuse, et elle
// a raison : une règle partagée entre le serveur et l'écran appartient à `@lerenom/core`.
import type { FicheDuPro } from '@/lib/fiche-pro';

/**
 * L'écran de la fiche professionnelle.
 *
 * Son intérêt n'est pas de ranger des champs : c'est de **montrer ce que chaque champ
 * rapporte**. La complétude décide du classement naturel, et un professionnel a le droit de
 * savoir sur quoi passer ses dix minutes. L'anneau et la liste des manques bougent au fil de
 * la frappe, avec la fonction qui sert au classement — pas une approximation d'affichage.
 *
 * Les trois éléments qu'on ne saisit pas ici — photos, logo, couverture — sont tout de même
 * nommés : les taire donnerait une fiche « complète » à 100 % qui ne l'est pas.
 */
export function FormulaireFiche({ fiche }: { readonly fiche: FicheDuPro }) {
  const [description, setDescription] = useState(fiche.description);
  const [slogan, setSlogan] = useState(fiche.slogan);
  const [telephone, setTelephone] = useState(fiche.telephone);
  const [email, setEmail] = useState(fiche.email);
  const [siteWeb, setSiteWeb] = useState(fiche.siteWeb);
  const [atouts, setAtouts] = useState<readonly string[]>(
    fiche.atouts.length > 0 ? [...fiche.atouts] : [''],
  );
  const [decennaleNumero, setDecennaleNumero] = useState(fiche.decennaleNumero);
  const [decennaleAssureur, setDecennaleAssureur] = useState(fiche.decennaleAssureur);
  const [decennaleExpireLe, setDecennaleExpireLe] = useState(fiche.decennaleExpireLe);
  const [horaires, setHoraires] = useState<Horaires>(fiche.horaires);

  const [enregistrement, setEnregistrement] = useState(false);
  const [problemes, setProblemes] = useState<readonly { champ: string; message: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  /** L'état tel que le verra le calcul de complétude, recomposé à chaque frappe. */
  const etat = useMemo(
    () => ({
      description: description === '' ? null : description,
      slogan: slogan === '' ? null : slogan,
      logoUrl: fiche.logoPose ? 'pose' : null,
      couvertureUrl: fiche.couverturePosee ? 'pose' : null,
      telephone: telephone === '' ? null : telephone,
      email: email === '' ? null : email,
      siteWeb: siteWeb === '' ? null : siteWeb,
      horaires,
      atouts,
      nombrePhotos: fiche.nombrePhotos,
      decennaleNumero: decennaleNumero === '' ? null : decennaleNumero,
      decennaleAssureur: decennaleAssureur === '' ? null : decennaleAssureur,
      decennaleExpireLe:
        decennaleExpireLe === '' ? null : new Date(`${decennaleExpireLe}T00:00:00Z`),
      nombrePrestations: fiche.nombrePrestations,
    }),
    [
      description,
      slogan,
      telephone,
      email,
      siteWeb,
      atouts,
      decennaleNumero,
      decennaleAssureur,
      decennaleExpireLe,
      horaires,
      fiche,
    ],
  );

  const completude = useMemo(() => completudeFiche(etat), [etat]);
  const criteres = useMemo(() => criteresFiche(etat), [etat]);

  function erreur(champ: string): string | undefined {
    return problemes.find((probleme) => probleme.champ === champ)?.message;
  }

  function changeAtout(rang: number, valeur: string) {
    setAtouts((actuels) => actuels.map((atout, index) => (index === rang ? valeur : atout)));
  }

  async function enregistre(): Promise<void> {
    setEnregistrement(true);
    setProblemes([]);
    setMessage(null);
    try {
      const reponse = await fetch('/api/pro/fiche', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description,
          slogan,
          telephone,
          email,
          siteWeb,
          atouts,
          decennaleNumero,
          decennaleAssureur,
          decennaleExpireLe,
          horaires,
        }),
      });

      if (reponse.ok) {
        setMessage('Votre fiche est enregistrée.');
        return;
      }

      const corps = (await reponse.json()) as {
        erreur?: string;
        problemes?: readonly { champ: string; message: string }[];
      };
      if (corps.problemes !== undefined && corps.problemes.length > 0) {
        setProblemes(corps.problemes);
        return;
      }
      setMessage(corps.erreur ?? 'Votre fiche n’a pas pu être enregistrée.');
    } catch {
      setMessage(
        'Nous n’avons pas pu joindre nos serveurs. Votre saisie est conservée : réessayez dans un instant.',
      );
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="min-w-0">
        {message !== null && (
          <p
            role="status"
            className="border-succes/25 bg-succes-fond text-succes mb-6 rounded-[var(--radius-carte)] border p-4 text-sm font-semibold"
          >
            {message}
          </p>
        )}

        <Carte className="p-5">
          <h2 className="text-xl">Ce que lisent les visiteurs</h2>
          <ZoneTexte
            className="mt-5"
            etiquette="Présentation de votre entreprise"
            rows={6}
            maxLength={1200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Entreprise familiale installée dans le 11e depuis 1998. Recherche de fuite, dépannage d’urgence et rénovation complète de salle de bain."
            aide={`${String(description.length)} / 1 200 caractères. À partir de ${String(LONGUEUR_PRESENTATION_UTILE)}, elle compte dans votre complétude.`}
            {...(erreur('description') !== undefined ? { erreur: erreur('description') } : {})}
          />
          <Champ
            className="mt-5"
            etiquette="Slogan"
            value={slogan}
            maxLength={120}
            onChange={(e) => setSlogan(e.target.value)}
            placeholder="Le dépannage sans mauvaise surprise"
            aide="Une phrase, affichée sous votre nom."
          />
        </Carte>

        <Carte className="mt-6 p-5">
          <h2 className="text-xl">Vos atouts</h2>
          <p className="text-encre-70 mt-2 text-sm">
            Les trois premiers s’affichent sur votre carte dans les résultats. Écrivez ce qui vous
            distingue vraiment, pas ce que tout le monde promet.
          </p>
          <div className="mt-5 space-y-3">
            {atouts.map((atout, rang) => (
              <div key={rang} className="flex items-end gap-2">
                <Champ
                  className="min-w-0 flex-1"
                  etiquette={`Atout ${String(rang + 1)}`}
                  value={atout}
                  maxLength={120}
                  onChange={(e) => changeAtout(rang, e.target.value)}
                  placeholder={rang === 0 ? 'Devis gratuit sous 24 h' : ''}
                />
                {atouts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setAtouts((a) => a.filter((_, index) => index !== rang))}
                    className="text-encre-55 hover:text-alerte min-h-11 shrink-0 px-3 text-sm font-semibold transition-colors"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
          {atouts.length < ATOUTS_MAXIMUM && (
            <Bouton aspect="discret" className="mt-3" onClick={() => setAtouts((a) => [...a, ''])}>
              Ajouter un atout
            </Bouton>
          )}
          {erreur('atouts') !== undefined && (
            <p className="text-alerte mt-3 text-sm font-semibold">{erreur('atouts')}</p>
          )}
        </Carte>

        <Carte className="mt-6 p-5">
          <h2 className="text-xl">Comment on vous joint</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Champ
              etiquette="Téléphone"
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
            <Champ
              etiquette="Adresse électronique"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              {...(erreur('email') !== undefined ? { erreur: erreur('email') } : {})}
            />
          </div>
          <Champ
            className="mt-4"
            etiquette="Site internet"
            value={siteWeb}
            onChange={(e) => setSiteWeb(e.target.value)}
            placeholder="https://"
            {...(erreur('siteWeb') !== undefined ? { erreur: erreur('siteWeb') } : {})}
          />
        </Carte>

        <Carte className="mt-6 p-5">
          <h2 className="text-xl">Vos horaires</h2>
          <p className="text-encre-70 mt-2 text-sm">
            Ils disent à un visiteur s’il peut appeler maintenant. Laissez un jour vide pour le
            déclarer fermé, et ajoutez une seconde plage si vous fermez le midi.
          </p>

          <div className="mt-5 space-y-3">
            {JOURS.map((jour) => (
              <LigneJour
                key={jour}
                jour={jour}
                creneaux={horaires[jour]}
                onChange={(creneaux) =>
                  setHoraires((actuels) => ({ ...actuels, [jour]: creneaux }))
                }
              />
            ))}
          </div>

          {problemesHoraires(horaires).length > 0 && (
            <ul className="text-alerte mt-4 space-y-1 text-sm font-semibold">
              {problemesHoraires(horaires).map((probleme) => (
                <li key={`${probleme.jour}-${probleme.message}`}>
                  {LIBELLE_JOUR[probleme.jour]} : {probleme.message}
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte className="mt-6 p-5">
          <h2 className="text-xl">Assurance décennale</h2>
          <p className="text-encre-70 mt-2 text-sm">
            Une attestation en cours de validité est l’un des éléments qui comptent le plus pour un
            client. Une attestation expirée ne compte pas : c’est la même chose que pas
            d’attestation.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Champ
              etiquette="Assureur"
              value={decennaleAssureur}
              onChange={(e) => setDecennaleAssureur(e.target.value)}
            />
            <Champ
              etiquette="Numéro de contrat"
              value={decennaleNumero}
              onChange={(e) => setDecennaleNumero(e.target.value)}
            />
          </div>
          <Champ
            className="mt-4 max-w-xs"
            etiquette="Échéance"
            type="date"
            value={decennaleExpireLe}
            onChange={(e) => setDecennaleExpireLe(e.target.value)}
            {...(erreur('decennaleExpireLe') !== undefined
              ? { erreur: erreur('decennaleExpireLe') }
              : {})}
          />
        </Carte>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Bouton
            aspect="or"
            taille="grand"
            onClick={() => void enregistre()}
            disabled={enregistrement}
          >
            {enregistrement ? 'Enregistrement…' : 'Enregistrer ma fiche'}
          </Bouton>
          <a
            href={`/entreprise/${fiche.slug}`}
            className="text-or-fonce text-sm font-semibold underline underline-offset-4"
          >
            Voir ma fiche telle qu’elle s’affiche
          </a>
        </div>
      </div>

      {/* ── Ce que chaque champ rapporte ───────────────────────────────── */}
      <Carte className="p-5 lg:sticky lg:top-6">
        <div className="flex items-center gap-4">
          <Anneau valeur={completude} etiquette="Fiche" />
          <div className="min-w-0">
            <p className="text-encre font-[family-name:var(--font-titre)] text-2xl">
              {Math.round(completude * 100)} %
            </p>
            <p className="text-encre-70 text-sm">de complétude</p>
          </div>
        </div>

        <p className="text-encre-70 mt-4 text-sm">
          Une fiche complète est mieux classée dans les résultats naturels, et c’est l’une des deux
          conditions de la garantie Exclusif.
        </p>

        <ul className="border-bordure mt-5 space-y-2.5 border-t pt-5">
          {[...criteres]
            .toSorted((a, b) => Number(a.acquis) - Number(b.acquis) || b.poids - a.poids)
            .map((critere) => (
              <LigneCritere key={critere.cle} critere={critere} />
            ))}
        </ul>

        <p className="text-encre-55 mt-5 text-xs">
          Les photos, le logo et l’image de couverture demandent un téléversement : ils se régleront
          depuis l’écran des visuels. Ils comptent ici pour que ce pourcentage ne vous mente pas.
        </p>
      </Carte>
    </div>
  );
}

function LigneCritere({ critere }: { readonly critere: CritereFiche }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold',
          critere.acquis ? 'bg-succes-fond text-succes' : 'bg-encre/[0.06] text-encre-55',
        )}
      >
        {critere.acquis ? '✓' : '·'}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm font-semibold',
            critere.acquis ? 'text-encre-55 line-through' : 'text-encre',
          )}
        >
          {critere.libelle}
          <span className="text-encre-40 ml-1.5 text-xs font-normal">
            +{Math.round(critere.poids * 100)} %
          </span>
          <span className="sr-only">{critere.acquis ? ' — fait' : ' — à faire'}</span>
        </span>
        {!critere.acquis && <span className="text-encre-70 block text-xs">{critere.action}</span>}
      </span>
    </li>
  );
}

/**
 * Une journée de la semaine : jusqu'à deux plages.
 *
 * Deux et pas une, parce que la pause du midi est la règle chez les artisans ; deux et pas
 * dix, parce qu'un horaire d'ouverture n'est pas un emploi du temps. Un jour sans plage est
 * fermé — et il est écrit « Fermé », pour que l'absence se lise comme une information et non
 * comme un oubli.
 */
function LigneJour({
  jour,
  creneaux,
  onChange,
}: {
  readonly jour: Jour;
  readonly creneaux: readonly Creneau[];
  readonly onChange: (creneaux: readonly Creneau[]) => void;
}) {
  function changeBorne(rang: number, borne: 'debut' | 'fin', minutes: number) {
    onChange(
      creneaux.map((creneau, index) =>
        index === rang ? { ...creneau, [borne]: minutes } : creneau,
      ),
    );
  }

  // En colonne sur téléphone : trois champs d'heure et deux boutons sur une seule ligne
  // débordent de la fenêtre, et un écran qui défile latéralement est un écran cassé.
  return (
    <div className="border-bordure flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
      <span className="text-encre text-sm font-semibold sm:w-24 sm:shrink-0">
        {LIBELLE_JOUR[jour]}
      </span>

      {creneaux.length === 0 ? (
        <span className="text-encre-55 flex-1 text-sm">Fermé</span>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {creneaux.map((creneau, rang) => (
            <span key={rang} className="flex min-w-0 items-center gap-1.5">
              <ChoixHeure
                etiquette={`${LIBELLE_JOUR[jour]}, plage ${String(rang + 1)}, ouverture`}
                valeur={creneau.debut}
                onChange={(minutes) => changeBorne(rang, 'debut', minutes)}
              />
              <span className="text-encre-55 text-sm">–</span>
              <ChoixHeure
                etiquette={`${LIBELLE_JOUR[jour]}, plage ${String(rang + 1)}, fermeture`}
                valeur={creneau.fin}
                onChange={(minutes) => changeBorne(rang, 'fin', minutes)}
              />
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 sm:shrink-0">
        {creneaux.length < 2 && (
          <button
            type="button"
            onClick={() =>
              onChange([
                ...creneaux,
                creneaux.length === 0
                  ? { debut: 8 * 60, fin: 12 * 60 }
                  : { debut: 14 * 60, fin: 18 * 60 },
              ])
            }
            className="text-or-fonce hover:text-encre min-h-11 px-2 text-sm font-semibold transition-colors"
          >
            {creneaux.length === 0 ? 'Ouvrir' : 'Ajouter une plage'}
          </button>
        )}
        {creneaux.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(creneaux.slice(0, -1))}
            className="text-encre-55 hover:text-alerte min-h-11 px-2 text-sm font-semibold transition-colors"
          >
            {creneaux.length === 1 ? 'Fermer' : 'Retirer'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Le choix d'une heure, en liste déroulante plutôt qu'en champ natif.
 *
 * `<input type="time">` affiche l'heure dans la langue **du navigateur**, pas dans celle de la
 * page : sur un navigateur configuré en anglais, un artisan francophone lisait « 08:00 AM » sur
 * son propre écran. Une liste que nous écrivons dit « 8 h » partout, et elle se manipule aussi
 * bien au doigt qu'à la souris.
 */
function ChoixHeure({
  etiquette,
  valeur,
  onChange,
}: {
  readonly etiquette: string;
  readonly valeur: number;
  readonly onChange: (minutes: number) => void;
}) {
  return (
    <select
      aria-label={etiquette}
      value={valeur}
      onChange={(e) => onChange(Number(e.target.value))}
      className="border-bordure bg-carte text-encre focus:border-or min-h-11 min-w-0 rounded-[var(--radius-douce)] border px-2.5 text-sm focus:outline-none"
    >
      {heuresProposees(valeur).map((minutes) => (
        <option key={minutes} value={minutes}>
          {heureLisible(minutes)}
        </option>
      ))}
    </select>
  );
}
