import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accent, Apparition, Carte, Conteneur, Section, TitreSection } from '@lerenom/ui';
import { CarteResultat } from '@/composants/CarteResultat';
import { FilAriane } from '@/composants/FilAriane';
import { StatutVille } from '@/composants/StatutVille';
import { communeParSlug, metierParSlug, resultats } from '@/lib/donnees';
import { aLaVille, nomVille } from '@/lib/affichage';

export const revalidate = 300;

interface Parametres {
  readonly params: Promise<{ readonly slug: string; readonly ville: string }>;
}

export async function generateMetadata({ params }: Parametres): Promise<Metadata> {
  const { slug, ville } = await params;
  const [metier, commune] = await Promise.all([metierParSlug(slug), communeParSlug(ville)]);
  if (metier === null || commune === null) return {};

  return {
    title: `${metier.nom} ${aLaVille(commune.nom)}`,
    description: `Trouvez un ${metier.nom.toLowerCase()} ${aLaVille(commune.nom)} : avis vérifiés, prix constatés et jusqu’à 3 devis gratuits.`,
  };
}

/**
 * La page de résultats d'un métier dans une ville — la page la plus importante du site public.
 *
 * Elle est **indexable seulement si elle apporte une valeur réelle** : au moins trois
 * entreprises actives. Sinon elle reste utile au visiteur mais passe en `noindex, follow`,
 * conformément à la règle d'indexation. Rien de tout cela n'est visible à l'écran.
 */
export default async function PageResultats({ params }: Parametres) {
  const { slug, ville } = await params;
  const donnees = await resultats(slug, ville);
  if (donnees === null) notFound();

  const { metier, commune, pros, dernierRangSponsorise } = donnees;
  const assezDeValeur = pros.length >= 3;

  return (
    <>
      {/* La règle d'indexation s'applique dans le rendu, et ne se voit jamais à l'écran. */}
      {!assezDeValeur && <meta name="robots" content="noindex, follow" />}

      <Section fond="creme" className="pt-8 pb-10 md:pt-10">
        <Conteneur>
          <FilAriane
            elements={[
              { libelle: 'Accueil', href: '/' },
              { libelle: commune.departement.nom, href: `/${commune.departement.slug}` },
              { libelle: nomVille(commune.nom), href: `/${commune.slug}` },
              { libelle: metier.nom },
            ]}
          />

          <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[clamp(1.9rem,4.4vw,3rem)]">
                {metier.nom} <Accent>{aLaVille(commune.nom)}</Accent>
              </h1>
              <p className="text-encre-70 mt-3 max-w-[56ch]">
                {pros.length === 0
                  ? `Aucune entreprise n’est encore référencée pour ce métier ${aLaVille(commune.nom)}.`
                  : `${pros.length} ${pros.length > 1 ? 'professionnels référencés' : 'professionnel référencé'} ${aLaVille(commune.nom)}, classés par notre score de qualité.`}
              </p>
            </div>
            <StatutVille statut={commune.statut} nomVille={nomVille(commune.nom)} />
          </div>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-10">
        <Conteneur>
          {pros.length === 0 ? (
            <Carte className="p-8 text-center">
              <h2 className="text-xl">Pas encore de {metier.nom.toLowerCase()} ici</h2>
              <p className="text-encre-70 mx-auto mt-3 max-w-[52ch] text-sm">
                Nous référençons les entreprises d’Île-de-France au fur et à mesure. En attendant,
                vous pouvez consulter les {metier.nom.toLowerCase()}s des villes voisines, ou
                déposer une demande : nous la transmettrons dès qu’un professionnel sera disponible.
              </p>
              <Link
                href={`/${metier.slug}`}
                className="text-or-fonce mt-6 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              >
                Voir tout sur le métier de {metier.nom.toLowerCase()}
              </Link>
            </Carte>
          ) : (
            <ol className="space-y-3">
              {pros.map((pro, index) => (
                <li key={pro.id}>
                  {index === dernierRangSponsorise && dernierRangSponsorise > 0 && (
                    <div className="mb-4 flex items-center gap-4">
                      <span className="bg-bordure h-px flex-1" />
                      <span className="text-encre-55 text-[0.7rem] font-bold tracking-[0.16em] uppercase">
                        Classement naturel
                      </span>
                      <span className="bg-bordure h-px flex-1" />
                    </div>
                  )}
                  <Apparition index={index}>
                    <CarteResultat pro={pro} index={index} />
                  </Apparition>
                </li>
              ))}
            </ol>
          )}

          <Carte className="border-or/30 bg-or/[0.06] mt-8 p-5">
            <p className="text-encre-70 text-sm">
              <strong className="text-encre font-bold">Comment nous classons.</strong> Trois places
              au maximum sont payées et portent toujours la mention « Sponsorisé ». Tout le reste
              est classé par un score de qualité : qualité des avis, activité sur Le Renom,
              pertinence pour votre besoin, réactivité et fraîcheur de la fiche. Le paiement n’y
              entre pour rien, et une fiche payante dont la note passe sous 3,5 perd sa place
              sponsorisée.{' '}
              <Link
                href="/comment-nous-classons"
                className="text-or-fonce font-semibold underline underline-offset-4"
              >
                Lire la méthode complète
              </Link>
            </p>
          </Carte>
        </Conteneur>
      </Section>

      <Section fond="creme" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Les prestations"
            titre={
              <>
                Ce que fait un <Accent>{metier.nom.toLowerCase()}</Accent>
              </>
            }
          />
          <ul className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {metier.prestations.slice(0, 12).map((prestation) => (
              <li key={prestation.slug}>
                <Link
                  href={`/${metier.slug}`}
                  className="border-bordure bg-carte text-encre hover:border-or flex min-h-12 items-center rounded-[var(--radius-douce)] border px-4 text-sm font-medium transition-colors"
                >
                  {prestation.nom}
                </Link>
              </li>
            ))}
          </ul>
        </Conteneur>
      </Section>
    </>
  );
}
