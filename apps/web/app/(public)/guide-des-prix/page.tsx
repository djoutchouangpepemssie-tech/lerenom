import Link from 'next/link';
import { prisma } from '@lerenom/db';
import { Accent, Carte, Conteneur, Section, TitreSection } from '@lerenom/ui';
import { FilAriane } from '@/composants/FilAriane';
import { Estimateur } from '@/composants/Estimateur';

export const metadata = {
  title: 'Guide des prix',
  description:
    'Les prix constatés en Île-de-France, métier par métier et prestation par prestation, avec la TVA applicable et le crédit d’impôt.',
};

const LIBELLES_UNITE: Record<string, string> = {
  forfait: 'le forfait',
  heure: 'de l’heure',
  unite: 'l’unité',
  m2: 'le m²',
  ml: 'le mètre linéaire',
  jour: 'la journée',
};

export default async function PageGuideDesPrix() {
  const univers = await prisma.univers.findMany({
    where: { masque: false },
    orderBy: { rang: 'asc' },
    include: {
      metiers: {
        where: { masque: false },
        orderBy: { rang: 'asc' },
        include: {
          prixMetier: true,
          prestations: {
            where: { masque: false },
            orderBy: [{ tresDemande: 'desc' }, { rang: 'asc' }],
            include: { prixPrestation: true },
          },
        },
      },
    },
  });

  const pourEstimateur = univers.map((u) => ({
    slug: u.slug,
    nom: u.nom,
    couleur: u.couleur,
    metiers: u.metiers.map((m) => ({
      slug: m.slug,
      nom: m.nom,
      tauxTva: m.prixMetier === null ? 20 : Number(m.prixMetier.tauxTva),
      prestations: m.prestations
        .filter((p) => p.prixPrestation !== null)
        .map((p) => ({
          slug: p.slug,
          nom: p.nom,
          unite: p.unite,
          minTTC: Number(p.prixPrestation?.minTTC ?? 0),
          maxTTC: Number(p.prixPrestation?.maxTTC ?? 0),
        })),
    })),
  }));

  return (
    <>
      <Section fond="creme" className="pt-8 pb-10 md:pt-10">
        <Conteneur>
          <FilAriane
            elements={[{ libelle: 'Accueil', href: '/' }, { libelle: 'Guide des prix' }]}
          />
          <h1 className="mt-6 max-w-[22ch] text-[clamp(1.9rem,4.4vw,3rem)]">
            Combien ça <Accent>coûte</Accent>, vraiment
          </h1>
          <p className="text-encre-70 mt-4 max-w-[64ch] text-[1.05rem]">
            Des fourchettes indicatives TTC pour l’Île-de-France, pour que vous sachiez à quoi vous
            attendre avant de demander un devis. Elles ne remplacent pas un devis : seul un devis
            détaillé engage un professionnel.
          </p>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Estimateur"
            titre={
              <>
                Estimez votre <Accent>budget</Accent>
              </>
            }
            chapeau="Choisissez un univers, un métier et une prestation, indiquez la quantité, et obtenez une fourchette avec le détail du calcul."
          />
          <Estimateur className="mt-9" univers={pourEstimateur} />
        </Conteneur>
      </Section>

      <Section fond="creme" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Comprendre un devis"
            titre={
              <>
                Ce qu’un devis doit <Accent>obligatoirement</Accent> contenir
              </>
            }
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Carte className="p-6">
              <h3 className="text-lg">Les mentions obligatoires</h3>
              <ul className="text-encre-70 mt-4 space-y-2.5 text-sm">
                {[
                  'La quantité et le prix unitaire, ligne par ligne.',
                  'Les frais de déplacement, même s’ils sont offerts.',
                  'Les totaux hors taxes et toutes taxes comprises.',
                  'La durée de validité du devis.',
                  'Le caractère gratuit ou payant du devis lui-même.',
                  'La possibilité pour vous de conserver les pièces remplacées.',
                ].map((mention) => (
                  <li key={mention} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="bg-or mt-2 size-1.5 shrink-0 rounded-full"
                    />
                    {mention}
                  </li>
                ))}
              </ul>
              <p className="text-encre-55 mt-5 text-xs">
                Depuis le 1er avril 2017, ce devis est obligatoire avant tout dépannage, réparation
                ou entretien à domicile, quel que soit le montant.
              </p>
            </Carte>

            <Carte className="p-6">
              <h3 className="text-lg">TVA et crédit d’impôt</h3>
              <dl className="mt-4 space-y-3.5 text-sm">
                <div>
                  <dt className="text-encre font-bold">5,5 %</dt>
                  <dd className="text-encre-70">
                    Travaux d’amélioration de la performance énergétique d’un logement de plus de
                    deux ans, et travaux induits.
                  </dd>
                </div>
                <div>
                  <dt className="text-encre font-bold">10 %</dt>
                  <dd className="text-encre-70">
                    Travaux d’amélioration, de transformation et d’entretien d’un logement achevé
                    depuis plus de deux ans.
                  </dd>
                </div>
                <div>
                  <dt className="text-encre font-bold">20 %</dt>
                  <dd className="text-encre-70">
                    Prestations de services, entretien courant, véhicules, événementiel, et
                    logements de moins de deux ans.
                  </dd>
                </div>
              </dl>
              <p className="text-encre-70 mt-5 text-sm">
                Les services à la personne à domicile — ménage, garde d’enfants, soutien scolaire,
                petit jardinage — ouvrent droit à un <strong>crédit d’impôt de 50 %</strong> des
                sommes versées, dans les plafonds en vigueur.
              </p>
            </Carte>
          </div>
        </Conteneur>
      </Section>

      {univers.map((u, rang) => (
        <Section key={u.slug} fond={rang % 2 === 0 ? 'carte' : 'creme'} className="py-12">
          <Conteneur>
            <div className="flex items-center gap-3">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-7 shrink-0"
                style={{ color: u.couleur }}
              >
                <path d={u.icone} fill="currentColor" />
              </svg>
              <h2 className="text-[clamp(1.4rem,3vw,2rem)]">{u.nom}</h2>
            </div>

            <div className="mt-7 space-y-8">
              {u.metiers.map((metier) => (
                <div key={metier.slug}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`/${metier.slug}`}
                      className="text-encre font-[family-name:var(--font-titre)] text-xl"
                    >
                      {metier.nom}
                    </Link>
                    {metier.prixMetier !== null && (
                      <span className="text-encre-55 text-xs">
                        TVA {Number(metier.prixMetier.tauxTva)} %
                      </span>
                    )}
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[32rem] border-collapse text-sm">
                      <caption className="sr-only">
                        Fourchettes de prix indicatives pour {metier.nom}
                      </caption>
                      <thead>
                        <tr className="border-bordure text-encre-55 border-b text-left text-xs">
                          <th scope="col" className="py-2 font-semibold">
                            Prestation
                          </th>
                          <th scope="col" className="py-2 text-right font-semibold">
                            Fourchette TTC
                          </th>
                          <th scope="col" className="py-2 pl-4 font-semibold">
                            Unité
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {metier.prestations.map((prestation) => (
                          <tr key={prestation.slug} className="border-bordure/60 border-b">
                            <th
                              scope="row"
                              className="text-encre py-2.5 pr-4 text-left font-medium"
                            >
                              {prestation.nom}
                              {prestation.tresDemande && (
                                <span className="bg-or/15 text-or-fonce ml-2 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold">
                                  Très demandé
                                </span>
                              )}
                            </th>
                            <td className="text-encre py-2.5 text-right whitespace-nowrap">
                              {prestation.prixPrestation !== null
                                ? `${Number(prestation.prixPrestation.minTTC)} – ${Number(prestation.prixPrestation.maxTTC)} €`
                                : '—'}
                            </td>
                            <td className="text-encre-55 py-2.5 pl-4 whitespace-nowrap">
                              {LIBELLES_UNITE[prestation.unite] ?? prestation.unite}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </Conteneur>
        </Section>
      ))}
    </>
  );
}
