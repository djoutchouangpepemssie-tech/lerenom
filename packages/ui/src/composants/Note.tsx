import { cn } from '../utilitaires';

/**
 * La note d'une entreprise, en étoiles et en chiffres.
 *
 * Le chiffre est toujours écrit à côté des étoiles : une note lue uniquement par des étoiles
 * partiellement remplies n'est pas accessible.
 */
export function Note({
  note,
  nombreAvis,
  taille = 'moyenne',
  clair = false,
  className,
}: {
  readonly note: number | null;
  readonly nombreAvis?: number;
  readonly taille?: 'petite' | 'moyenne' | 'grande';
  /** Sur une carte sombre : le chiffre et le nombre d'avis passent en clair. */
  readonly clair?: boolean;
  readonly className?: string;
}) {
  if (note === null) {
    return (
      <span className={cn('text-sm', clair ? 'text-creme/60' : 'text-encre-55', className)}>
        Pas encore d’avis
      </span>
    );
  }

  const tailles = {
    petite: { etoile: 'size-3', texte: 'text-xs' },
    moyenne: { etoile: 'size-3.5', texte: 'text-sm' },
    grande: { etoile: 'size-5', texte: 'text-base' },
  } as const;
  const t = tailles[taille];
  const part = Math.min(1, Math.max(0, note / 5));

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className="relative inline-flex"
        role="img"
        aria-label={`${note.toFixed(1).replace('.', ',')} sur 5`}
      >
        <span className={cn('flex gap-0.5', clair ? 'text-creme/20' : 'text-encre/15')}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Etoile key={i} className={t.etoile} />
          ))}
        </span>
        <span
          aria-hidden="true"
          className="text-or absolute inset-0 flex gap-0.5 overflow-hidden"
          style={{ width: `${part * 100}%` }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Etoile key={i} className={cn(t.etoile, 'shrink-0')} />
          ))}
        </span>
      </span>
      <span className={cn('font-bold', clair ? 'text-creme' : 'text-encre', t.texte)}>
        {note.toFixed(1).replace('.', ',')}
      </span>
      {nombreAvis !== undefined && (
        <span className={cn(clair ? 'text-creme/60' : 'text-encre-55', t.texte)}>
          ({nombreAvis.toLocaleString('fr-FR')} avis)
        </span>
      )}
    </span>
  );
}

function Etoile({ className }: { readonly className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={cn('fill-current', className)}>
      <path d="M10 1l2.6 5.6 6.1.8-4.5 4.3 1.1 6.1L10 14.9 4.7 17.8l1.1-6.1L1.3 7.4l6.1-.8z" />
    </svg>
  );
}
