import { PageContenu } from '@/composants/PageContenu';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/confidentialite' },
  title: 'Confidentialité',
  description:
    'Quelles données nous traitons, pourquoi, combien de temps, et comment exercer vos droits.',
};

export default function Page() {
  return (
    <PageContenu
      titre="Confidentialité"
      chapeau="Quelles données nous traitons, pourquoi, combien de temps, et comment exercer vos droits."
      miseAJour="27 octobre 2026"
      sections={[
        {
          titre: 'Les données que nous traitons',
          paragraphes: [],
          points: [
            'Pour une demande de devis : prénom, adresse électronique, numéro de mobile vérifié, adresse des travaux, description du besoin et photos éventuelles.',
            'Pour une entreprise : SIRET, identité du représentant, coordonnées professionnelles, contenus de la fiche.',
            'Pour la mesure d’audience : des données agrégées, sans recoupement avec votre identité tant que vous n’y consentez pas.',
          ],
        },
        {
          titre: 'Pourquoi, et sur quelle base',
          paragraphes: [
            'Le traitement d’une demande de devis repose sur votre consentement explicite, recueilli au moment de l’envoi. Le texte exact de ce consentement est conservé avec votre demande : c’est lui qui fait foi, pas une version réécrite depuis.',
            'La gestion des comptes professionnels et la facturation reposent sur l’exécution du contrat.',
          ],
        },
        {
          titre: 'Qui reçoit vos données',
          paragraphes: [
            'Vos coordonnées ne sont transmises qu’aux professionnels qui acceptent votre demande, dans la limite de trois. Avant acceptation, un professionnel voit votre besoin, votre quartier sans la rue, la date souhaitée, le budget et votre prénom.',
            'Les numéros et adresses électroniques écrits dans le texte libre de votre demande sont retirés automatiquement avant transmission, et les photos sont débarrassées de leurs données de localisation.',
          ],
        },
        {
          titre: 'Combien de temps',
          paragraphes: [
            'Les demandes de devis sont conservées 24 mois, pour la facturation, le traitement des litiges et les statistiques. Les données de facturation sont conservées selon les durées légales.',
          ],
        },
        {
          titre: 'Vos droits',
          paragraphes: [
            'Vous disposez d’un droit d’accès, de rectification, d’effacement, d’opposition et de portabilité. Une demande est traitée sous un mois.',
            'Pour l’exercer, écrivez-nous en répondant à n’importe quel message que vous avez reçu de Le Renom, ou via la page de signalement.',
          ],
        },
        {
          titre: 'Appels',
          paragraphes: [
            'Les numéros de suivi n’enregistrent pas les conversations. Seuls la date, la durée et le fait qu’un appel ait abouti ou non sont conservés.',
          ],
        },
      ]}
    />
  );
}
