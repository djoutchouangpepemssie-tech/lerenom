import { notFound } from 'next/navigation';
import { prisma } from '@lerenom/db';
import { Accent, Chiffre, Conteneur, Section, TitreSection } from '@lerenom/ui';
import { FilAriane } from '@/composants/FilAriane';
import { ListeCommunes } from '@/composants/ListeCommunes';

/** La page d'un département : la liste complète de ses communes, cherchable et filtrable. */
export async function PageDepartement({ slug }: { readonly slug: string }) {
  const departement = await prisma.departement.findUnique({
    where: { slug },
    include: {
      communes: {
        orderBy: [{ statut: 'asc' }, { population: 'desc' }],
        select: {
          code: true,
          nom: true,
          slug: true,
          statut: true,
          population: true,
          codesPostaux: true,
        },
      },
    },
  });
  if (departement === null) notFound();

  const voisins = await prisma.departement.findMany({
    where: { code: { not: departement.code } },
    orderBy: { code: 'asc' },
  });

  const ouvertes = departement.communes.filter((c) => c.statut === 'ouvert').length;
  const bientot = departement.communes.filter((c) => c.statut === 'bientot').length;

  return (
    <>
      <Section fond="creme" className="pt-8 pb-12 md:pt-10">
        <Conteneur>
          <FilAriane
            elements={[
              { libelle: 'Accueil', href: '/' },
              { libelle: 'Île-de-France', href: '/ile-de-france' },
              { libelle: departement.nom },
            ]}
          />

          <h1 className="mt-6 text-[clamp(1.9rem,4.4vw,3rem)]">
            Professionnels en <Accent>{departement.nom}</Accent>
          </h1>
          <p className="text-encre-70 mt-3 max-w-[60ch]">
            Les {departement.communes.length}{' '}
            {departement.code === '75' ? 'arrondissements' : 'communes'} du département{' '}
            {departement.code}, avec leur statut. Les demandes de devis s’ouvrent ville par ville ;
            partout ailleurs, l’annuaire est consultable.
          </p>

          <dl className="border-bordure mt-10 grid grid-cols-3 gap-6 border-t pt-8">
            <Chiffre valeur={ouvertes} libelle="ouvertes aux demandes" />
            <Chiffre valeur={bientot} libelle="ouvrent bientôt" />
            <Chiffre
              valeur={departement.communes.length - ouvertes - bientot}
              libelle="consultables en annuaire"
            />
          </dl>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre={`${departement.communes.length} ${departement.code === '75' ? 'arrondissements' : 'communes'}`}
            titre={
              <>
                Toutes les villes, <Accent>sans exception</Accent>
              </>
            }
            chapeau="Cherchez par nom ou par code postal, filtrez par statut, et triez par population ou par ordre alphabétique."
          />
          <ListeCommunes className="mt-9" communes={departement.communes} />
        </Conteneur>
      </Section>

      <Section fond="creme" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Île-de-France"
            titre={
              <>
                Les autres <Accent>départements</Accent>
              </>
            }
          />
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {voisins.map((voisin) => (
              <li key={voisin.code}>
                <a
                  href={`/${voisin.slug}`}
                  className="border-bordure bg-carte text-encre hover:border-or inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors"
                >
                  <span className="text-encre-40 font-mono text-xs">{voisin.code}</span>
                  {voisin.nom}
                </a>
              </li>
            ))}
          </ul>
        </Conteneur>
      </Section>
    </>
  );
}
