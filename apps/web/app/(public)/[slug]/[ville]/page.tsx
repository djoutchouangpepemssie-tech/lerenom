import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accent, Carte, Conteneur, Section, TitreSection } from '@lerenom/ui';
import { FilAriane } from '@/composants/FilAriane';
import { FiltresResultats } from '@/composants/FiltresResultats';
import { ListeResultats } from '@/composants/ListeResultats';
import { StatutVille } from '@/composants/StatutVille';
import { communeParSlug, filtresActifs, metierParSlug, resultats } from '@/lib/donnees';
import type { FiltresResultats as Filtres } from '@/lib/donnees';
import { aLaVille, nomVille } from '@/lib/affichage';

interface Parametres {
  readonly params: Promise<{ readonly slug: string; readonly ville: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Les filtres sont lus dans l'adresse : une recherche filtrée se partage et se met en favori. */
function litFiltres(parametres: Record<string, string | string[] | undefined>): Filtres {
  const valeur = (cle: string): string | undefined => {
    const brut = parametres[cle];
    return Array.isArray(brut) ? brut[0] : brut;
  };
  const actif = (cle: string): boolean => valeur(cle) === '1';
  const tri = valeur('tri');
  const prestation = valeur('prestation');

  return {
    ...(actif('urgence') ? { urgence: true } : {}),
    ...(actif('dispo') ? { disponible: true } : {}),
    ...(actif('note') ? { bienNote: true } : {}),
    ...(actif('partenaires') ? { partenaires: true } : {}),
    ...(actif('decennale') ? { decennale: true } : {}),
    ...(prestation !== undefined ? { prestation } : {}),
    ...(tri === 'note' || tri === 'avis' ? { tri } : {}),
  };
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
 * entreprises actives, et aucun filtre actif. Sinon elle reste utile au visiteur mais passe en
 * `noindex, follow`. Rien de tout cela n'est visible à l'écran.
 */
export default async function PageResultats({ params, searchParams }: Parametres) {
  const { slug, ville } = await params;
  const filtres = litFiltres(await searchParams);

  // Deux lectures : la liste filtrée qui s'affiche, et la liste complète dont on tire les
  // compteurs des puces. Sans ces compteurs, un filtre qui vide la page serait une impasse.
  const [donnees, complet] = await Promise.all([
    resultats(slug, ville, filtres),
    resultats(slug, ville),
  ]);
  if (donnees === null || complet === null) notFound();

  const { metier, commune, pros, dernierRangSponsorise } = donnees;
  // La règle d'indexation porte sur la page non filtrée : c'est elle qui est publiée.
  const indexable = complet.pros.length >= 3 && !filtresActifs(filtres);

  const comptes = {
    urgence: complet.pros.filter((p) => p.interventionUrgente).length,
    disponible: complet.pros.filter((p) => p.disponible).length,
    bienNote: complet.pros.filter((p) => (p.note ?? 0) >= 4.5).length,
    partenaires: complet.pros.filter((p) => p.formule !== 'gratuit').length,
    decennale: complet.pros.filter((p) => p.decennaleVerifiee).length,
  };

  return (
    <>
      {!indexable && <meta name="robots" content="noindex, follow" />}

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
                {complet.pros.length === 0
                  ? `Aucune entreprise n’est encore référencée pour ce métier ${aLaVille(commune.nom)}.`
                  : `${complet.pros.length} ${complet.pros.length > 1 ? 'professionnels référencés' : 'professionnel référencé'} ${aLaVille(commune.nom)}, classés par notre score de qualité.`}
              </p>
            </div>
            <StatutVille statut={commune.statut} nomVille={nomVille(commune.nom)} />
          </div>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-10">
        <Conteneur>
          <FiltresResultats
            prestations={metier.prestations.map((p) => ({ slug: p.slug, nom: p.nom }))}
            comptes={comptes}
          />

          {pros.length === 0 ? (
            <Carte className="mt-8 p-8 text-center">
              <h2 className="text-xl">
                {complet.pros.length === 0
                  ? `Pas encore de ${metier.nom.toLowerCase()} ici`
                  : 'Aucun professionnel ne correspond à ces filtres'}
              </h2>
              <p className="text-encre-70 mx-auto mt-3 max-w-[54ch] text-sm leading-relaxed">
                {complet.pros.length === 0 ? (
                  <>
                    Nous référençons les entreprises d’Île-de-France au fur et à mesure. En
                    attendant, vous pouvez consulter les {metier.nom.toLowerCase()}s des villes
                    voisines, ou déposer une demande : nous la transmettrons dès qu’un professionnel
                    sera disponible.
                  </>
                ) : (
                  <>
                    {complet.pros.length}{' '}
                    {complet.pros.length > 1
                      ? 'professionnels sont référencés'
                      : 'professionnel est référencé'}{' '}
                    ici, mais aucun ne remplit tous les critères choisis. Retirez un filtre pour les
                    voir.
                  </>
                )}
              </p>
              <Link
                href={`/${metier.slug}`}
                className="text-or-fonce mt-6 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              >
                Voir tout sur le métier de {metier.nom.toLowerCase()}
              </Link>
            </Carte>
          ) : (
            <div className="mt-7">
              <ListeResultats
                pros={pros}
                dernierRangSponsorise={dernierRangSponsorise}
                metierSlug={metier.slug}
                communeSlug={commune.slug}
              />
            </div>
          )}

          <Carte className="border-or/30 bg-or/[0.06] mt-8 p-5">
            <p className="text-encre-70 text-sm leading-relaxed">
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
                  href={`/${metier.slug}/${commune.slug}?prestation=${prestation.slug}`}
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
