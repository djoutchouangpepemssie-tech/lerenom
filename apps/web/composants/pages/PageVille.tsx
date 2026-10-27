import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@lerenom/db';
import { Accent, Apparition, Carte, Chiffre, Conteneur, Section, TitreSection } from '@lerenom/ui';
import { FilAriane } from '@/composants/FilAriane';
import { StatutVille } from '@/composants/StatutVille';
import { catalogue, communeParSlug, compteProsParMetier } from '@/lib/donnees';
import { aLaVille, nomVille } from '@/lib/affichage';

/** La page d'une ville : ses chiffres, ses métiers, et les villes voisines. */
export async function PageVille({ slug }: { readonly slug: string }) {
  const commune = await communeParSlug(slug);
  if (commune === null) notFound();

  const [cat, prosParMetier, voisines, nombrePros] = await Promise.all([
    catalogue(),
    compteProsParMetier(commune.code),
    prisma.commune.findMany({
      where: { departementId: commune.departementId, code: { not: commune.code } },
      orderBy: { population: 'desc' },
      take: 12,
    }),
    prisma.entreprise.count({
      where: { suspendue: false, retireeLe: null, zones: { some: { communeId: commune.code } } },
    }),
  ]);

  // Les métiers réellement représentés dans la ville, les plus fournis d'abord.
  const metiersRepresentes = cat.univers
    .flatMap((u) => u.metiers.map((m) => ({ ...m, univers: u })))
    .map((m) => ({ ...m, nombrePros: prosParMetier.get(m.id) ?? 0 }))
    .filter((m) => m.nombrePros > 0)
    .sort((a, b) => b.nombrePros - a.nombrePros);

  return (
    <>
      <Section fond="creme" className="pt-8 pb-12 md:pt-10">
        <Conteneur>
          <FilAriane
            elements={[
              { libelle: 'Accueil', href: '/' },
              { libelle: commune.departement.nom, href: `/${commune.departement.slug}` },
              { libelle: nomVille(commune.nom) },
            ]}
          />

          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[clamp(1.9rem,4.4vw,3rem)]">
                Des professionnels <Accent>{aLaVille(commune.nom)}</Accent>
              </h1>
              <p className="text-encre-70 mt-3 max-w-[56ch]">
                {commune.departement.nom}
                {commune.codesPostaux.length > 0 && ` · ${commune.codesPostaux.join(', ')}`}
                {commune.population !== null &&
                  ` · ${commune.population.toLocaleString('fr-FR')} habitants`}
              </p>
            </div>
            <StatutVille statut={commune.statut} nomVille={nomVille(commune.nom)} />
          </div>

          <dl className="border-bordure mt-10 grid grid-cols-2 gap-6 border-t pt-8 sm:grid-cols-4">
            <Chiffre valeur={nombrePros} libelle="professionnels référencés" />
            <Chiffre valeur={metiersRepresentes.length} libelle="métiers représentés" />
            <Chiffre
              valeur={
                commune.population !== null ? commune.population.toLocaleString('fr-FR') : '—'
              }
              libelle="habitants"
            />
            <Chiffre valeur={commune.codesPostaux[0] ?? commune.code} libelle="code postal" />
          </dl>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Les métiers"
            titre={
              <>
                Qui intervient <Accent>{aLaVille(commune.nom)}</Accent>
              </>
            }
            chapeau={
              metiersRepresentes.length === 0
                ? 'Aucune entreprise n’est encore référencée dans cette ville. L’annuaire se remplit au fil des inscriptions et des imports.'
                : 'Chaque métier a sa page dans cette ville, avec ses professionnels classés et ses prix constatés.'
            }
          />

          {metiersRepresentes.length > 0 && (
            <ul className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {metiersRepresentes.map((metier, index) => (
                <Apparition key={metier.slug} index={index % 9} balise="li">
                  <Link href={`/${metier.slug}/${commune.slug}`} className="block h-full">
                    <Carte survolable className="flex h-full items-center gap-3 p-4">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="size-6 shrink-0"
                        style={{ color: metier.univers.couleur }}
                      >
                        <path d={metier.univers.icone} fill="currentColor" />
                      </svg>
                      <span className="min-w-0 flex-1">
                        <span className="text-encre block font-semibold">{metier.nom}</span>
                        <span className="text-encre-55 block text-xs">
                          {metier.nombrePros}{' '}
                          {metier.nombrePros > 1 ? 'professionnels' : 'professionnel'}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-or shrink-0">
                        →
                      </span>
                    </Carte>
                  </Link>
                </Apparition>
              ))}
            </ul>
          )}
        </Conteneur>
      </Section>

      <Section fond="creme" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="À proximité"
            titre={
              <>
                Les villes <Accent>voisines</Accent>
              </>
            }
          />
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {voisines.map((ville) => (
              <li key={ville.code}>
                <Link
                  href={`/${ville.slug}`}
                  className="border-bordure bg-carte text-encre hover:border-or inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
                >
                  {nomVille(ville.nom)}
                </Link>
              </li>
            ))}
          </ul>
        </Conteneur>
      </Section>
    </>
  );
}
