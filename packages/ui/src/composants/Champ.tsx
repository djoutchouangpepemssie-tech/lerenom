import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';
import { cn } from '../utilitaires';

const CHAMP_BASE =
  'w-full min-h-11 rounded-[var(--radius-douce)] border border-bordure bg-carte px-3.5 py-2.5 ' +
  'text-[0.95rem] text-encre placeholder:text-encre-40 ' +
  'transition-colors duration-[var(--duree-courte)] ' +
  'hover:border-or/50 focus:border-or focus:outline-none ' +
  'aria-[invalid=true]:border-erreur aria-[invalid=true]:bg-erreur-fond';

interface ProprietesHabillage {
  readonly etiquette: string;
  readonly aide?: ReactNode | undefined;
  readonly erreur?: string | undefined;
  /** Masque l'étiquette à l'écran en la gardant pour les lecteurs d'écran. */
  readonly etiquetteMasquee?: boolean | undefined;
  readonly className?: string | undefined;
}

function Habillage({
  etiquette,
  aide,
  erreur,
  etiquetteMasquee = false,
  className,
  pour,
  children,
}: ProprietesHabillage & { readonly pour: string; readonly children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={pour}
        className={cn('text-encre text-sm font-semibold', etiquetteMasquee && 'sr-only')}
      >
        {etiquette}
      </label>
      {children}
      {erreur !== undefined ? (
        <p id={`${pour}-erreur`} role="alert" className="text-erreur text-sm font-medium">
          {erreur}
        </p>
      ) : (
        aide !== undefined && (
          <p id={`${pour}-aide`} className="text-encre-55 text-sm">
            {aide}
          </p>
        )
      )}
    </div>
  );
}

export function Champ({
  etiquette,
  aide,
  erreur,
  etiquetteMasquee,
  className,
  id,
  ...reste
}: ProprietesHabillage & InputHTMLAttributes<HTMLInputElement>) {
  const genere = useId();
  const identifiant = id ?? genere;

  return (
    <Habillage
      etiquette={etiquette}
      aide={aide}
      erreur={erreur}
      etiquetteMasquee={etiquetteMasquee}
      className={className}
      pour={identifiant}
    >
      <input
        id={identifiant}
        aria-invalid={erreur !== undefined || undefined}
        aria-describedby={
          erreur !== undefined
            ? `${identifiant}-erreur`
            : aide !== undefined
              ? `${identifiant}-aide`
              : undefined
        }
        className={CHAMP_BASE}
        {...reste}
      />
    </Habillage>
  );
}

export function ZoneTexte({
  etiquette,
  aide,
  erreur,
  etiquetteMasquee,
  className,
  id,
  ...reste
}: ProprietesHabillage & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const genere = useId();
  const identifiant = id ?? genere;

  return (
    <Habillage
      etiquette={etiquette}
      aide={aide}
      erreur={erreur}
      etiquetteMasquee={etiquetteMasquee}
      className={className}
      pour={identifiant}
    >
      <textarea
        id={identifiant}
        rows={4}
        aria-invalid={erreur !== undefined || undefined}
        className={cn(CHAMP_BASE, 'resize-y leading-relaxed')}
        {...reste}
      />
    </Habillage>
  );
}

export function Liste({
  etiquette,
  aide,
  erreur,
  etiquetteMasquee,
  className,
  id,
  children,
  ...reste
}: ProprietesHabillage & SelectHTMLAttributes<HTMLSelectElement>) {
  const genere = useId();
  const identifiant = id ?? genere;

  return (
    <Habillage
      etiquette={etiquette}
      aide={aide}
      erreur={erreur}
      etiquetteMasquee={etiquetteMasquee}
      className={className}
      pour={identifiant}
    >
      <select id={identifiant} className={cn(CHAMP_BASE, 'cursor-pointer pr-9')} {...reste}>
        {children}
      </select>
    </Habillage>
  );
}
