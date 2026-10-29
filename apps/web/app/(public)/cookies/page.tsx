import { PageContenu } from '@/composants/PageContenu';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/cookies' },
  title: 'Cookies',
  description:
    'Ce que nous déposons sur votre appareil, et ce que nous ne déposons pas sans votre accord.',
};

export default function Page() {
  return (
    <PageContenu
      titre="Cookies"
      chapeau="Ce que nous déposons sur votre appareil, et ce que nous ne déposons pas sans votre accord."
      miseAJour="27 octobre 2026"
      sections={[
        {
          titre: 'Cookies nécessaires',
          paragraphes: [
            'Ils font fonctionner le site : sécurité, équilibrage de charge, mémorisation du consentement. Ils ne nécessitent pas votre accord, et ils ne servent pas à vous suivre.',
          ],
        },
        {
          titre: 'Mesure d’audience',
          paragraphes: [
            'Nous mesurons l’audience de façon agrégée. Sans votre consentement, la mesure reste anonyme et limitée à la page et à la ville consultées.',
          ],
        },
        {
          titre: 'Publicité',
          paragraphes: [
            'Sans votre consentement, aucun ciblage publicitaire fondé sur votre historique n’est effectué : le ciblage se fait par page et par ville, ce qui suffit à notre modèle.',
            'Nous n’effectuons jamais de ciblage fondé sur des données sensibles, ni de profilage des mineurs.',
          ],
        },
        {
          titre: 'Changer d’avis',
          paragraphes: [
            'Votre choix se modifie à tout moment depuis le pied de page du site. Retirer son consentement est aussi simple que de le donner.',
          ],
        },
      ]}
    />
  );
}
