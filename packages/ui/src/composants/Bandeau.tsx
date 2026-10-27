import { cn } from '../utilitaires';

/**
 * Le bandeau défilant des métiers.
 *
 * Le contenu est dupliqué pour que la boucle n'ait pas de saut visible, et la copie est masquée
 * aux lecteurs d'écran pour ne pas lire deux fois la même liste. Le bandeau s'arrête au survol :
 * un texte qui défile sans fin est illisible dès qu'on veut le lire.
 */
export function BandeauDefilant({
  entrees,
  className,
  dureeSecondes = 40,
}: {
  readonly entrees: readonly string[];
  readonly className?: string;
  readonly dureeSecondes?: number;
}) {
  const Serie = ({ cache }: { cache: boolean }) => (
    <ul aria-hidden={cache || undefined} className="flex shrink-0 items-center gap-8 px-4">
      {entrees.map((entree) => (
        <li key={entree} className="flex shrink-0 items-center gap-8">
          <span className="text-creme/80 text-sm font-semibold tracking-wide whitespace-nowrap">
            {entree}
          </span>
          <span aria-hidden="true" className="bg-or/70 size-1 rounded-full" />
        </li>
      ))}
    </ul>
  );

  return (
    <div className={cn('group bg-nuit relative overflow-hidden py-3.5', className)}>
      <div
        className="flex w-max group-hover:[animation-play-state:paused]"
        style={{
          animation: `lr-defilement ${dureeSecondes}s linear infinite`,
          // Le dégradé est porté par le contenu, pas par le bandeau : sinon il ronge aussi le
          // fond sombre et laisse voir la page aux extrémités.
          maskImage: 'linear-gradient(90deg, transparent, black 7%, black 93%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, black 7%, black 93%, transparent)',
        }}
      >
        <Serie cache={false} />
        <Serie cache />
      </div>
    </div>
  );
}
