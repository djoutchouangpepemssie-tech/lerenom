import { cn } from '@lerenom/ui';

/**
 * Le statut d'une ville, dit honnêtement.
 *
 * Une ville qui n'est pas ouverte le dit, et propose d'être prévenue. Laisser croire qu'une
 * demande va partir alors qu'elle attendra l'ouverture serait la plus facile des tromperies,
 * et la plus coûteuse en confiance.
 */
export function StatutVille({
  statut,
  nomVille,
  className,
}: {
  readonly statut: 'ouvert' | 'bientot' | 'annuaire';
  readonly nomVille: string;
  readonly className?: string;
}) {
  const contenus = {
    ouvert: {
      pastille: 'Demandes de devis ouvertes',
      classes: 'border-succes/25 bg-succes-fond text-succes',
      texte: `Déposez votre demande : elle part aujourd’hui à trois professionnels de ${nomVille} au maximum.`,
    },
    bientot: {
      pastille: 'Ouvre bientôt',
      classes: 'border-alerte/25 bg-alerte-fond text-alerte',
      texte: `Les demandes de devis ouvrent prochainement à ${nomVille}. Laissez-nous votre adresse : nous vous prévenons, et vous confirmerez par SMS.`,
    },
    annuaire: {
      pastille: 'Annuaire consultable',
      classes: 'border-bordure bg-creme text-encre-70',
      texte: `Les fiches sont consultables à ${nomVille}, mais les demandes de devis n’y sont pas encore ouvertes : une demande déposée ne part pas chez les professionnels.`,
    },
  } as const;

  const contenu = contenus[statut];

  return (
    <div
      className={cn(
        'rounded-[var(--radius-carte)] border p-4 md:max-w-sm',
        contenu.classes,
        className,
      )}
    >
      <p className="text-sm font-bold">{contenu.pastille}</p>
      <p className="mt-1.5 text-xs leading-relaxed opacity-90">{contenu.texte}</p>
    </div>
  );
}
