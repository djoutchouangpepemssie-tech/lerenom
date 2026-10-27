'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarreCollante,
  Bouton,
  Carte,
  Champ,
  Jauge,
  Liste,
  Puce,
  ZoneTexte,
  cn,
} from '@lerenom/ui';
import { codeBienForme, mobileFrancaisValide, TENTATIVES_MAX } from '@lerenom/core';
import type { SuggestionVille } from '@/app/api/recherche/route';
import { QUESTIONS_PAR_UNIVERS } from '@/lib/questions-demande';

export interface PrestationChoix {
  readonly slug: string;
  readonly nom: string;
  readonly tresDemande: boolean;
}
export interface MetierChoix {
  readonly slug: string;
  readonly nom: string;
  readonly prestations: readonly PrestationChoix[];
}
export interface UniversChoix {
  readonly slug: string;
  readonly nom: string;
  readonly couleur: string;
  readonly icone: string;
  readonly metiers: readonly MetierChoix[];
}

const ETAPES = ['Service', 'Détails', 'Où et quand', 'Coordonnées', 'Vérification'] as const;

const URGENCES = [
  { cle: 'normale', libelle: 'Je ne suis pas pressé' },
  { cle: 'rapide', libelle: 'Dans les 48 heures' },
  { cle: 'urgente', libelle: 'Urgence, sous 2 heures' },
] as const;

const DELAIS = [
  'Dès que possible',
  'Dans la semaine',
  'Dans le mois',
  'Je me renseigne pour plus tard',
] as const;

/**
 * Le texte exact du consentement. Il est envoyé avec la demande et conservé tel quel : c'est
 * lui qui fera foi, et le réécrire ici sans le changer en base serait précisément le genre de
 * décalage qu'un litige révèle.
 */
const CONSENTEMENT =
  'J’accepte que mes coordonnées soient transmises aux professionnels qui acceptent ma demande, ' +
  'dans la limite de 3, et je comprends que les partenaires de Le Renom sont contactés en priorité.';

function normalise(texte: string): string {
  return texte.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function FormulaireDemande({ univers }: { readonly univers: readonly UniversChoix[] }) {
  const [etape, setEtape] = useState(0);

  // Étape 1
  const [recherche, setRecherche] = useState('');
  const [universSlug, setUniversSlug] = useState(univers[0]?.slug ?? '');
  const [metierSlug, setMetierSlug] = useState('');
  const [prestation, setPrestation] = useState<{
    slug: string;
    nom: string;
    metier: string;
    univers: string;
    universSlug: string;
  } | null>(null);

  // Étape 2
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [description, setDescription] = useState('');
  const [urgence, setUrgence] = useState<(typeof URGENCES)[number]['cle']>('normale');

  // Étape 3
  const [ville, setVille] = useState<SuggestionVille | null>(null);
  const [rechercheVille, setRechercheVille] = useState('');
  const [villesTrouvees, setVillesTrouvees] = useState<readonly SuggestionVille[]>([]);
  const [adresse, setAdresse] = useState('');
  const [delai, setDelai] = useState<string>(DELAIS[0]);

  // Étape 4
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [consent, setConsent] = useState(false);

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ reference: string; villeOuverte: boolean } | null>(
    null,
  );

  // Étape 5 : la vérification du mobile. Tant qu'elle n'est pas faite, la demande ne part pas.
  const [code, setCode] = useState('');
  const [verification, setVerification] = useState(false);
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const [tentativesRestantes, setTentativesRestantes] = useState<number | null>(null);
  const [nouveauCodeRequis, setNouveauCodeRequis] = useState(false);
  const [renvoye, setRenvoye] = useState(false);
  const [verifie, setVerifie] = useState(false);

  const universCourant = univers.find((u) => u.slug === universSlug) ?? univers[0];
  const metierCourant = universCourant?.metiers.find((m) => m.slug === metierSlug);

  const resultatsRecherche = useMemo(() => {
    const requete = normalise(recherche.trim());
    if (requete.length < 2) return [];
    return univers
      .flatMap((u) =>
        u.metiers.flatMap((m) =>
          m.prestations.map((p) => ({
            slug: p.slug,
            nom: p.nom,
            metier: m.nom,
            univers: u.nom,
            universSlug: u.slug,
            couleur: u.couleur,
          })),
        ),
      )
      .filter((p) => normalise(p.nom).includes(requete) || normalise(p.metier).includes(requete))
      .slice(0, 12);
  }, [recherche, univers]);

  const questions =
    prestation === null ? [] : (QUESTIONS_PAR_UNIVERS[prestation.universSlug] ?? []);

  const etapeValide = [
    prestation !== null,
    description.trim().length >= 10,
    ville !== null,
    prenom.trim().length >= 2 && email.includes('@') && mobileFrancaisValide(telephone) && consent,
    true,
  ][etape];

  async function envoie() {
    if (prestation === null || ville === null) return;
    setEnvoi(true);
    setErreur(null);

    try {
      const reponse = await fetch('/api/demande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestationSlug: prestation.slug,
          communeCode: ville.code,
          description: description.trim(),
          reponses,
          urgence,
          delaiSouhaite: delai,
          adresse: adresse.trim() === '' ? undefined : adresse.trim(),
          clientPrenom: prenom.trim(),
          clientEmail: email.trim(),
          clientTelephone: telephone.trim(),
          consentementTexte: CONSENTEMENT,
        }),
      });

      // `json()` rend `any` : on passe par `unknown` avant de nommer la forme attendue,
      // plutôt que de laisser un `any` se propager dans le composant.
      const brut: unknown = await reponse.json();
      const donnees = brut as { reference?: string; villeOuverte?: boolean; erreur?: string };

      if (!reponse.ok || donnees.reference === undefined) {
        setErreur(donnees.erreur ?? 'Votre demande n’a pas pu être enregistrée.');
        return;
      }

      setResultat({ reference: donnees.reference, villeOuverte: donnees.villeOuverte === true });
      setEtape(4);
    } catch {
      setErreur('Votre demande n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.');
    } finally {
      setEnvoi(false);
    }
  }

  /** Confronte le code saisi. C'est ce qui fait partir la demande, rien d'autre. */
  async function verifieLeCode() {
    if (resultat === null || !codeBienForme(code)) return;
    setVerification(true);
    setErreurCode(null);

    try {
      const reponse = await fetch('/api/demande/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: resultat.reference, code }),
      });

      const brut: unknown = await reponse.json();
      const donnees = brut as {
        statut?: string;
        erreur?: string;
        tentativesRestantes?: number;
        nouveauCodeRequis?: boolean;
      };

      if (reponse.ok) {
        setVerifie(true);
        setErreurCode(null);
        setTentativesRestantes(null);
        return;
      }

      setErreurCode(donnees.erreur ?? 'Ce code n’a pas pu être vérifié.');
      setTentativesRestantes(donnees.tentativesRestantes ?? null);
      setNouveauCodeRequis(donnees.nouveauCodeRequis === true);
    } catch {
      setErreurCode('Le code n’a pas pu être vérifié. Vérifiez votre connexion et réessayez.');
    } finally {
      setVerification(false);
    }
  }

  /** « Je n'ai rien reçu » : un nouveau code, et le compteur de tentatives repart de zéro. */
  async function renvoieLeCode() {
    if (resultat === null) return;
    setVerification(true);
    setErreurCode(null);

    try {
      await fetch('/api/demande/verification', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: resultat.reference }),
      });
      setRenvoye(true);
      setNouveauCodeRequis(false);
      setTentativesRestantes(null);
      setCode('');
    } catch {
      setErreurCode('Le nouveau code n’a pas pu être envoyé. Réessayez dans un instant.');
    } finally {
      setVerification(false);
    }
  }

  function chercheVille(texte: string) {
    setRechercheVille(texte);
    setVille(null);
    if (texte.trim().length < 2) {
      setVillesTrouvees([]);
      return;
    }
    void fetch(`/api/recherche?genre=villes&q=${encodeURIComponent(texte)}`)
      .then((r) => r.json())
      .then((d: { villes: SuggestionVille[] }) => setVillesTrouvees(d.villes))
      .catch(() => setVillesTrouvees([]));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div>
        {/* Progression */}
        <ol className="mb-8 flex flex-wrap gap-x-5 gap-y-2" aria-label="Étapes">
          {ETAPES.map((nom, index) => (
            <li
              key={nom}
              aria-current={index === etape ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 text-sm font-semibold',
                index === etape ? 'text-encre' : index < etape ? 'text-succes' : 'text-encre-40',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs',
                  index === etape
                    ? 'bg-or text-encre'
                    : index < etape
                      ? 'bg-succes-fond text-succes'
                      : 'bg-encre/[0.06] text-encre-40',
                )}
              >
                {index < etape ? '✓' : index + 1}
              </span>
              {nom}
            </li>
          ))}
        </ol>

        <Carte className="p-5 md:p-7">
          {/* ── 1. Service ──────────────────────────────────────────────── */}
          {etape === 0 && (
            <div>
              <h2 className="text-2xl">De quoi avez-vous besoin ?</h2>
              <p className="text-encre-70 mt-2 text-sm">
                Cherchez votre prestation, ou parcourez les univers.
              </p>

              <Champ
                className="mt-5"
                etiquette="Rechercher une prestation"
                placeholder="Fuite, nettoyage de canapé, serrure…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />

              {resultatsRecherche.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                  {resultatsRecherche.map((p) => (
                    <li key={p.slug}>
                      <button
                        type="button"
                        onClick={() => {
                          setPrestation(p);
                          setRecherche('');
                        }}
                        className="border-bordure hover:border-or flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-douce)] border px-4 text-left transition-colors"
                      >
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: p.couleur }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-encre block text-sm font-semibold">{p.nom}</span>
                          <span className="text-encre-55 block text-xs">
                            {p.univers} › {p.metier}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-encre-40 mb-2 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                      Univers
                    </p>
                    <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
                      {univers.map((u) => (
                        <li key={u.slug}>
                          <button
                            type="button"
                            onClick={() => {
                              setUniversSlug(u.slug);
                              setMetierSlug('');
                            }}
                            aria-pressed={u.slug === universCourant?.slug}
                            className={cn(
                              'flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-douce)] px-3 text-left text-sm font-semibold transition-colors',
                              u.slug === universCourant?.slug
                                ? 'bg-creme text-encre'
                                : 'text-encre-70 hover:bg-creme',
                            )}
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="size-4 shrink-0"
                              style={{ color: u.couleur }}
                            >
                              <path d={u.icone} fill="currentColor" />
                            </svg>
                            <span className="min-w-0 flex-1 truncate">{u.nom}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-encre-40 mb-2 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                      Métier
                    </p>
                    <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
                      {universCourant?.metiers.map((m) => (
                        <li key={m.slug}>
                          <button
                            type="button"
                            onClick={() => setMetierSlug(m.slug)}
                            aria-pressed={m.slug === metierSlug}
                            className={cn(
                              'min-h-11 w-full rounded-[var(--radius-douce)] px-3 text-left text-sm font-semibold transition-colors',
                              m.slug === metierSlug
                                ? 'bg-creme text-encre'
                                : 'text-encre-70 hover:bg-creme',
                            )}
                          >
                            {m.nom}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-encre-40 mb-2 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                      Prestation
                    </p>
                    {metierCourant === undefined ? (
                      <p className="text-encre-40 px-3 text-sm">Choisissez d’abord un métier.</p>
                    ) : (
                      <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
                        {metierCourant.prestations.map((p) => (
                          <li key={p.slug}>
                            <button
                              type="button"
                              onClick={() =>
                                setPrestation({
                                  slug: p.slug,
                                  nom: p.nom,
                                  metier: metierCourant.nom,
                                  univers: universCourant?.nom ?? '',
                                  universSlug: universCourant?.slug ?? '',
                                })
                              }
                              aria-pressed={p.slug === prestation?.slug}
                              className={cn(
                                'flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-douce)] px-3 text-left text-sm transition-colors',
                                p.slug === prestation?.slug
                                  ? 'bg-or/15 text-or-fonce font-semibold'
                                  : 'text-encre-70 hover:bg-creme',
                              )}
                            >
                              <span className="min-w-0 flex-1">{p.nom}</span>
                              {p.tresDemande && (
                                <span className="bg-or/15 text-or-fonce shrink-0 rounded-full px-1.5 text-[0.6rem] font-bold">
                                  ★
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 2. Détails ──────────────────────────────────────────────── */}
          {etape === 1 && (
            <div>
              <h2 className="text-2xl">Parlez-nous de votre besoin</h2>
              <p className="text-encre-70 mt-2 text-sm">
                Plus c’est précis, plus les devis seront justes — et moins vous aurez de mauvaises
                surprises.
              </p>

              {questions.length > 0 && (
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {questions.map((question) => (
                    <Liste
                      key={question.cle}
                      etiquette={question.libelle}
                      value={reponses[question.cle] ?? ''}
                      onChange={(e) => setReponses({ ...reponses, [question.cle]: e.target.value })}
                    >
                      <option value="">Je ne sais pas</option>
                      {question.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Liste>
                  ))}
                </div>
              )}

              <ZoneTexte
                className="mt-5"
                etiquette="Décrivez votre besoin"
                rows={5}
                maxLength={600}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Une fuite sous l’évier de la cuisine depuis hier soir, l’eau coule dès que j’ouvre le robinet."
                aide={`${description.length} / 600 caractères. Les numéros de téléphone et adresses électroniques écrits ici sont retirés automatiquement avant l’envoi aux professionnels.`}
              />

              <fieldset className="mt-6">
                <legend className="text-encre text-sm font-semibold">Quel est votre délai ?</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {URGENCES.map((option) => (
                    <Puce
                      key={option.cle}
                      active={urgence === option.cle}
                      onBascule={() => setUrgence(option.cle)}
                    >
                      {option.libelle}
                    </Puce>
                  ))}
                </div>
                {urgence === 'urgente' && (
                  <p className="bg-alerte-fond text-alerte mt-3 rounded-[var(--radius-douce)] px-4 py-3 text-sm">
                    Une intervention sous 2 heures n’est proposée qu’aux professionnels abonnés et
                    disponibles de votre zone. Si personne n’accepte, nous vous le disons tout de
                    suite plutôt que de vous faire attendre.
                  </p>
                )}
              </fieldset>
            </div>
          )}

          {/* ── 3. Où et quand ──────────────────────────────────────────── */}
          {etape === 2 && (
            <div>
              <h2 className="text-2xl">Où se passent les travaux ?</h2>

              <div className="relative mt-5">
                <Champ
                  etiquette="Ville"
                  placeholder="Paris 11e, Montreuil, 93100…"
                  value={ville !== null ? ville.nom : rechercheVille}
                  onChange={(e) => chercheVille(e.target.value)}
                  autoComplete="off"
                />
                {ville === null && villesTrouvees.length > 0 && (
                  <ul className="border-bordure bg-carte shadow-levee absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-carte)] border py-1.5">
                    {villesTrouvees.map((v) => (
                      <li key={v.slug}>
                        <button
                          type="button"
                          onClick={() => {
                            setVille(v);
                            setVillesTrouvees([]);
                          }}
                          className="hover:bg-creme flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-sm"
                        >
                          <span className="text-encre min-w-0 flex-1 truncate font-medium">
                            {v.nom}
                            {v.codePostal !== null && (
                              <span className="text-encre-40 ml-1.5 font-mono text-xs">
                                {v.codePostal}
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold',
                              v.statut === 'ouvert'
                                ? 'bg-succes-fond text-succes'
                                : v.statut === 'bientot'
                                  ? 'bg-alerte-fond text-alerte'
                                  : 'bg-encre/[0.06] text-encre-55',
                            )}
                          >
                            {v.statut === 'ouvert'
                              ? 'Devis ouverts'
                              : v.statut === 'bientot'
                                ? 'Ouvre bientôt'
                                : 'Annuaire'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {ville !== null && ville.statut !== 'ouvert' && (
                <p className="bg-alerte-fond text-alerte mt-4 rounded-[var(--radius-douce)] px-4 py-3 text-sm">
                  Les demandes de devis ne sont pas encore ouvertes à {ville.nom}. Votre demande
                  sera enregistrée, mais{' '}
                  <strong>elle ne partira pas chez les professionnels</strong> : nous vous
                  préviendrons dès l’ouverture, et vous confirmerez par SMS.
                </p>
              )}

              <Champ
                className="mt-5"
                etiquette="Adresse (facultatif à ce stade)"
                placeholder="12 rue de la Roquette"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                aide="Les professionnels ne voient que votre quartier avant d’accepter votre demande."
                autoComplete="street-address"
              />

              <Liste
                className="mt-5"
                etiquette="Quand souhaitez-vous l’intervention ?"
                value={delai}
                onChange={(e) => setDelai(e.target.value)}
              >
                {DELAIS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Liste>
            </div>
          )}

          {/* ── 4. Coordonnées ──────────────────────────────────────────── */}
          {etape === 3 && (
            <div>
              <h2 className="text-2xl">Comment vous joindre ?</h2>
              <p className="text-encre-70 mt-2 text-sm">
                Vous n’avez pas de compte à créer. Tout arrive par SMS et par e-mail.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Champ
                  etiquette="Prénom"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  autoComplete="given-name"
                />
                <Champ
                  etiquette="Mobile"
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  autoComplete="tel"
                  placeholder="06 12 34 56 78"
                  aide="Un code à 6 chiffres vérifiera ce numéro avant l’envoi."
                  erreur={
                    telephone.length > 0 && !mobileFrancaisValide(telephone)
                      ? 'Indiquez un mobile français, à 10 chiffres.'
                      : undefined
                  }
                />
                <Champ
                  className="md:col-span-2"
                  etiquette="Adresse électronique"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <label className="border-bordure bg-creme mt-6 flex cursor-pointer gap-3 rounded-[var(--radius-carte)] border p-4">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-[var(--color-or)]"
                />
                <span className="text-encre-70 text-sm leading-relaxed">{CONSENTEMENT}</span>
              </label>

              {erreur !== null && (
                <p
                  role="alert"
                  className="bg-erreur-fond text-erreur mt-4 rounded-[var(--radius-douce)] px-4 py-3 text-sm"
                >
                  {erreur}
                </p>
              )}
            </div>
          )}

          {/* ── 5. Vérification du mobile ──────────────────────────────── */}
          {etape === 4 && resultat !== null && !resultat.villeOuverte && (
            <div className="text-center">
              <span className="bg-succes-fond text-succes mx-auto flex size-14 items-center justify-center rounded-full text-2xl">
                ✓
              </span>
              <h2 className="mt-5 text-2xl">Nous vous préviendrons à l’ouverture</h2>
              <p className="text-encre-70 mx-auto mt-3 max-w-[52ch] text-sm leading-relaxed">
                Les demandes de devis ne sont pas encore ouvertes dans cette ville. Votre demande
                est conservée et ne part chez personne. Nous vous préviendrons dès l’ouverture, et
                vous confirmerez par SMS avant tout envoi.
              </p>
              <p className="text-encre-55 mt-5 font-mono text-sm">
                Référence : <strong className="text-encre">{resultat.reference}</strong>
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/">
                  <Bouton aspect="contour">Retour à l’accueil</Bouton>
                </Link>
                <Link href="/guide-des-prix">
                  <Bouton aspect="or">Consulter le guide des prix</Bouton>
                </Link>
              </div>
            </div>
          )}

          {etape === 4 && resultat !== null && resultat.villeOuverte && !verifie && (
            <div className="mx-auto max-w-[36rem] text-center">
              <span className="bg-or/12 text-or-fonce mx-auto flex size-14 items-center justify-center rounded-full text-2xl">
                ✉
              </span>
              <h2 className="mt-5 text-2xl">Vérifiez votre mobile</h2>
              <p className="text-encre-70 mx-auto mt-3 max-w-[46ch] text-sm leading-relaxed">
                Nous venons d’envoyer un code à 6 chiffres au{' '}
                <strong className="text-encre whitespace-nowrap">{telephone.trim()}</strong>. Votre
                demande ne part chez personne avant que ce code soit saisi.
              </p>

              <div className="mt-7">
                <label htmlFor="code-verification" className="sr-only">
                  Code de vérification à 6 chiffres
                </label>
                <input
                  id="code-verification"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setErreurCode(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && codeBienForme(code)) void verifieLeCode();
                  }}
                  placeholder="000000"
                  aria-describedby={erreurCode !== null ? 'code-erreur' : undefined}
                  aria-invalid={erreurCode !== null}
                  className={cn(
                    'bg-creme mx-auto block w-full max-w-[16rem] rounded-[var(--radius-douce)]',
                    // L'interlettrage ajoute un blanc après le dernier chiffre : sans
                    // retrait compensatoire, la saisie paraît décalée vers la gauche.
                    'border px-4 py-4 text-center font-mono text-[1.75rem] tracking-[0.5em]',
                    'indent-[0.5em]',
                    'text-encre placeholder:text-encre-40 outline-none',
                    'focus-visible:border-or focus-visible:ring-or/30 focus-visible:ring-4',
                    erreurCode !== null ? 'border-erreur' : 'border-bordure',
                  )}
                />
              </div>

              {erreurCode !== null && (
                <p
                  id="code-erreur"
                  role="alert"
                  className="bg-erreur-fond text-erreur mx-auto mt-4 max-w-[34rem] rounded-[var(--radius-douce)] px-4 py-3 text-sm"
                >
                  {erreurCode}
                  {tentativesRestantes !== null && tentativesRestantes > 0 && (
                    <>
                      {' '}
                      Il vous reste {tentativesRestantes}{' '}
                      {tentativesRestantes === 1 ? 'tentative' : 'tentatives'}.
                    </>
                  )}
                </p>
              )}

              {renvoye && erreurCode === null && (
                <p
                  role="status"
                  className="bg-succes-fond text-succes mx-auto mt-4 max-w-[34rem] rounded-[var(--radius-douce)] px-4 py-3 text-sm"
                >
                  Un nouveau code vient de partir. Le précédent ne fonctionne plus.
                </p>
              )}

              <div className="mt-7 flex flex-col items-center gap-3">
                <Bouton
                  aspect="or"
                  taille="grand"
                  onClick={() => void verifieLeCode()}
                  disabled={!codeBienForme(code) || nouveauCodeRequis}
                  chargement={verification}
                >
                  Vérifier et envoyer ma demande
                </Bouton>
                <Bouton
                  aspect="discret"
                  onClick={() => void renvoieLeCode()}
                  disabled={verification}
                >
                  Je n’ai rien reçu, renvoyer un code
                </Bouton>
              </div>

              <p className="text-encre-55 mx-auto mt-6 max-w-[42ch] text-xs leading-relaxed">
                Le code est valable 15 minutes et {TENTATIVES_MAX} tentatives. Référence de votre
                demande : <span className="text-encre-70 font-mono">{resultat.reference}</span>
              </p>
            </div>
          )}

          {/* ── 6. Confirmation ─────────────────────────────────────────── */}
          {etape === 4 && resultat !== null && resultat.villeOuverte && verifie && (
            <div className="text-center">
              <span className="bg-succes-fond text-succes mx-auto flex size-14 items-center justify-center rounded-full text-2xl">
                ✓
              </span>
              <h2 className="mt-5 text-2xl">Votre demande est partie</h2>
              <p className="text-encre-70 mx-auto mt-3 max-w-[52ch] text-sm leading-relaxed">
                Votre numéro est vérifié et votre demande part à trois professionnels au maximum.
                Vous recevrez leurs coordonnées par SMS et par e-mail au fur et à mesure qu’ils
                acceptent. Passé 72 heures, elle ne sera transmise à personne d’autre.
              </p>
              <p className="text-encre-55 mt-5 font-mono text-sm">
                Référence : <strong className="text-encre">{resultat.reference}</strong>
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/">
                  <Bouton aspect="contour">Retour à l’accueil</Bouton>
                </Link>
                <Link href="/guide-des-prix">
                  <Bouton aspect="or">Consulter le guide des prix</Bouton>
                </Link>
              </div>
            </div>
          )}
        </Carte>

        {etape < 4 && (
          <BarreCollante className="mt-6 lg:static lg:border-0 lg:bg-transparent lg:px-0 lg:shadow-none">
            <div className="flex items-center justify-between gap-3">
              <Bouton
                aspect="discret"
                onClick={() => setEtape((e) => Math.max(0, e - 1))}
                disabled={etape === 0}
              >
                Retour
              </Bouton>
              {etape < 3 ? (
                <Bouton
                  aspect="or"
                  taille="grand"
                  onClick={() => setEtape((e) => e + 1)}
                  disabled={!etapeValide}
                  title={!etapeValide ? 'Complétez cette étape pour continuer.' : undefined}
                >
                  Continuer
                </Bouton>
              ) : (
                <Bouton
                  aspect="or"
                  taille="grand"
                  onClick={() => void envoie()}
                  disabled={!etapeValide}
                  chargement={envoi}
                >
                  Envoyer ma demande
                </Bouton>
              )}
            </div>
          </BarreCollante>
        )}
      </div>

      {/* ── Récapitulatif vivant ──────────────────────────────────────── */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <Carte className="p-5">
            <p className="text-encre-40 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
              Votre demande
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <Recap cle="Prestation" valeur={prestation?.nom ?? null} />
              <Recap cle="Métier" valeur={prestation?.metier ?? null} />
              <Recap cle="Ville" valeur={ville?.nom ?? null} />
              <Recap
                cle="Délai"
                valeur={URGENCES.find((u) => u.cle === urgence)?.libelle ?? null}
              />
              <Recap cle="Prénom" valeur={prenom.trim() === '' ? null : prenom} />
            </dl>
            <Jauge
              className="mt-5"
              valeur={etape}
              maximum={4}
              etiquette="Progression"
              detail={`Étape ${Math.min(etape + 1, 5)} sur 5`}
            />
          </Carte>

          <Carte className="border-or/25 bg-or/[0.05] p-5">
            <p className="text-encre text-sm font-bold">Ce qui ne changera pas</p>
            <ul className="text-encre-70 mt-3 space-y-2 text-xs leading-relaxed">
              <li>Trois professionnels au maximum, jamais plus.</li>
              <li>Jamais de transmission au-delà de 72 heures.</li>
              <li>Vos coordonnées seulement à ceux qui acceptent.</li>
              <li>Aucun compte à créer, aucun mot de passe.</li>
            </ul>
          </Carte>
        </div>
      </aside>
    </div>
  );
}

function Recap({ cle, valeur }: { readonly cle: string; readonly valeur: string | null }) {
  return (
    <div className="border-bordure flex justify-between gap-3 border-b pb-2 last:border-0">
      <dt className="text-encre-55 shrink-0">{cle}</dt>
      <dd
        className={cn('text-right', valeur === null ? 'text-encre-40' : 'text-encre font-semibold')}
      >
        {valeur ?? '—'}
      </dd>
    </div>
  );
}
