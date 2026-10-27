import Link from 'next/link';
import { Conteneur } from '@lerenom/ui';
import { Logo } from './Logo';

export interface ProprietesPiedDePage {
  readonly comptes: {
    readonly univers: number;
    readonly metiers: number;
    readonly prestations: number;
  };
  readonly departements: readonly { readonly nom: string; readonly slug: string }[];
}

const SERVICES = [
  { libelle: 'Tous les services', href: '/services' },
  { libelle: 'Guide des prix', href: '/guide-des-prix' },
  { libelle: 'Demander un devis', href: '/demande' },
  { libelle: 'Comment ça marche', href: '/comment-ca-marche' },
];

const LE_RENOM = [
  { libelle: 'Comment nous classons les résultats', href: '/comment-nous-classons' },
  { libelle: 'Charte des avis', href: '/charte-avis' },
  { libelle: 'Signaler un contenu', href: '/signaler' },
];

const PROFESSIONNELS = [
  { libelle: 'Professionnels et tarifs', href: '/pro' },
  { libelle: 'Créer ou revendiquer ma fiche', href: '/pro/inscription' },
  { libelle: 'Conditions générales professionnelles', href: '/cgv-pro' },
];

const LEGAL = [
  { libelle: 'Mentions légales', href: '/mentions-legales' },
  { libelle: "Conditions d'utilisation", href: '/cgu' },
  { libelle: 'Confidentialité', href: '/confidentialite' },
  { libelle: 'Cookies', href: '/cookies' },
];

export function PiedDePage({ comptes, departements }: ProprietesPiedDePage) {
  return (
    <footer className="bg-nuit text-creme/70 relative overflow-hidden pt-16">
      <Conteneur className="relative">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <Logo clair />
            <p className="mt-4 max-w-[36ch] text-sm leading-relaxed">
              Trouvez un professionnel près de chez vous, lisez ses avis vérifiés et recevez jusqu’à
              trois devis. Gratuit, et sans créer de compte.
            </p>

            <ul className="mt-6 space-y-2 text-sm">
              <Promesse>Trois professionnels au maximum par demande</Promesse>
              <Promesse>Avis liés à une demande réelle</Promesse>
              <Promesse>Coordonnées transmises seulement après acceptation</Promesse>
            </ul>
          </div>

          <ColonneLiens titre="Services" liens={SERVICES} />
          <ColonneLiens
            titre="Île-de-France"
            liens={[
              ...departements.map((d) => ({ libelle: d.nom, href: `/${d.slug}` })),
              { libelle: 'Toute la région', href: '/ile-de-france' },
            ]}
          />
          <ColonneLiens titre="Le Renom" liens={LE_RENOM} />
          <ColonneLiens titre="Professionnels" liens={PROFESSIONNELS} />
        </div>

        <div className="border-creme/10 mt-12 flex flex-col gap-4 border-t py-7 text-xs md:flex-row md:items-center md:justify-between">
          <p>
            {comptes.univers} univers · {comptes.metiers} métiers · {comptes.prestations}{' '}
            prestations · 1 285 villes et arrondissements
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL.map((lien) => (
              <li key={lien.href}>
                <Link href={lien.href} className="hover:text-or-clair transition-colors">
                  {lien.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-creme/45 pb-10 text-[0.7rem]">
          Données d’entreprises issues de la base SIRENE de l’Insee, sous Licence Ouverte 2.0.
          Adresses normalisées avec la Base Adresse Nationale. Le statut de diffusion choisi par
          chaque entrepreneur est respecté.
        </p>
      </Conteneur>

      <p
        aria-hidden="true"
        className="text-creme/[0.03] pointer-events-none absolute -bottom-6 left-1/2 w-full -translate-x-1/2 text-center font-[family-name:var(--font-titre)] text-[20vw] leading-none select-none"
      >
        Le Renom
      </p>
    </footer>
  );
}

function Promesse({ children }: { readonly children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="stroke-or mt-1 size-3 shrink-0 fill-none stroke-[1.8]"
      >
        <path d="M2 6.4l2.6 2.6L10 3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function ColonneLiens({
  titre,
  liens,
}: {
  readonly titre: string;
  readonly liens: readonly { readonly libelle: string; readonly href: string }[];
}) {
  return (
    <nav aria-label={titre}>
      <p className="text-or-clair text-[0.68rem] font-bold tracking-[0.16em] uppercase">{titre}</p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {liens.map((lien) => (
          <li key={lien.href}>
            <Link href={lien.href} className="hover:text-or-clair transition-colors">
              {lien.libelle}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
