'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { cn } from '../utilitaires';
import { Bouton } from './Bouton';

/**
 * Une modale construite sur `<dialog>` : le navigateur gère le piège de focus, la touche
 * Échap et le fond inerte. Réinventer tout cela en JavaScript ne donne jamais un résultat
 * aussi solide.
 */
export function Modale({
  ouverte,
  onFermer,
  titre,
  description,
  actions,
  children,
  largeur = 'moyenne',
}: {
  readonly ouverte: boolean;
  readonly onFermer: () => void;
  readonly titre: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly largeur?: 'moyenne' | 'large';
}) {
  const reference = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogue = reference.current;
    if (dialogue === null) return;
    if (ouverte && !dialogue.open) dialogue.showModal();
    if (!ouverte && dialogue.open) dialogue.close();
  }, [ouverte]);

  return (
    <dialog
      ref={reference}
      onClose={onFermer}
      onCancel={(evenement) => {
        evenement.preventDefault();
        onFermer();
      }}
      aria-labelledby="modale-titre"
      aria-describedby={description !== undefined ? 'modale-description' : undefined}
      className={cn(
        'border-bordure bg-carte m-auto w-[calc(100vw-2.5rem)] rounded-[var(--radius-panneau)] border p-0',
        'text-encre shadow-levee backdrop:bg-nuit/55 backdrop:backdrop-blur-sm',
        'open:animation-apparition',
        largeur === 'large' ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      <div className="border-bordure flex items-start justify-between gap-4 border-b px-6 py-5">
        <div>
          <h2 id="modale-titre" className="text-2xl">
            {titre}
          </h2>
          {description !== undefined && (
            <p id="modale-description" className="text-encre-70 mt-2 text-sm">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="text-encre-55 hover:bg-creme hover:text-encre -mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-4 stroke-current stroke-[1.8]"
          >
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {children !== undefined && <div className="px-6 py-5">{children}</div>}

      {actions !== undefined && (
        <div className="border-bordure bg-creme flex flex-col-reverse gap-2.5 border-t px-6 py-4 sm:flex-row sm:justify-end">
          {actions}
        </div>
      )}
    </dialog>
  );
}

/**
 * La barre d'action collée en bas de l'écran sur téléphone : « Demander des devis à 3 pros »,
 * « Retour / Continuer », « Accepter / Refuser ». Elle laisse la place à la barre système.
 */
export function BarreCollante({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        'border-bordure bg-carte/95 sticky bottom-0 z-30 border-t backdrop-blur',
        'px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgb(22_24_29/0.08)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Un tiroir plein écran : le menu de téléphone, les filtres, l'aperçu d'une carte. */
export function Tiroir({
  ouvert,
  onFermer,
  titre,
  children,
}: {
  readonly ouvert: boolean;
  readonly onFermer: () => void;
  readonly titre: string;
  readonly children: ReactNode;
}) {
  useEffect(() => {
    if (!ouvert) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.body.style.overflow = precedent;
      document.removeEventListener('keydown', surTouche);
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div
      className="bg-carte fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={titre}
    >
      <div className="border-bordure flex items-center justify-between border-b px-5 py-4">
        <span className="font-[family-name:var(--font-titre)] text-xl">{titre}</span>
        <Bouton aspect="discret" taille="petit" onClick={onFermer} aria-label="Fermer le menu">
          Fermer
        </Bouton>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
    </div>
  );
}
