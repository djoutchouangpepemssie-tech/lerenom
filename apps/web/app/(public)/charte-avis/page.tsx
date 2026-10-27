import { PageContenu } from '@/composants/PageContenu';

export const metadata = {
  title: 'Charte des',
  description: 'Comment les avis sont collectés, contrôlés, publiés et refusés sur Le Renom.',
};

export default function Page() {
  return (
    <PageContenu
      titre="Charte des"
      accent="avis"
      chapeau="Comment les avis sont collectés, contrôlés, publiés et refusés sur Le Renom."
      miseAJour="27 octobre 2026"
      sections={[
        {
          titre: 'D’où vient un avis',
          paragraphes: [
            'Un avis ne peut être déposé que par une personne ayant réellement déposé une demande sur Le Renom et dont les travaux ont été déclarés réalisés. L’invitation à déposer un avis part quinze jours après les travaux.',
            'Il n’existe aucun autre moyen de déposer un avis : ni formulaire libre, ni import, ni avis collecté ailleurs.',
          ],
        },
        {
          titre: 'Ce que nous contrôlons avant publication',
          paragraphes: [],
          points: [
            'Le lien avec une demande réelle et des travaux déclarés réalisés.',
            'L’absence d’insultes, de propos discriminatoires, de données personnelles de tiers et de contenu manifestement illicite.',
            'L’absence de signaux de faux avis : rafale d’avis sur une même fiche, provenance inhabituelle, texte dupliqué.',
          ],
        },
        {
          titre: 'Refus motivé',
          paragraphes: [
            'Un avis refusé l’est pour un motif précis, communiqué à son auteur. Nous ne refusons jamais un avis parce qu’il est négatif.',
          ],
        },
        {
          titre: 'Droit de réponse',
          paragraphes: [
            'Le professionnel concerné peut répondre publiquement à un avis. Sa réponse est publiée sous l’avis, sans modération de complaisance.',
          ],
        },
        {
          titre: 'Ce qu’un professionnel ne peut pas faire',
          paragraphes: [],
          points: [
            'Acheter un avis, ou en faire déposer par un proche.',
            'Faire supprimer un avis négatif conforme à cette charte.',
            'Conditionner une prestation, une remise ou un geste commercial au dépôt d’un avis favorable.',
          ],
        },
        {
          titre: 'Signalement',
          paragraphes: [
            'Tout avis peut être signalé, par son auteur, par le professionnel concerné ou par un tiers. Un signalement est examiné et la décision est motivée.',
          ],
        },
      ]}
    />
  );
}
