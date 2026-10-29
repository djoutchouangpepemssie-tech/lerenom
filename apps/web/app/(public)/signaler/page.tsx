import { PageContenu } from '@/composants/PageContenu';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/signaler' },
  title: 'Signaler un',
  description:
    'Un avis, une fiche, une photo ou un texte vous semble illicite ou trompeur ? Voici comment nous le dire, et ce que nous en faisons.',
};

export default function Page() {
  return (
    <PageContenu
      titre="Signaler un"
      accent="contenu"
      chapeau="Un avis, une fiche, une photo ou un texte vous semble illicite ou trompeur ? Voici comment nous le dire, et ce que nous en faisons."
      miseAJour="27 octobre 2026"
      sections={[
        {
          titre: 'Ce que vous pouvez signaler',
          paragraphes: [],
          points: [
            'Un avis qui ne respecte pas notre charte : insultes, propos discriminatoires, données personnelles d’un tiers, avis manifestement faux.',
            'Une fiche d’entreprise dont les informations sont fausses, trompeuses ou usurpées.',
            'Une photo ou un texte publié sur une fiche qui porte atteinte à un droit.',
            'Une demande de retrait de votre propre fiche d’entreprise.',
          ],
        },
        {
          titre: 'Comment signaler',
          paragraphes: [
            'Écrivez-nous en répondant à n’importe quel message reçu de Le Renom, ou utilisez le bouton de signalement présent sur chaque fiche et sur chaque avis. Indiquez le contenu concerné, le motif, et tout élément utile.',
          ],
        },
        {
          titre: 'Ce que nous en faisons',
          paragraphes: [
            'Chaque signalement entre dans une file de modération. La décision — retrait ou maintien — est motivée et communiquée à l’auteur du signalement et, lorsqu’il y a retrait, à l’auteur du contenu.',
            'Un recours est possible contre toute décision de modération.',
          ],
        },
        {
          titre: 'Contenus manifestement illicites',
          paragraphes: [
            'Un contenu manifestement illicite est retiré sans attendre, et la décision est motivée a posteriori.',
          ],
        },
      ]}
    />
  );
}
