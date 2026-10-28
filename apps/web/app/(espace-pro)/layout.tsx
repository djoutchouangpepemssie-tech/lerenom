import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Conteneur } from '@lerenom/ui';
import { BoutonDeconnexion } from '@/composants/BoutonDeconnexion';
import { Logo } from '@/composants/Logo';
import { proConnecte } from '@/lib/session-pro';

/**
 * Le socle de l'espace professionnel.
 *
 * Sobre à dessein : c'est un outil de travail, pas une vitrine. L'en-tête du site public, avec
 * ses méga-menus et son bouton « Demander un devis », n'aurait aucun sens ici — un artisan
 * connecté ne cherche pas un artisan.
 *
 * La vérification de session est faite **ici**, une fois : toute page placée sous ce dossier
 * est protégée par construction, et on ne risque pas d'en oublier une.
 */
export default async function DispositionEspacePro({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const pro = await proConnecte();
  if (pro === null) redirect('/pro/connexion');

  const onglets = [
    { href: '/pro/espace', libelle: 'Tableau de bord' },
    { href: '/pro/espace/demandes', libelle: 'Mes demandes' },
    { href: '/pro/espace/fiche', libelle: 'Ma fiche' },
  ];

  return (
    <div className="bg-creme flex min-h-screen flex-col">
      <header className="border-bordure bg-carte border-b">
        <Conteneur>
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/pro/espace" aria-label="Le Renom, espace professionnel">
                <Logo />
              </Link>
              <span className="text-encre-40 hidden text-sm sm:inline">·</span>
              <span className="text-encre-70 hidden min-w-0 truncate text-sm sm:inline">
                {pro.entreprise}
              </span>
            </div>
            <BoutonDeconnexion nom={pro.nom} />
          </div>

          <nav aria-label="Espace professionnel" className="flex gap-1 overflow-x-auto pb-1">
            {onglets.map((onglet) => (
              <Link
                key={onglet.href}
                href={onglet.href}
                className="text-encre-70 hover:text-encre hover:border-or rounded-t-[var(--radius-douce)] border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors"
              >
                {onglet.libelle}
              </Link>
            ))}
          </nav>
        </Conteneur>
      </header>

      <main className="flex-1 py-8 md:py-10">
        <Conteneur>{children}</Conteneur>
      </main>

      <footer className="border-bordure border-t py-6">
        <Conteneur>
          <p className="text-encre-55 text-xs">
            Le Renom ·{' '}
            <Link href="/cgv-pro" className="underline">
              Conditions générales professionnelles
            </Link>{' '}
            ·{' '}
            <Link href="/comment-nous-classons" className="underline">
              Comment nous classons
            </Link>
          </p>
        </Conteneur>
      </footer>
    </div>
  );
}
