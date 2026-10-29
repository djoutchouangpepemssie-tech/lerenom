import type { Metadata } from 'next';
import Link from 'next/link';
import { Conteneur } from '@lerenom/ui';
import { adminConnecte } from '@/lib/session-admin';

/**
 * La disposition du back-office.
 *
 * Neuf univers, imposés par le cahier des charges, et une règle de mise en page qui vaut pour
 * chaque page : **quatre indicateurs au maximum**, puis des onglets, et un seul tableau
 * visible à la fois. Un écran d'exploitation sert à décider ; six tableaux côte à côte ne font
 * décider personne.
 *
 * L'en-tête ne porte pas l'identité de la marque : le crème et l'or sont faits pour rassurer
 * un client, pas pour qu'on passe huit heures dessus. Le back-office est sobre à dessein.
 *
 * La page de connexion vit dans ce groupe mais n'a pas cette disposition : elle est à part,
 * sous `connexion/`, avec sa propre mise en page.
 */

export const metadata: Metadata = {
  title: { default: 'Back-office', template: '%s · Back-office' },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Les neuf univers du §13 du cahier des charges, dans l'ordre imposé.
 *
 * Ceux qui n'existent pas encore sont **affichés sans lien**, et grisés. L'alternative — les
 * laisser cliquables vers une page absente — donnerait huit impasses sur neuf, et une erreur
 * 404 en anglais pour tout message. Un onglet visiblement à venir se comprend ; un lien qui
 * tombe fait douter du reste.
 */
const UNIVERS = [
  { href: '/administration', libelle: 'Accueil', prete: true },
  { href: '/administration/demandes', libelle: 'Demandes', prete: true },
  { href: '/administration/premium', libelle: 'Premium et Exclusif', prete: true },
  { href: '/administration/professionnels', libelle: 'Professionnels', prete: true },
  { href: '/administration/catalogue', libelle: 'Catalogue', prete: true },
  { href: '/administration/finances', libelle: 'Finances', prete: false },
  { href: '/administration/croissance', libelle: 'Croissance', prete: true },
  { href: '/administration/confiance', libelle: 'Confiance', prete: true },
  { href: '/administration/reglages', libelle: 'Réglages', prete: true },
];

export default async function DispositionBackOffice({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const admin = await adminConnecte();

  // Non connecté : la disposition s'efface et laisse la page de connexion occuper l'écran.
  // Le garde réel est sur chaque page — une disposition ne protège rien, elle décore.
  if (admin === null) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f2] text-[#16181D]">
      <header className="border-b border-[#dcdcd8] bg-white">
        <Conteneur>
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <p className="text-sm font-bold tracking-tight">
              Le Renom <span className="font-normal text-[#6b6b66]">· back-office</span>
            </p>
            <p className="text-xs text-[#6b6b66]">
              {admin.nom} · {admin.role}{' '}
              <Link
                href="/administration/deconnexion"
                className="ml-2 font-semibold underline underline-offset-4"
              >
                Se déconnecter
              </Link>
            </p>
          </div>
          <nav aria-label="Univers du back-office" className="-mb-px flex gap-1 overflow-x-auto">
            {UNIVERS.map((univers) =>
              univers.prete ? (
                <Link
                  key={univers.href}
                  href={univers.href}
                  className="border-b-2 border-transparent px-3 py-2 text-sm font-semibold whitespace-nowrap text-[#45453f] transition-colors hover:border-[#16181D] hover:text-[#16181D]"
                >
                  {univers.libelle}
                </Link>
              ) : (
                <span
                  key={univers.href}
                  title="Ce module n’existe pas encore."
                  className="cursor-default border-b-2 border-transparent px-3 py-2 text-sm font-semibold whitespace-nowrap text-[#a3a39c]"
                >
                  {univers.libelle}
                </span>
              ),
            )}
          </nav>
        </Conteneur>
      </header>

      <main className="flex-1 py-7">
        <Conteneur>{children}</Conteneur>
      </main>
    </div>
  );
}
