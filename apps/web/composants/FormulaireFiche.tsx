'use client';

import { useMemo, useState } from 'react';
import { Anneau, Bouton, Carte, Champ, ZoneTexte, cn } from '@lerenom/ui';
import {
  ATOUTS_MAXIMUM,
  LONGUEUR_PRESENTATION_UTILE,
  completudeFiche,
  criteresFiche,
  type CritereFiche,
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
 * Les quatre éléments qu'on ne saisit pas ici — photos, logo, couverture, horaires — sont tout
 * de même nommés : les taire donnerait une fiche « complète » à 100 % qui ne l'est pas.
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
      horaires: fiche.horairesPosees ? {} : null,
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
          Les photos, le logo, l’image de couverture et les horaires se règlent depuis les autres
          écrans de votre espace. Ils comptent ici pour que ce pourcentage ne vous mente pas.
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
