import Link from 'next/link';
import { Accent, Apparition, Carte, Conteneur, Section } from '@lerenom/ui';
import { FilAriane } from '@/composants/FilAriane';
import { catalogue } from '@/lib/donnees';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/services' },
  title: 'Tous les services',
  description:
    'Le catalogue complet de Le Renom : tous les univers, tous les métiers et toutes les prestations référencés en Île-de-France.',
};

export default async function PageServices() {
  const cat = await catalogue();

  return (
    <>
      <Section fond="creme" className="pt-8 pb-10 md:pt-10">
        <Conteneur>
          <FilAriane
            elements={[{ libelle: 'Accueil', href: '/' }, { libelle: 'Tous les services' }]}
          />
          <h1 className="mt-6 text-[clamp(1.9rem,4.4vw,3rem)]">
            Tous les <Accent>services</Accent>
          </h1>
          <p className="text-encre-70 mt-4 max-w-[62ch] text-[1.05rem]">
            {cat.comptes.univers} univers, {cat.comptes.metiers} métiers et{' '}
            {cat.comptes.prestations} prestations. Si un métier existe, il a sa place ici.
          </p>
        </Conteneur>
      </Section>

      {cat.univers.map((univers, rangUnivers) => (
        <Section
          key={univers.slug}
          fond={rangUnivers % 2 === 0 ? 'carte' : 'creme'}
          className="py-12"
        >
          <Conteneur>
            <div className="flex items-center gap-3">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-8 shrink-0"
                style={{ color: univers.couleur }}
              >
                <path d={univers.icone} fill="currentColor" />
              </svg>
              <h2 className="text-[clamp(1.5rem,3.2vw,2.1rem)]">{univers.nom}</h2>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {univers.metiers.map((metier, index) => (
                <Apparition key={metier.slug} index={index}>
                  <Carte className="flex h-full flex-col p-5">
                    <Link
                      href={`/${metier.slug}`}
                      className="text-encre font-[family-name:var(--font-titre)] text-lg"
                    >
                      {metier.nom}
                    </Link>
                    <p className="text-encre-40 mt-1 text-xs">
                      {metier.prestations.length} prestations
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {metier.prestations.slice(0, 5).map((prestation) => (
                        <li key={prestation.slug} className="text-encre-70 text-sm">
                          {prestation.nom}
                        </li>
                      ))}
                      {metier.prestations.length > 5 && (
                        <li className="text-encre-40 text-sm">
                          et {metier.prestations.length - 5} autres
                        </li>
                      )}
                    </ul>
                  </Carte>
                </Apparition>
              ))}
            </div>
          </Conteneur>
        </Section>
      ))}
    </>
  );
}
