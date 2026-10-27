import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn, retardApparition } from '../utilitaires';

/** Le conteneur de 1240 px, avec la gouttière de 20 px sur téléphone. */
export function Conteneur({ className, children, ...reste }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[var(--spacing-conteneur)] px-5 md:px-8', className)}
      {...reste}
    >
      {children}
    </div>
  );
}

export interface ProprietesSection extends HTMLAttributes<HTMLElement> {
  readonly fond?: 'creme' | 'carte' | 'nuit';
  readonly balise?: ElementType;
}

const FONDS = {
  creme: 'bg-creme text-encre',
  carte: 'bg-carte text-encre',
  nuit: 'bg-nuit text-creme',
} as const;

export function Section({
  fond = 'creme',
  balise: Balise = 'section',
  className,
  children,
  ...reste
}: ProprietesSection) {
  return (
    <Balise className={cn('py-14 md:py-20', FONDS[fond], className)} {...reste}>
      {children}
    </Balise>
  );
}

/** Un titre de section, avec son surtitre et les mots forts en italique or. */
export function TitreSection({
  surtitre,
  titre,
  chapeau,
  centre = false,
  clair = false,
  className,
}: {
  readonly surtitre?: string;
  readonly titre: ReactNode;
  readonly chapeau?: ReactNode;
  readonly centre?: boolean;
  readonly clair?: boolean;
  readonly className?: string;
}) {
  return (
    <header className={cn('max-w-[62ch]', centre && 'mx-auto text-center', className)}>
      {surtitre !== undefined && (
        <p
          className={cn(
            'mb-3 text-[0.72rem] font-bold tracking-[0.18em] uppercase',
            clair ? 'text-or-clair' : 'text-or-fonce',
          )}
        >
          {surtitre}
        </p>
      )}
      <h2 className={cn('text-[clamp(1.75rem,4vw,2.75rem)]', clair ? 'text-creme' : 'text-encre')}>
        {titre}
      </h2>
      {chapeau !== undefined && (
        <p className={cn('mt-4 text-[1.05rem]', clair ? 'text-creme/75' : 'text-encre-70')}>
          {chapeau}
        </p>
      )}
    </header>
  );
}

/** Les mots forts d'un titre, en italique or. */
export function Accent({ children }: { readonly children: ReactNode }) {
  return <em className="text-or-fonce italic not-italic">{children}</em>;
}

/**
 * Apparition en fondu et montée, échelonnée dans une liste.
 *
 * L'animation est portée par une classe utilitaire et un retard : sous
 * `prefers-reduced-motion`, la durée tombe à zéro et le contenu reste visible.
 */
export function Apparition({
  index = 0,
  className,
  children,
  balise: Balise = 'div',
}: {
  readonly index?: number;
  readonly className?: string;
  readonly children: ReactNode;
  readonly balise?: ElementType;
}) {
  return (
    <Balise
      className={cn('animation-apparition', className)}
      style={{ animationDelay: retardApparition(index) }}
    >
      {children}
    </Balise>
  );
}
