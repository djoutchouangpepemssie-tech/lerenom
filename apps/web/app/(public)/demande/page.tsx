import { Accent, Conteneur, Section } from '@lerenom/ui';
import { FilAriane } from '@/composants/FilAriane';
import { FormulaireDemande } from '@/composants/FormulaireDemande';
import { catalogue } from '@/lib/donnees';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/demande' },
  title: 'Demander un devis',
  description:
    'Décrivez votre besoin en trois minutes. Jusqu’à trois professionnels vous répondent, sans que vous ayez de compte à créer.',
};

export default async function PageDemande() {
  const cat = await catalogue();

  return (
    <>
      <Section fond="creme" className="pt-8 pb-8 md:pt-10">
        <Conteneur>
          <FilAriane
            elements={[{ libelle: 'Accueil', href: '/' }, { libelle: 'Demander un devis' }]}
          />
          <h1 className="mt-6 max-w-[22ch] text-[clamp(1.9rem,4.4vw,3rem)]">
            Votre besoin, <Accent>trois devis</Accent>
          </h1>
          <p className="text-encre-70 mt-3 max-w-[58ch]">
            Trois minutes, aucun compte à créer. Votre demande part à trois professionnels au
            maximum, et vos coordonnées ne leur sont transmises que s’ils acceptent.
          </p>
        </Conteneur>
      </Section>

      <Section fond="carte" className="pt-0 pb-16">
        <Conteneur>
          <FormulaireDemande
            univers={cat.univers.map((u) => ({
              slug: u.slug,
              nom: u.nom,
              couleur: u.couleur,
              icone: u.icone,
              metiers: u.metiers.map((m) => ({
                slug: m.slug,
                nom: m.nom,
                prestations: m.prestations.map((p) => ({
                  slug: p.slug,
                  nom: p.nom,
                  tresDemande: p.tresDemande,
                })),
              })),
            }))}
          />
        </Conteneur>
      </Section>
    </>
  );
}
