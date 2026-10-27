'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Anneau,
  BadgePayant,
  BarreCollante,
  Bouton,
  Carte,
  Champ,
  Jauge,
  Note,
  Puce,
  ZoneTexte,
  cn,
} from '@lerenom/ui';
import {
  FORMULES,
  PARAMETRES_PAR_DEFAUT,
  REGLES_VALIDEES,
  ajusteZonesPourFormule,
  formatEuros,
  nombreDePages,
  prixAnnuelHT,
  siretValide,
} from '@lerenom/core';
import type { Formule, VilleChoisie } from '@lerenom/core';

export interface MetierInscription {
  readonly slug: string;
  readonly nom: string;
  readonly prestations: readonly { readonly slug: string; readonly nom: string }[];
}
export interface UniversInscription {
  readonly slug: string;
  readonly nom: string;
  readonly couleur: string;
  readonly icone: string;
  readonly metiers: readonly MetierInscription[];
}
export interface CommuneInscription {
  readonly code: string;
  readonly nom: string;
  readonly statut: 'ouvert' | 'bientot' | 'annuaire';
  readonly population: number | null;
  readonly codePostal: string | null;
}
export interface DepartementInscription {
  readonly code: string;
  readonly nom: string;
  readonly communes: readonly CommuneInscription[];
}

const ETAPES = [
  'Entreprise',
  'Vérification',
  'Métiers',
  'Zones',
  'Fiche',
  'Formule',
  'Paiement',
  'Terminé',
] as const;

function normalise(texte: string): string {
  return texte.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * L'inscription d'un professionnel, en 8 étapes.
 *
 * Deux choses la distinguent d'un formulaire ordinaire, et ce sont elles qui vendent :
 *   * le **compteur de pages** est vivant — « 6 villes × 2 métiers = 12 pages » — et il utilise
 *     la même fonction que la page de tarifs, pour qu'un professionnel ne découvre pas un autre
 *     chiffre après avoir payé ;
 *   * quand la formule choisie autorise moins de villes que la sélection, les villes retirées
 *     sont **nommées**, dans l'ordre imposé : la ville du siège en dernier, puis les villes
 *     ouvertes, puis celles qui ouvrent bientôt, puis l'annuaire. Le professionnel voit ce qu'il
 *     perd avant de valider, et peut corriger.
 */
export function FormulaireInscription({
  univers,
  departements,
}: {
  readonly univers: readonly UniversInscription[];
  readonly departements: readonly DepartementInscription[];
}) {
  const [etape, setEtape] = useState(0);

  const [siret, setSiret] = useState('');
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [code, setCode] = useState('');

  const [metiersChoisis, setMetiersChoisis] = useState<readonly string[]>([]);
  const [metierPrincipal, setMetierPrincipal] = useState<string | null>(null);
  const [universActif, setUniversActif] = useState(univers[0]?.slug ?? '');

  const [villesChoisies, setVillesChoisies] = useState<readonly string[]>([]);
  const [departementActif, setDepartementActif] = useState(departements[0]?.code ?? '');
  const [rechercheVille, setRechercheVille] = useState('');
  const [communeSiege, setCommuneSiege] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [formule, setFormule] = useState<Formule>('gratuit');
  const [annuel, setAnnuel] = useState(false);

  const tousMetiers = useMemo(
    () => univers.flatMap((u) => u.metiers.map((m) => ({ ...m, univers: u }))),
    [univers],
  );
  const toutesCommunes = useMemo(
    () => departements.flatMap((d) => d.communes.map((c) => ({ ...c, departement: d }))),
    [departements],
  );

  const villesPourCore: VilleChoisie[] = useMemo(
    () =>
      villesChoisies.flatMap((codeCommune) => {
        const commune = toutesCommunes.find((c) => c.code === codeCommune);
        if (commune === undefined) return [];
        return [
          {
            code: commune.code,
            statut: commune.statut,
            population: commune.population ?? 0,
            ...(commune.code === communeSiege ? { siege: true } : {}),
          },
        ];
      }),
    [villesChoisies, toutesCommunes, communeSiege],
  );

  const ajustement = useMemo(
    () => ajusteZonesPourFormule(villesPourCore, formule, PARAMETRES_PAR_DEFAUT),
    [villesPourCore, formule],
  );

  const pages = nombreDePages(ajustement.conservees.length, metiersChoisis.length);
  const limiteVilles = REGLES_VALIDEES.villesMax[formule];

  const completude = useMemo(() => {
    const criteres = [
      siretValide(siret),
      nomEntreprise.trim().length > 1,
      metiersChoisis.length > 0,
      villesChoisies.length > 0,
      description.trim().length >= 60,
      email.includes('@'),
      telephone.trim().length >= 10,
    ];
    return criteres.filter(Boolean).length / criteres.length;
  }, [siret, nomEntreprise, metiersChoisis, villesChoisies, description, email, telephone]);

  const communesVisibles = useMemo(() => {
    const departement = departements.find((d) => d.code === departementActif);
    if (departement === undefined) return [];
    const requete = normalise(rechercheVille.trim());
    if (requete === '') return departement.communes.slice(0, 60);
    return departement.communes
      .filter((c) => normalise(c.nom).includes(requete) || (c.codePostal ?? '').startsWith(requete))
      .slice(0, 60);
  }, [departements, departementActif, rechercheVille]);

  const etapeValide = [
    siretValide(siret) && nomEntreprise.trim().length > 1,
    email.includes('@') && telephone.trim().length >= 10,
    metiersChoisis.length > 0 && metierPrincipal !== null,
    villesChoisies.length > 0,
    description.trim().length >= 60,
    true,
    true,
    true,
  ][etape];

  function basculeMetier(slug: string) {
    setMetiersChoisis((actuels) => {
      const suivant = actuels.includes(slug)
        ? actuels.filter((s) => s !== slug)
        : [...actuels, slug];
      if (metierPrincipal === slug && !suivant.includes(slug)) setMetierPrincipal(null);
      if (metierPrincipal === null && suivant.length > 0) setMetierPrincipal(suivant[0] ?? null);
      return suivant;
    });
  }

  function basculeVille(codeCommune: string) {
    setVillesChoisies((actuels) => {
      const suivant = actuels.includes(codeCommune)
        ? actuels.filter((c) => c !== codeCommune)
        : [...actuels, codeCommune];
      if (communeSiege === null && suivant.length > 0) setCommuneSiege(suivant[0] ?? null);
      if (communeSiege === codeCommune && !suivant.includes(codeCommune)) setCommuneSiege(null);
      return suivant;
    });
  }

  const prixMensuel = REGLES_VALIDEES.prixMensuelHT[formule];
  const prixPeriode = annuel ? prixAnnuelHT(formule) : prixMensuel;
  const tva = prixPeriode * PARAMETRES_PAR_DEFAUT.tauxTvaLeRenom;

  return (
    <div className="grid lg:min-h-[calc(100vh-4.5rem)] lg:grid-cols-[22rem_1fr]">
      {/* ── Colonne sombre : étapes et aperçu de la carte ─────────────────── */}
      <aside className="bg-nuit text-creme px-6 py-8 lg:px-8 lg:py-12">
        <p className="text-or-clair text-[0.68rem] font-bold tracking-[0.18em] uppercase">
          Inscription professionnelle
        </p>

        <ol className="mt-7 hidden space-y-1 lg:block">
          {ETAPES.map((nom, index) => (
            <li key={nom}>
              <button
                type="button"
                onClick={() => index < etape && setEtape(index)}
                disabled={index > etape}
                aria-current={index === etape ? 'step' : undefined}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-douce)] px-3 text-left text-sm font-semibold transition-colors',
                  index === etape
                    ? 'bg-creme/10 text-creme'
                    : index < etape
                      ? 'text-creme/70 hover:bg-creme/5'
                      : 'text-creme/35 cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs',
                    index === etape
                      ? 'bg-or text-encre'
                      : index < etape
                        ? 'bg-or/20 text-or-clair'
                        : 'bg-creme/10 text-creme/40',
                  )}
                >
                  {index < etape ? '✓' : index + 1}
                </span>
                {nom}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-6 lg:hidden">
          <Jauge
            valeur={etape + 1}
            maximum={ETAPES.length}
            etiquette={ETAPES[etape] ?? ''}
            detail={`Étape ${etape + 1} sur ${ETAPES.length}`}
          />
        </div>

        {/* L'aperçu vivant de la carte, qui change avec la formule : c'est lui qui vend. */}
        <div className="mt-8 lg:mt-10">
          <p className="text-creme/45 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Votre carte dans les résultats
          </p>
          <div className="mt-3">
            <Carte
              sombre={formule === 'exclusif'}
              liseréOr={formule === 'premium'}
              className={cn('p-4', formule === 'exclusif' ? '' : 'bg-carte')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'font-[family-name:var(--font-titre)] text-lg',
                    formule === 'exclusif' ? 'text-creme' : 'text-encre',
                  )}
                >
                  {nomEntreprise.trim() === '' ? 'Votre entreprise' : nomEntreprise}
                </span>
                {formule !== 'gratuit' && <BadgePayant formule={formule} sansInfoBulle />}
              </div>
              <div className="mt-1.5">
                <Note note={null} taille="petite" clair={formule === 'exclusif'} />
              </div>
              <p
                className={cn(
                  'mt-2 text-xs',
                  formule === 'exclusif' ? 'text-creme/60' : 'text-encre-55',
                )}
              >
                {metierPrincipal === null
                  ? 'Votre métier principal'
                  : (tousMetiers.find((m) => m.slug === metierPrincipal)?.nom ?? '')}
                {ajustement.conservees.length > 0 &&
                  ` · ${ajustement.conservees.length} ${ajustement.conservees.length > 1 ? 'villes' : 'ville'}`}
              </p>
            </Carte>
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-creme/55">Villes</dt>
              <dd className="text-creme font-semibold">
                {ajustement.conservees.length}
                {limiteVilles !== null && <span className="text-creme/40"> / {limiteVilles}</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-creme/55">Métiers</dt>
              <dd className="text-creme font-semibold">{metiersChoisis.length}</dd>
            </div>
            <div className="border-creme/10 flex justify-between gap-3 border-t pt-2">
              <dt className="text-creme/55">Pages où vous apparaissez</dt>
              <dd className="text-or-clair font-[family-name:var(--font-titre)] text-xl">
                {pages}
              </dd>
            </div>
          </dl>

          <div className="border-creme/10 mt-6 flex items-center gap-4 border-t pt-6">
            <Anneau valeur={completude} etiquette="Fiche" taille={64} />
            <p className="text-creme/55 text-xs leading-relaxed">
              Une fiche complète est mieux classée, et c’est l’une des deux conditions de la
              garantie Exclusif.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Contenu ───────────────────────────────────────────────────────── */}
      <div className="px-5 py-8 md:px-10 md:py-12">
        <div className="mx-auto max-w-3xl">
          {etape === 0 && (
            <Etape
              titre="Votre entreprise"
              sous="Nous vérifions votre SIRET pour éviter les doublons et les usurpations."
            >
              <Champ
                etiquette="Numéro SIRET"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                placeholder="732 829 320 00074"
                inputMode="numeric"
                aide="14 chiffres, visibles sur vos documents officiels."
                erreur={
                  siret.replace(/\s/g, '').length >= 14 && !siretValide(siret)
                    ? 'Ce numéro SIRET n’est pas valide : vérifiez les 14 chiffres.'
                    : undefined
                }
              />
              <Champ
                className="mt-4"
                etiquette="Nom de l’entreprise"
                value={nomEntreprise}
                onChange={(e) => setNomEntreprise(e.target.value)}
                placeholder="Dupont Plomberie"
              />
              <p className="border-bordure bg-creme text-encre-70 mt-5 rounded-[var(--radius-carte)] border p-4 text-sm">
                La recherche automatique dans la base SIRENE complétera ce formulaire dès que
                l’accès à la base de l’Insee sera ouvert sur cet environnement. En attendant, la
                saisie manuelle fonctionne, et la clé de contrôle du SIRET est vérifiée ici même.
              </p>
            </Etape>
          )}

          {etape === 1 && (
            <Etape
              titre="Vérification"
              sous="Nous vérifions que vous êtes bien joignable avant de vous envoyer des demandes."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Champ
                  etiquette="Adresse électronique professionnelle"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <Champ
                  etiquette="Téléphone"
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  autoComplete="tel"
                />
              </div>

              <div className="mt-6">
                <p className="text-encre text-sm font-semibold">Code reçu par SMS</p>
                <div className="mt-3 flex gap-2">
                  {[0, 1, 2, 3, 4, 5].map((rang) => (
                    <input
                      key={rang}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`Chiffre ${rang + 1} sur 6`}
                      value={code[rang] ?? ''}
                      onChange={(evenement) => {
                        const chiffre = evenement.target.value.replace(/\D/g, '').slice(0, 1);
                        const suivant = code.padEnd(6, ' ').split('');
                        suivant[rang] = chiffre === '' ? ' ' : chiffre;
                        setCode(suivant.join('').trimEnd());
                      }}
                      className="border-bordure bg-carte text-encre focus:border-or size-12 rounded-[var(--radius-douce)] border text-center text-lg font-bold focus:outline-none"
                    />
                  ))}
                </div>
                <p className="text-encre-55 mt-3 text-sm">
                  L’envoi du code s’active avec le raccordement de l’opérateur SMS. Tant qu’il n’est
                  pas branché, aucun code n’est envoyé — et aucune demande ne vous sera transmise,
                  puisque la vérification en est la condition.
                </p>
              </div>
            </Etape>
          )}

          {etape === 2 && (
            <Etape
              titre="Vos métiers"
              sous="Vous ne recevrez que des demandes correspondant aux métiers que vous cochez."
            >
              <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
                <ul className="max-h-96 space-y-0.5 overflow-y-auto pr-1">
                  {univers.map((u) => (
                    <li key={u.slug}>
                      <button
                        type="button"
                        onClick={() => setUniversActif(u.slug)}
                        aria-pressed={u.slug === universActif}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-douce)] px-3 text-left text-sm font-semibold transition-colors',
                          u.slug === universActif
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

                <div className="flex flex-wrap gap-2 self-start">
                  {univers
                    .find((u) => u.slug === universActif)
                    ?.metiers.map((metier) => (
                      <Puce
                        key={metier.slug}
                        active={metiersChoisis.includes(metier.slug)}
                        onBascule={() => basculeMetier(metier.slug)}
                      >
                        {metier.nom}
                      </Puce>
                    ))}
                </div>
              </div>

              {metiersChoisis.length > 0 && (
                <div className="border-bordure mt-7 border-t pt-6">
                  <p className="text-encre text-sm font-semibold">
                    Quel est votre métier principal ?
                  </p>
                  <p className="text-encre-55 mt-1 text-xs">
                    C’est celui qui s’affiche en premier sur votre fiche.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {metiersChoisis.map((slug) => (
                      <Puce
                        key={slug}
                        active={metierPrincipal === slug}
                        onBascule={() => setMetierPrincipal(slug)}
                      >
                        {tousMetiers.find((m) => m.slug === slug)?.nom ?? slug}
                      </Puce>
                    ))}
                  </div>
                </div>
              )}
            </Etape>
          )}

          {etape === 3 && (
            <Etape
              titre="Vos villes"
              sous="Une page, c’est un métier dans une ville. Choisissez les villes où vous intervenez réellement."
            >
              <div className="flex flex-wrap gap-2">
                {departements.map((departement) => (
                  <Puce
                    key={departement.code}
                    active={departement.code === departementActif}
                    onBascule={() => setDepartementActif(departement.code)}
                    compte={
                      departement.communes.filter((c) => villesChoisies.includes(c.code)).length ||
                      undefined
                    }
                  >
                    {departement.nom}
                  </Puce>
                ))}
              </div>

              <Champ
                className="mt-5 max-w-sm"
                etiquette="Chercher une ville"
                placeholder="Nom ou code postal"
                value={rechercheVille}
                onChange={(e) => setRechercheVille(e.target.value)}
              />

              <ul className="mt-5 grid max-h-80 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {communesVisibles.map((commune) => {
                  const choisie = villesChoisies.includes(commune.code);
                  return (
                    <li key={commune.code}>
                      <button
                        type="button"
                        onClick={() => basculeVille(commune.code)}
                        aria-pressed={choisie}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-douce)] border px-3 text-left text-sm transition-colors',
                          choisie
                            ? 'border-or bg-or/10 text-encre font-semibold'
                            : 'border-bordure text-encre-70 hover:border-or/50',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{commune.nom}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold',
                            commune.statut === 'ouvert'
                              ? 'bg-succes-fond text-succes'
                              : commune.statut === 'bientot'
                                ? 'bg-alerte-fond text-alerte'
                                : 'bg-encre/[0.06] text-encre-55',
                          )}
                        >
                          {commune.statut === 'ouvert'
                            ? 'Ouvert'
                            : commune.statut === 'bientot'
                              ? 'Bientôt'
                              : 'Annuaire'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="border-bordure bg-creme mt-6 rounded-[var(--radius-carte)] border p-5">
                <Jauge
                  valeur={villesChoisies.length}
                  maximum={limiteVilles ?? Math.max(1, villesChoisies.length)}
                  etiquette="Villes choisies"
                  detail={
                    limiteVilles === null
                      ? `${villesChoisies.length} villes · sans limite en Exclusif`
                      : `${villesChoisies.length} sur ${limiteVilles} en ${formule}`
                  }
                  aspect={
                    limiteVilles !== null && villesChoisies.length > limiteVilles ? 'alerte' : 'or'
                  }
                />
                <p className="text-encre-70 mt-4 text-sm">
                  {villesChoisies.length} villes × {metiersChoisis.length} métiers ={' '}
                  <strong className="text-encre">
                    {nombreDePages(villesChoisies.length, metiersChoisis.length)} pages
                  </strong>{' '}
                  où vous apparaîtriez.
                </p>
              </div>
            </Etape>
          )}

          {etape === 4 && (
            <Etape
              titre="Votre fiche"
              sous="C’est ce que verront les visiteurs. Une fiche complète est mieux classée."
            >
              <ZoneTexte
                etiquette="Présentation de votre entreprise"
                rows={6}
                maxLength={1200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Entreprise familiale installée dans le 11e depuis 1998. Recherche de fuite, dépannage d’urgence et rénovation complète de salle de bain."
                aide={`${description.length} / 1 200 caractères. Au moins 60 caractères pour continuer.`}
              />
              <p className="border-bordure bg-creme text-encre-70 mt-5 rounded-[var(--radius-carte)] border p-4 text-sm">
                Le logo, les photos, les horaires et l’attestation d’assurance décennale s’ajoutent
                ensuite depuis votre espace, et chacun fait monter votre anneau de complétude.
              </p>
            </Etape>
          )}

          {etape === 5 && (
            <Etape
              titre="Votre formule"
              sous="Votre fiche reste gratuite. Les formules servent à apparaître en tête et à recevoir des demandes."
            >
              <div className="flex items-center gap-3">
                <Puce active={!annuel} onBascule={() => setAnnuel(false)}>
                  Mensuel
                </Puce>
                <Puce active={annuel} onBascule={() => setAnnuel(true)}>
                  Annuel — 2 mois offerts
                </Puce>
              </div>

              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {FORMULES.map((option) => {
                  const limite = REGLES_VALIDEES.villesMax[option];
                  const suffisante = limite === null || villesChoisies.length <= limite;
                  return (
                    <li key={option}>
                      <button
                        type="button"
                        onClick={() => setFormule(option)}
                        aria-pressed={option === formule}
                        className={cn(
                          'w-full rounded-[var(--radius-carte)] border p-5 text-left transition-all',
                          option === formule
                            ? 'border-or bg-or/[0.07] shadow-posee'
                            : 'border-bordure bg-carte hover:border-or/40',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-[family-name:var(--font-titre)] text-lg capitalize">
                            {option}
                          </span>
                          {option !== 'gratuit' && <BadgePayant formule={option} sansInfoBulle />}
                        </div>
                        <p className="text-encre mt-2 font-[family-name:var(--font-titre)] text-2xl">
                          {annuel
                            ? formatEuros(prixAnnuelHT(option))
                            : formatEuros(REGLES_VALIDEES.prixMensuelHT[option])}
                          <span className="text-encre-55 ml-1 text-xs font-normal">
                            HT / {annuel ? 'an' : 'mois'}
                          </span>
                        </p>
                        <p className="text-encre-70 mt-2 text-sm">
                          Inclut {limite === null ? 'toutes les villes' : `${limite} villes`} · vous
                          en avez {villesChoisies.length}
                        </p>
                        {!suffisante && (
                          <p className="text-alerte mt-2 text-xs font-semibold">
                            {villesChoisies.length - (limite ?? 0)} ville
                            {villesChoisies.length - (limite ?? 0) > 1 ? 's' : ''} seraient retirées
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {ajustement.retirees.length > 0 && (
                <div className="border-alerte/25 bg-alerte-fond mt-6 rounded-[var(--radius-carte)] border p-5">
                  <p className="text-alerte text-sm font-bold">
                    {ajustement.retirees.length} ville
                    {ajustement.retirees.length > 1 ? 's' : ''} seraient retirées de votre sélection
                  </p>
                  <p className="text-alerte/85 mt-1.5 text-xs">
                    Nous retirons d’abord les villes d’annuaire, puis celles qui ouvrent bientôt,
                    puis les villes ouvertes. Celle de votre siège est gardée en dernier. Vous
                    pouvez revenir en arrière et choisir vous-même.
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {ajustement.retirees.map((ville) => (
                      <li
                        key={ville.code}
                        className="bg-alerte/15 text-alerte rounded-full px-2.5 py-1 text-xs font-semibold"
                      >
                        {toutesCommunes.find((c) => c.code === ville.code)?.nom ?? ville.code}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Etape>
          )}

          {etape === 6 && (
            <Etape
              titre="Récapitulatif"
              sous="Vérifiez avant de valider. Rien n’est prélevé tant que vous n’avez pas confirmé."
            >
              <Carte className="p-5">
                <dl className="space-y-3 text-sm">
                  <LigneRecap cle="Entreprise" valeur={nomEntreprise || '—'} />
                  <LigneRecap cle="SIRET" valeur={siret || '—'} />
                  <LigneRecap cle="Métiers" valeur={String(metiersChoisis.length)} />
                  <LigneRecap cle="Villes" valeur={String(ajustement.conservees.length)} />
                  <LigneRecap cle="Pages" valeur={String(pages)} />
                  <LigneRecap
                    cle="Formule"
                    valeur={`${formule} · ${annuel ? 'annuel' : 'mensuel'}`}
                  />
                </dl>

                <dl className="border-bordure mt-5 space-y-2 border-t pt-5 text-sm">
                  <LigneRecap cle="Total hors taxes" valeur={formatEuros(prixPeriode)} />
                  <LigneRecap
                    cle={`TVA ${Math.round(PARAMETRES_PAR_DEFAUT.tauxTvaLeRenom * 100)} %`}
                    valeur={formatEuros(Math.round(tva * 100) / 100)}
                  />
                  <div className="border-bordure flex justify-between gap-3 border-t pt-3">
                    <dt className="text-encre font-bold">Total TTC</dt>
                    <dd className="text-encre font-[family-name:var(--font-titre)] text-2xl">
                      {formatEuros(Math.round((prixPeriode + tva) * 100) / 100)}
                    </dd>
                  </div>
                </dl>
              </Carte>

              {formule === 'exclusif' && (
                <p className="bg-alerte-fond text-alerte mt-4 rounded-[var(--radius-douce)] px-4 py-3 text-sm">
                  La formule Exclusif est engagée {REGLES_VALIDEES.moisEngagement.exclusif} mois. En
                  contrepartie, vous êtes seul partenaire de votre métier sur votre zone, et votre
                  renouvellement est prioritaire.
                </p>
              )}

              <p className="text-encre-70 mt-4 text-sm">
                En validant, vous acceptez les{' '}
                <Link
                  href="/cgv-pro"
                  className="text-or-fonce font-semibold underline underline-offset-4"
                >
                  conditions générales professionnelles
                </Link>
                , dont la règle d’acceptation définitive : accepter une demande débloque les
                coordonnées du client et ne s’annule pas.
              </p>

              <p className="border-bordure bg-creme text-encre-70 mt-5 rounded-[var(--radius-carte)] border p-4 text-sm">
                Le paiement par carte ou prélèvement SEPA s’active avec le raccordement de Stripe.
                Vous pouvez dès maintenant créer votre fiche gratuite : elle n’exige aucun moyen de
                paiement.
              </p>
            </Etape>
          )}

          {etape === 7 && (
            <div className="py-10 text-center">
              <span className="bg-succes-fond text-succes mx-auto flex size-16 items-center justify-center rounded-full text-3xl">
                ✓
              </span>
              <h1 className="mt-6 text-3xl">Votre fiche est prête</h1>
              <p className="text-encre-70 mx-auto mt-4 max-w-[54ch]">
                {nomEntreprise || 'Votre entreprise'} apparaîtra sur{' '}
                <strong className="text-encre">{pages} pages</strong>, soit{' '}
                {ajustement.conservees.length} villes × {metiersChoisis.length} métiers. Complétez
                votre fiche — photos, horaires, assurance décennale — pour monter dans le classement
                naturel.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/">
                  <Bouton aspect="contour">Retour à l’accueil</Bouton>
                </Link>
                <Link href="/pro">
                  <Bouton aspect="or">Voir les formules</Bouton>
                </Link>
              </div>
            </div>
          )}

          {etape < 7 && (
            <BarreCollante className="mt-8 lg:static lg:border-0 lg:bg-transparent lg:px-0 lg:shadow-none">
              <div className="flex items-center justify-between gap-3">
                <Bouton
                  aspect="discret"
                  onClick={() => setEtape((e) => Math.max(0, e - 1))}
                  disabled={etape === 0}
                >
                  Retour
                </Bouton>
                <Bouton
                  aspect="or"
                  taille="grand"
                  onClick={() => setEtape((e) => e + 1)}
                  disabled={!etapeValide}
                  title={!etapeValide ? 'Complétez cette étape pour continuer.' : undefined}
                >
                  {etape === 6 ? 'Valider mon inscription' : 'Continuer'}
                </Bouton>
              </div>
            </BarreCollante>
          )}
        </div>
      </div>
    </div>
  );
}

function Etape({
  titre,
  sous,
  children,
}: {
  readonly titre: string;
  readonly sous: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section>
      <h1 className="text-[clamp(1.6rem,3.6vw,2.3rem)]">{titre}</h1>
      <p className="text-encre-70 mt-2 max-w-[58ch]">{sous}</p>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function LigneRecap({ cle, valeur }: { readonly cle: string; readonly valeur: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-encre-55">{cle}</dt>
      <dd className="text-encre text-right font-semibold capitalize">{valeur}</dd>
    </div>
  );
}
