'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bouton, Conteneur, Tiroir, cn } from '@lerenom/ui';
import { Logo } from './Logo';

export interface UniversMenu {
  readonly slug: string;
  readonly nom: string;
  readonly couleur: string;
  readonly icone: string;
  readonly nombreMetiers: number;
  readonly nombrePrestations: number;
  readonly metiers: readonly { readonly slug: string; readonly nom: string }[];
}

export interface PrestationMenu {
  readonly slug: string;
  readonly nom: string;
  readonly metierSlug: string;
  readonly prixMin: number | null;
  readonly prixMax: number | null;
}

export interface DepartementMenu {
  readonly code: string;
  readonly nom: string;
  readonly slug: string;
  readonly nombreCommunes: number;
}

export interface VilleMenu {
  readonly slug: string;
  readonly nom: string;
  readonly statut: 'ouvert' | 'bientot' | 'annuaire';
}

export interface ProprietesEnTete {
  readonly univers: readonly UniversMenu[];
  readonly prestationsPhares: readonly PrestationMenu[];
  readonly departements: readonly DepartementMenu[];
  readonly villesRecherchees: readonly VilleMenu[];
  readonly villesOuvertes: readonly VilleMenu[];
}

export function EnTete({
  univers,
  prestationsPhares,
  departements,
  villesRecherchees,
  villesOuvertes,
}: ProprietesEnTete) {
  const [menuOuvert, setMenuOuvert] = useState<'services' | 'villes' | null>(null);
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const [universActif, setUniversActif] = useState(univers[0]?.slug ?? '');
  const entete = useRef<HTMLElement>(null);

  // Un méga-menu se ferme à l'Échap et quand on clique ailleurs : sans cela, il reste ouvert
  // derrière l'utilisateur qui est déjà passé à autre chose.
  useEffect(() => {
    if (menuOuvert === null) return;

    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setMenuOuvert(null);
    };
    const surClic = (evenement: MouseEvent) => {
      if (entete.current !== null && !entete.current.contains(evenement.target as Node)) {
        setMenuOuvert(null);
      }
    };

    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
    };
  }, [menuOuvert]);

  const universCourant = univers.find((u) => u.slug === universActif) ?? univers[0];

  return (
    <header
      ref={entete}
      className="border-bordure bg-creme/95 sticky top-0 z-40 border-b backdrop-blur-sm"
    >
      <Conteneur className="flex min-h-16 items-center gap-3 md:min-h-[4.5rem] md:gap-6">
        <Link href="/" className="shrink-0" aria-label="Le Renom, accueil">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          <BoutonMenu
            libelle="Services"
            ouvert={menuOuvert === 'services'}
            onBascule={() => setMenuOuvert(menuOuvert === 'services' ? null : 'services')}
          />
          <BoutonMenu
            libelle="Villes"
            ouvert={menuOuvert === 'villes'}
            onBascule={() => setMenuOuvert(menuOuvert === 'villes' ? null : 'villes')}
          />
          <LienEntete href="/guide-des-prix">Guide des prix</LienEntete>
          <LienEntete href="/comment-ca-marche">Comment ça marche</LienEntete>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <Bouton
            aspect="contour"
            taille="petit"
            className="hidden sm:inline-flex"
            onClick={() => {
              window.location.href = '/pro';
            }}
          >
            Vous êtes artisan ?
          </Bouton>
          <Bouton
            aspect="or"
            taille="petit"
            onClick={() => {
              window.location.href = '/demande';
            }}
          >
            Demander un devis
          </Bouton>
          <button
            type="button"
            onClick={() => setTiroirOuvert(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={tiroirOuvert}
            className="text-encre hover:bg-carte flex size-11 items-center justify-center rounded-[var(--radius-douce)] transition-colors lg:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-5 stroke-current stroke-[1.8]"
            >
              <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </Conteneur>

      {menuOuvert === 'services' && universCourant !== undefined && (
        <PanneauServices
          univers={univers}
          universCourant={universCourant}
          onChoisirUnivers={setUniversActif}
          prestationsPhares={prestationsPhares}
          onFermer={() => setMenuOuvert(null)}
        />
      )}

      {menuOuvert === 'villes' && (
        <PanneauVilles
          departements={departements}
          villesRecherchees={villesRecherchees}
          villesOuvertes={villesOuvertes}
          onFermer={() => setMenuOuvert(null)}
        />
      )}

      <Tiroir ouvert={tiroirOuvert} onFermer={() => setTiroirOuvert(false)} titre="Menu">
        <TiroirMobile
          univers={univers}
          departements={departements}
          villesOuvertes={villesOuvertes}
          onNaviguer={() => setTiroirOuvert(false)}
        />
      </Tiroir>
    </header>
  );
}

function BoutonMenu({
  libelle,
  ouvert,
  onBascule,
}: {
  readonly libelle: string;
  readonly ouvert: boolean;
  readonly onBascule: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onBascule}
      aria-expanded={ouvert}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-douce)] px-3 text-[0.95rem] font-semibold',
        'transition-colors duration-[var(--duree-courte)]',
        ouvert ? 'bg-carte text-encre' : 'text-encre-70 hover:bg-carte hover:text-encre',
      )}
    >
      {libelle}
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className={cn(
          'size-3 stroke-current stroke-[1.6] transition-transform',
          ouvert && 'rotate-180',
        )}
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </button>
  );
}

function LienEntete({
  href,
  children,
}: {
  readonly href: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group text-encre-70 hover:text-encre relative inline-flex min-h-11 items-center px-3 text-[0.95rem] font-semibold transition-colors"
    >
      {children}
      <span className="bg-or absolute inset-x-3 bottom-2.5 h-px origin-left scale-x-0 transition-transform duration-[var(--duree-moyenne)] group-hover:scale-x-100" />
    </Link>
  );
}

function IconeUnivers({ icone, couleur }: { readonly icone: string; readonly couleur: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      style={{ color: couleur }}
    >
      <path d={icone} fill="currentColor" />
    </svg>
  );
}

function PanneauServices({
  univers,
  universCourant,
  onChoisirUnivers,
  prestationsPhares,
  onFermer,
}: {
  readonly univers: readonly UniversMenu[];
  readonly universCourant: UniversMenu;
  readonly onChoisirUnivers: (slug: string) => void;
  readonly prestationsPhares: readonly PrestationMenu[];
  readonly onFermer: () => void;
}) {
  return (
    <div className="border-bordure bg-carte shadow-levee absolute inset-x-0 top-full hidden border-b lg:block">
      <Conteneur className="grid grid-cols-[1.1fr_1fr_1fr] gap-8 py-8">
        <div>
          <p className="text-encre-40 mb-3 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            {univers.length} univers
          </p>
          <ul className="max-h-[22rem] space-y-0.5 overflow-y-auto pr-2">
            {univers.map((u) => (
              <li key={u.slug}>
                <button
                  type="button"
                  onMouseEnter={() => onChoisirUnivers(u.slug)}
                  onFocus={() => onChoisirUnivers(u.slug)}
                  onClick={() => onChoisirUnivers(u.slug)}
                  aria-pressed={u.slug === universCourant.slug}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-douce)] px-3 text-left text-sm font-semibold transition-colors',
                    u.slug === universCourant.slug
                      ? 'bg-creme text-encre'
                      : 'text-encre-70 hover:bg-creme hover:text-encre',
                  )}
                >
                  <IconeUnivers icone={u.icone} couleur={u.couleur} />
                  <span className="min-w-0 flex-1 truncate">{u.nom}</span>
                  <span className="text-encre-40 shrink-0 text-xs font-medium">
                    {u.nombreMetiers}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-encre-40 mb-3 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            {universCourant.nombreMetiers} métiers · {universCourant.nombrePrestations} prestations
          </p>
          <ul className="space-y-0.5">
            {universCourant.metiers.map((metier) => (
              <li key={metier.slug}>
                <Link
                  href={`/${metier.slug}`}
                  onClick={onFermer}
                  className="text-encre-70 hover:bg-creme hover:text-encre flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-douce)] px-3 text-sm font-semibold transition-colors"
                >
                  {metier.nom}
                  <span
                    aria-hidden="true"
                    className="text-or opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-encre-40 mb-3 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Souvent demandé
          </p>
          <ul className="space-y-1">
            {prestationsPhares.slice(0, 7).map((prestation) => (
              <li key={prestation.slug}>
                <Link
                  href={`/${prestation.metierSlug}`}
                  onClick={onFermer}
                  className="hover:bg-creme flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-douce)] px-3 text-sm transition-colors"
                >
                  <span className="text-encre min-w-0 flex-1 truncate font-medium">
                    {prestation.nom}
                  </span>
                  {prestation.prixMin !== null && (
                    <span className="text-or-fonce shrink-0 text-xs font-semibold">
                      dès {prestation.prixMin} €
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-erreur/20 bg-erreur-fond mt-5 rounded-[var(--radius-carte)] border p-4">
            <p className="text-erreur text-sm font-bold">Une urgence ?</p>
            <p className="text-erreur/85 mt-1 text-xs">
              Fuite, panne, porte claquée : demandez une intervention sous 2 heures dans les villes
              ouvertes.
            </p>
            <Link
              href="/demande?urgence=1"
              onClick={onFermer}
              className="text-erreur mt-3 inline-flex min-h-10 items-center text-sm font-bold underline underline-offset-4"
            >
              Demander une intervention urgente
            </Link>
          </div>
        </div>
      </Conteneur>
    </div>
  );
}

const LIBELLES_STATUT = {
  ouvert: 'Ouvert aux demandes',
  bientot: 'Ouvre bientôt',
  annuaire: 'Annuaire',
} as const;

function PastilleStatut({ statut }: { readonly statut: 'ouvert' | 'bientot' | 'annuaire' }) {
  const styles = {
    ouvert: 'bg-succes-fond text-succes',
    bientot: 'bg-alerte-fond text-alerte',
    annuaire: 'bg-encre/[0.06] text-encre-55',
  } as const;

  return (
    <span
      className={cn('shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold', styles[statut])}
    >
      {LIBELLES_STATUT[statut]}
    </span>
  );
}

function PanneauVilles({
  departements,
  villesRecherchees,
  villesOuvertes,
  onFermer,
}: {
  readonly departements: readonly DepartementMenu[];
  readonly villesRecherchees: readonly VilleMenu[];
  readonly villesOuvertes: readonly VilleMenu[];
  readonly onFermer: () => void;
}) {
  return (
    <div className="border-bordure bg-carte shadow-levee absolute inset-x-0 top-full hidden border-b lg:block">
      <Conteneur className="grid grid-cols-3 gap-8 py-8">
        <div>
          <p className="text-encre-40 mb-3 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Les 8 départements
          </p>
          <ul className="space-y-0.5">
            {departements.map((departement) => (
              <li key={departement.code}>
                <Link
                  href={`/${departement.slug}`}
                  onClick={onFermer}
                  className="text-encre-70 hover:bg-creme hover:text-encre flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-douce)] px-3 text-sm font-semibold transition-colors"
                >
                  <span>
                    <span className="text-encre-40 mr-2 font-mono text-xs">{departement.code}</span>
                    {departement.nom}
                  </span>
                  <span className="text-encre-40 text-xs font-medium">
                    {departement.nombreCommunes}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-encre-40 mb-3 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Les plus recherchées
          </p>
          <ul className="space-y-0.5">
            {villesRecherchees.slice(0, 8).map((ville) => (
              <li key={ville.slug}>
                <Link
                  href={`/${ville.slug}`}
                  onClick={onFermer}
                  className="text-encre-70 hover:bg-creme hover:text-encre flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-douce)] px-3 text-sm font-semibold transition-colors"
                >
                  <span className="min-w-0 flex-1 truncate">{ville.nom}</span>
                  <PastilleStatut statut={ville.statut} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-encre-40 mb-3 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Demandes de devis actives
          </p>
          <ul className="space-y-0.5">
            {villesOuvertes.map((ville) => (
              <li key={ville.slug}>
                <Link
                  href={`/${ville.slug}`}
                  onClick={onFermer}
                  className="text-encre-70 hover:bg-creme hover:text-encre flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-douce)] px-3 text-sm font-semibold transition-colors"
                >
                  <span className="min-w-0 flex-1 truncate">{ville.nom}</span>
                  <PastilleStatut statut={ville.statut} />
                </Link>
              </li>
            ))}
          </ul>

          <p className="border-bordure bg-creme text-encre-70 mt-5 rounded-[var(--radius-carte)] border p-4 text-xs">
            Partout ailleurs en Île-de-France, l’annuaire est consultable et vous pouvez demander à
            être prévenu dès l’ouverture des demandes de devis.
          </p>
          <Link
            href="/ile-de-france"
            onClick={onFermer}
            className="text-or-fonce mt-3 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
          >
            Voir toute l’Île-de-France
          </Link>
        </div>
      </Conteneur>
    </div>
  );
}

function TiroirMobile({
  univers,
  departements,
  villesOuvertes,
  onNaviguer,
}: {
  readonly univers: readonly UniversMenu[];
  readonly departements: readonly DepartementMenu[];
  readonly villesOuvertes: readonly VilleMenu[];
  readonly onNaviguer: () => void;
}) {
  const [section, setSection] = useState<'services' | 'villes' | null>('services');
  const [universDeplie, setUniversDeplie] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Accordeon
        titre="Services"
        detail={`${univers.length} univers`}
        ouvert={section === 'services'}
        onBascule={() => setSection(section === 'services' ? null : 'services')}
      >
        <ul className="space-y-1">
          {univers.map((u) => (
            <li key={u.slug}>
              <button
                type="button"
                onClick={() => setUniversDeplie(universDeplie === u.slug ? null : u.slug)}
                aria-expanded={universDeplie === u.slug}
                className="text-encre flex min-h-12 w-full items-center gap-2.5 rounded-[var(--radius-douce)] px-3 text-left text-sm font-semibold"
              >
                <IconeUnivers icone={u.icone} couleur={u.couleur} />
                <span className="min-w-0 flex-1">{u.nom}</span>
                <span className="text-encre-40 text-xs">{u.nombreMetiers}</span>
              </button>
              {universDeplie === u.slug && (
                <ul className="border-bordure mb-2 ml-8 space-y-0.5 border-l pl-3">
                  {u.metiers.map((metier) => (
                    <li key={metier.slug}>
                      <Link
                        href={`/${metier.slug}`}
                        onClick={onNaviguer}
                        className="text-encre-70 flex min-h-11 items-center text-sm"
                      >
                        {metier.nom}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Accordeon>

      <Accordeon
        titre="Villes"
        detail="8 départements"
        ouvert={section === 'villes'}
        onBascule={() => setSection(section === 'villes' ? null : 'villes')}
      >
        <ul className="space-y-0.5">
          {departements.map((departement) => (
            <li key={departement.code}>
              <Link
                href={`/${departement.slug}`}
                onClick={onNaviguer}
                className="text-encre flex min-h-12 items-center justify-between rounded-[var(--radius-douce)] px-3 text-sm font-semibold"
              >
                {departement.nom}
                <span className="text-encre-40 text-xs">{departement.nombreCommunes}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-encre-40 mt-3 px-3 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
          Demandes actives
        </p>
        <ul className="space-y-0.5">
          {villesOuvertes.map((ville) => (
            <li key={ville.slug}>
              <Link
                href={`/${ville.slug}`}
                onClick={onNaviguer}
                className="text-encre flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-douce)] px-3 text-sm font-semibold"
              >
                <span className="min-w-0 flex-1 truncate">{ville.nom}</span>
                <PastilleStatut statut={ville.statut} />
              </Link>
            </li>
          ))}
        </ul>
      </Accordeon>

      <div className="border-bordure space-y-1 border-t pt-3">
        <Link
          href="/guide-des-prix"
          onClick={onNaviguer}
          className="text-encre flex min-h-12 items-center px-3 font-semibold"
        >
          Guide des prix
        </Link>
        <Link
          href="/comment-ca-marche"
          onClick={onNaviguer}
          className="text-encre flex min-h-12 items-center px-3 font-semibold"
        >
          Comment ça marche
        </Link>
        <Link
          href="/pro"
          onClick={onNaviguer}
          className="text-encre flex min-h-12 items-center px-3 font-semibold"
        >
          Vous êtes artisan ?
        </Link>
      </div>
    </div>
  );
}

function Accordeon({
  titre,
  detail,
  ouvert,
  onBascule,
  children,
}: {
  readonly titre: string;
  readonly detail: string;
  readonly ouvert: boolean;
  readonly onBascule: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="border-bordure rounded-[var(--radius-carte)] border">
      <button
        type="button"
        onClick={onBascule}
        aria-expanded={ouvert}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
      >
        <span className="text-encre font-[family-name:var(--font-titre)] text-lg">{titre}</span>
        <span className="text-encre-55 flex items-center gap-2 text-xs">
          {detail}
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className={cn(
              'size-3 stroke-current stroke-[1.6] transition-transform',
              ouvert && 'rotate-180',
            )}
          >
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </span>
      </button>
      {ouvert && <div className="px-2 pb-3">{children}</div>}
    </section>
  );
}
