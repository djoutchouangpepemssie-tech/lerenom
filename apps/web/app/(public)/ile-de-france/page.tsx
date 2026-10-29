import Link from 'next/link';
import { prisma } from '@lerenom/db';
import { Accent, Apparition, Carte, Chiffre, Conteneur, Section, TitreSection } from '@lerenom/ui';
import { FilAriane } from '@/composants/FilAriane';
import { ListeCommunes } from '@/composants/ListeCommunes';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/ile-de-france' },
  title: 'Île-de-France',
  description:
    'Les 8 départements et 1 285 villes et arrondissements d’Île-de-France, avec le statut des demandes de devis dans chacun.',
};

export default async function PageIleDeFrance() {
  const [departements, communes] = await Promise.all([
    prisma.departement.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { communes: true } } },
    }),
    prisma.commune.findMany({
      orderBy: [{ statut: 'asc' }, { population: 'desc' }],
      select: {
        code: true,
        nom: true,
        slug: true,
        statut: true,
        population: true,
        codesPostaux: true,
      },
    }),
  ]);

  const ouvertes = communes.filter((c) => c.statut === 'ouvert').length;
  const bientot = communes.filter((c) => c.statut === 'bientot').length;

  return (
    <>
      <Section fond="creme" className="pt-8 pb-12 md:pt-10">
        <Conteneur>
          <FilAriane elements={[{ libelle: 'Accueil', href: '/' }, { libelle: 'Île-de-France' }]} />

          <h1 className="mt-6 text-[clamp(1.9rem,4.4vw,3rem)]">
            Toute l’<Accent>Île-de-France</Accent>
          </h1>
          <p className="text-encre-70 mt-3 max-w-[62ch]">
            Huit départements, {communes.length} villes et arrondissements. Les demandes de devis
            s’ouvrent ville par ville ; partout ailleurs, l’annuaire est consultable et vous pouvez
            demander à être prévenu dès l’ouverture.
          </p>

          <dl className="border-bordure mt-10 grid grid-cols-2 gap-6 border-t pt-8 sm:grid-cols-4">
            <Chiffre valeur={departements.length} libelle="départements" />
            <Chiffre valeur={communes.length} libelle="villes et arrondissements" />
            <Chiffre valeur={ouvertes} libelle="ouvertes aux demandes" />
            <Chiffre valeur={bientot} libelle="ouvrent bientôt" />
          </dl>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Les départements"
            titre={
              <>
                Huit territoires, <Accent>une seule promesse</Accent>
              </>
            }
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {departements.map((departement, index) => (
              <Apparition key={departement.code} index={index}>
                <Link href={`/${departement.slug}`} className="block h-full">
                  <Carte survolable className="h-full p-5">
                    <p className="text-encre-40 font-mono text-xs">{departement.code}</p>
                    <h2 className="mt-1 text-xl">{departement.nom}</h2>
                    <p className="text-encre-55 mt-2 text-sm">
                      {departement._count.communes}{' '}
                      {departement.code === '75' ? 'arrondissements' : 'communes'}
                    </p>
                  </Carte>
                </Link>
              </Apparition>
            ))}
          </div>
        </Conteneur>
      </Section>

      <Section fond="creme" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Index complet"
            titre={
              <>
                Les <Accent>{communes.length} villes</Accent>, sans exception
              </>
            }
            chapeau="Cherchez par nom ou par code postal, filtrez par statut, triez par population ou de A à Z."
          />
          <ListeCommunes className="mt-9" communes={communes} />
        </Conteneur>
      </Section>
    </>
  );
}
