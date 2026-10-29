import { PageContenu } from '@/composants/PageContenu';

export const metadata = {
  // L'adresse canonique, sans paramètre : une page partagée avec une ancre ou un
  // marqueur de campagne reste la même page.
  alternates: { canonical: '/cgv-pro' },
  title: 'Conditions générales',
  description:
    'Les règles contractuelles entre Le Renom et les entreprises référencées ou abonnées.',
};

export default function Page() {
  return (
    <PageContenu
      titre="Conditions générales"
      accent="professionnelles"
      chapeau="Les règles contractuelles entre Le Renom et les entreprises référencées ou abonnées."
      miseAJour="27 octobre 2026"
      sections={[
        {
          titre: 'Ce qui est garanti',
          paragraphes: [],
          points: [
            'Les emplacements vendus : place n° 1 pour le partenaire Exclusif de son métier sur sa zone, places 2 et 3 en rotation équitable pour les partenaires Premium, toujours étiquetés « Sponsorisé ».',
            'Le nombre de villes de la formule : 2 en Gratuit, 5 en Essentiel, 15 en Premium, sans limite en Exclusif.',
            'Le nombre de demandes partagées incluses : 5 par mois en Premium, 15 par mois en Exclusif.',
            'La garantie Exclusif : si moins de 5 demandes sont reçues sur 3 mois civils consécutifs, avec une fiche complète et un taux de réponse d’au moins 80 %, le mois suivant est offert.',
          ],
        },
        {
          titre: 'Ce qui n’est pas garanti',
          paragraphes: [],
          points: [
            'Aucune position dans Google, ni dans aucun autre moteur de recherche. Les emplacements vendus sont des places dans l’annuaire Le Renom.',
            'Aucun volume de demandes : les demandes incluses sont un plafond, pas un engagement de volume. Elles dépendent des recherches réelles.',
            'Aucune exclusivité en dehors du couple métier × zone acheté : dans ses autres zones, un partenaire Exclusif est traité comme un partenaire Premium.',
          ],
        },
        {
          titre: 'Acceptation d’une demande',
          paragraphes: [
            'Le refus d’une demande est gratuit ; un motif est obligatoire. L’acceptation débloque les coordonnées du client et elle est définitive : aucune annulation n’est possible ensuite, et une demande acceptée restée sans suite reste décomptée.',
            'Le recrédit est réservé à trois cas vérifiés par Le Renom : client injoignable après trois appels tracés, client absent à un rendez-vous confirmé, ou fausses informations confirmées sous 48 heures. Un écart d’informations n’ouvre pas droit à recrédit : le devis passe en nouvelle version et le client re-signe.',
          ],
        },
        {
          titre: 'Contestation',
          paragraphes: [
            'Une demande partagée facturée peut être contestée dans les 7 jours suivant son acceptation, depuis l’espace professionnel, pour un motif précis. La contestation est examinée sous 48 heures. Un taux de contestation anormal déclenche une vérification, dans les deux sens.',
          ],
        },
        {
          titre: 'Usage des coordonnées',
          paragraphes: [
            'Les coordonnées d’un client reçues via Le Renom ne peuvent servir qu’à répondre à sa demande. Toute autre utilisation, notamment commerciale, est interdite et peut entraîner la suspension du compte.',
          ],
        },
        {
          titre: 'Engagement, renouvellement et résiliation',
          paragraphes: [
            'Les formules Essentiel et Premium sont sans engagement en paiement mensuel. La formule Exclusif est engagée 12 mois, avec un renouvellement prioritaire pour le titulaire.',
            'La résiliation prend effet en fin de période. En descente de formule, le professionnel choisit les villes qu’il conserve dans la limite de sa nouvelle formule.',
          ],
        },
        {
          titre: 'Prix',
          paragraphes: [
            'Tous les prix sont indiqués hors taxes. La TVA au taux en vigueur est ajoutée sur les factures Le Renom.',
          ],
        },
      ]}
    />
  );
}
