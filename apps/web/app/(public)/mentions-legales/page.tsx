import { PageContenu } from '@/composants/PageContenu';

export const metadata = {
  title: 'Mentions légales',
  description: 'L’éditeur du site, l’hébergeur, et l’origine des données publiées.',
};

export default function Page() {
  return (
    <PageContenu
      titre="Mentions légales"
      chapeau="L’éditeur du site, l’hébergeur, et l’origine des données publiées."
      miseAJour="27 octobre 2026"
      sections={[
        {
          titre: 'Éditeur',
          paragraphes: [
            'Le Renom. Les mentions d’immatriculation, l’adresse du siège et le nom du directeur de la publication seront complétés avant l’ouverture du service.',
          ],
        },
        {
          titre: 'Hébergement',
          paragraphes: [
            'Le site est hébergé en Europe. Les bases de données et les fichiers sont hébergés dans l’Union européenne.',
          ],
        },
        {
          titre: 'Origine des données',
          paragraphes: [
            'Les données d’entreprises sont issues de la base SIRENE de l’Insee, publiée sous Licence Ouverte 2.0. La source et la date de mise à jour sont indiquées sur les pages concernées.',
            'Le statut de diffusion choisi par chaque entrepreneur individuel est respecté : lorsqu’une personne a refusé la diffusion, son nom, son adresse précise et sa géolocalisation ne sont pas publiés.',
            'Les adresses sont normalisées avec la Base Adresse Nationale, et le découpage administratif provient de l’Insee, distribué par Etalab.',
          ],
        },
        {
          titre: 'Retrait d’une fiche',
          paragraphes: [
            'Une entreprise peut demander le retrait de sa fiche. La demande est traitée sans justification à fournir, et la fiche cesse d’être publiée.',
          ],
        },
      ]}
    />
  );
}
