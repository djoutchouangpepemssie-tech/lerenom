import { PageContenu } from '@/composants/PageContenu';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/cgu' },
  title: 'Conditions d’utilisation',
  description:
    'Les règles d’usage du site Le Renom, pour les visiteurs qui cherchent un professionnel.',
};

export default function Page() {
  return (
    <PageContenu
      titre="Conditions d’utilisation"
      chapeau="Les règles d’usage du site Le Renom, pour les visiteurs qui cherchent un professionnel."
      miseAJour="27 octobre 2026"
      sections={[
        {
          titre: 'Objet',
          paragraphes: [
            'Le Renom est un annuaire et un service de mise en relation. Nous référençons des entreprises, publions des avis liés à des demandes réelles, et transmettons les demandes de devis à trois professionnels au maximum.',
            'Le Renom n’exécute aucun travaux et n’est partie à aucun contrat conclu entre un visiteur et un professionnel. Le contrat, le devis et la facture lient le client et le professionnel, pas Le Renom.',
          ],
        },
        {
          titre: 'Gratuité pour le demandeur',
          paragraphes: [
            'La consultation de l’annuaire et le dépôt d’une demande de devis sont gratuits pour les particuliers et les entreprises qui cherchent un professionnel. Aucun compte n’est nécessaire.',
          ],
        },
        {
          titre: 'Ce que nous garantissons, et ce que nous ne garantissons pas',
          paragraphes: [],
          points: [
            'Nous garantissons que votre demande n’est transmise qu’à trois professionnels au maximum, et jamais au-delà de 72 heures.',
            'Nous garantissons que vos coordonnées ne sont transmises qu’aux professionnels qui acceptent votre demande.',
            'Nous ne garantissons ni qu’un professionnel acceptera votre demande, ni le prix qui vous sera proposé, ni la qualité des travaux réalisés.',
          ],
        },
        {
          titre: 'Vos obligations',
          paragraphes: [],
          points: [
            'Fournir des informations exactes : une demande fondée sur de fausses informations peut être rejetée et votre numéro bloqué.',
            'Vérifier votre numéro de mobile par le code SMS qui vous est envoyé : c’est la condition de l’envoi de votre demande.',
            'Ne déposer de demande que pour un besoin réel.',
          ],
        },
        {
          titre: 'Suspension et retrait',
          paragraphes: [
            'Nous pouvons refuser ou retirer une demande manifestement fantaisiste, abusive ou frauduleuse, et bloquer un numéro ou une adresse signalés.',
          ],
        },
      ]}
    />
  );
}
