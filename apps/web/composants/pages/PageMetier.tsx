import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accent, Apparition, Carte, Conteneur, Section, TitreSection } from '@lerenom/ui';
import { FilAriane } from '@/composants/FilAriane';
import { communesOuvertes, metierParSlug } from '@/lib/donnees';
import { aLaVille } from '@/lib/affichage';

const LIBELLES_UNITE: Record<string, string> = {
  forfait: 'le forfait',
  heure: 'de l’heure',
  unite: 'l’unité',
  m2: 'le m²',
  ml: 'le mètre linéaire',
  jour: 'la journée',
};

/** La page d'un métier : ses prestations avec leurs prix, et où trouver ce professionnel. */
export async function PageMetier({ slug }: { readonly slug: string }) {
  const [metier, ouvertes] = await Promise.all([metierParSlug(slug), communesOuvertes()]);
  if (metier === null) notFound();

  const villesOuvertes = ouvertes.filter((c) => c.statut === 'ouvert');
  const tauxTva = metier.prixMetier?.tauxTva;

  return (
    <>
      <Section fond="creme" className="pt-8 pb-12 md:pt-10">
        <Conteneur>
          <FilAriane
            elements={[
              { libelle: 'Accueil', href: '/' },
              { libelle: metier.univers.nom },
              { libelle: metier.nom },
            ]}
          />

          <div className="mt-6 flex items-start gap-4">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mt-1 size-10 shrink-0"
              style={{ color: metier.univers.couleur }}
            >
              <path d={metier.univers.icone} fill="currentColor" />
            </svg>
            <div>
              <h1 className="text-[clamp(1.9rem,4.4vw,3rem)]">
                <Accent>{metier.nom}</Accent> en Île-de-France
              </h1>
              <p className="text-encre-70 mt-3 max-w-[60ch]">
                {metier.prestations.length} prestations référencées, avec leurs prix constatés.
                Décrivez votre besoin et recevez jusqu’à trois devis — gratuitement, et sans créer
                de compte.
              </p>
            </div>
          </div>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Prestations et prix"
            titre={
              <>
                Ce que fait un <Accent>{metier.nom.toLowerCase()}</Accent>
              </>
            }
            chapeau="Fourchettes indicatives TTC, données à titre de repère. Seul un devis détaillé engage le professionnel."
          />

          <ul className="mt-9 grid gap-3 lg:grid-cols-2">
            {metier.prestations.map((prestation, index) => {
              const prix = prestation.prixPrestation;
              return (
                <Apparition key={prestation.slug} index={index % 8} balise="li">
                  <Carte className="flex h-full items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-encre font-semibold">{prestation.nom}</p>
                      {prestation.tresDemande && (
                        <span className="bg-or/15 text-or-fonce mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-bold">
                          Très demandé
                        </span>
                      )}
                    </div>
                    {prix !== null && (
                      <p className="shrink-0 text-right">
                        <span className="text-encre font-[family-name:var(--font-titre)] text-lg">
                          {Number(prix.minTTC)} – {Number(prix.maxTTC)} €
                        </span>
                        <span className="text-encre-55 block text-xs">
                          {LIBELLES_UNITE[prestation.unite] ?? prestation.unite}
                        </span>
                      </p>
                    )}
                  </Carte>
                </Apparition>
              );
            })}
          </ul>

          {tauxTva !== undefined && (
            <p className="text-encre-55 mt-6 text-sm">
              TVA applicable à ce métier : {Number(tauxTva)} %. Le taux réel dépend du logement et
              du chantier ; il est confirmé sur le devis du professionnel.
            </p>
          )}
        </Conteneur>
      </Section>

      <Section fond="creme" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Où trouver ce professionnel"
            titre={
              <>
                Les villes <Accent>ouvertes aux demandes</Accent>
              </>
            }
            chapeau="Partout ailleurs en Île-de-France, l’annuaire reste consultable."
          />
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {villesOuvertes.map((ville) => (
              <li key={ville.code}>
                <Link
                  href={`/${metier.slug}/${ville.slug}`}
                  className="border-bordure bg-carte text-encre hover:border-or inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
                >
                  {metier.nom} {aLaVille(ville.nom)}
                </Link>
              </li>
            ))}
          </ul>
        </Conteneur>
      </Section>

      <Section fond="carte" className="py-12">
        <Conteneur>
          <TitreSection
            surtitre="Ce qu’il faut savoir"
            titre={
              <>
                Avant de signer un <Accent>devis</Accent>
              </>
            }
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                titre: 'Le devis est obligatoire',
                texte:
                  'Depuis le 1er avril 2017, un devis détaillé est obligatoire avant tout dépannage, réparation ou entretien à domicile, quel que soit le montant. Il indique la quantité et le prix unitaire ligne par ligne, les frais de déplacement, les totaux HT et TTC et sa durée de validité.',
              },
              {
                titre: 'Les pièces remplacées vous appartiennent',
                texte:
                  'Le devis doit préciser que vous pouvez conserver les pièces remplacées. C’est votre droit, et c’est aussi le meilleur moyen de vérifier qu’une pièce a bien été changée.',
              },
              {
                titre: 'Les majorations s’annoncent',
                texte:
                  'Une intervention le soir, le dimanche ou un jour férié peut être majorée — mais la majoration doit être annoncée avant l’intervention, pas découverte sur la facture.',
              },
            ].map((item, index) => (
              <Apparition key={item.titre} index={index}>
                <Carte className="h-full p-5">
                  <h3 className="text-lg">{item.titre}</h3>
                  <p className="text-encre-70 mt-2.5 text-sm leading-relaxed">{item.texte}</p>
                </Carte>
              </Apparition>
            ))}
          </div>
        </Conteneur>
      </Section>
    </>
  );
}
