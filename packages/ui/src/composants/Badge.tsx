import type { ReactNode } from 'react';
import type { Formule } from '@lerenom/core';
import { cn } from '../utilitaires';

/**
 * Deux familles de badges, qui ne se mélangent jamais.
 *
 * C'est une obligation légale autant qu'une règle de design : un badge payant dit qu'une offre
 * est souscrite, rien de plus. Le présenter comme une garantie de qualité serait une pratique
 * commerciale trompeuse. D'où deux composants distincts, deux jeux de types distincts, et
 * aucun moyen de passer un libellé de mérite à un badge payant.
 */

/* ------------------------------------------------------------------------- */
/* Badges payants                                                             */
/* ------------------------------------------------------------------------- */

export interface ProprietesBadgePayant {
  readonly formule: Exclude<Formule, 'gratuit'>;
  readonly className?: string;
  /** Masque l'info-bulle, par exemple dans un aperçu de carte très dense. */
  readonly sansInfoBulle?: boolean;
}

const BADGES_PAYANTS: Record<
  Exclude<Formule, 'gratuit'>,
  { libelle: string; infoBulle: string; classes: string }
> = {
  essentiel: {
    libelle: 'PRO',
    infoBulle:
      'Cette entreprise a souscrit la formule Essentiel de Le Renom. Cette pastille indique un abonnement ; elle ne dit rien de la qualité de ses prestations.',
    classes: 'bg-encre text-creme',
  },
  premium: {
    libelle: 'Partenaire Premium',
    infoBulle:
      'Cette entreprise a souscrit la formule Premium de Le Renom. Ce badge indique un abonnement ; il ne dit rien de la qualité de ses prestations.',
    classes: 'bg-or-clair/25 text-or-fonce border border-or/45',
  },
  exclusif: {
    libelle: 'Partenaire Exclusif',
    infoBulle:
      'Cette entreprise est le seul partenaire Exclusif de son métier sur cette zone. Ce badge indique un abonnement ; il ne dit rien de la qualité de ses prestations.',
    classes: 'border border-or/70 bg-nuit text-or-clair',
  },
};

function EtoileOr() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="fill-or size-3">
      <path d="M6 0.4l1.6 3.4 3.7.5-2.7 2.6.7 3.7L6 9.3l-3.3 1.7.7-3.7L.7 4.3l3.7-.5z" />
    </svg>
  );
}

function CouronneOr() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 12" className="fill-or size-3.5">
      <path d="M1 10.5h14l-1-6-3.2 2.4L8 1.2 5.2 6.9 2 4.5z" />
    </svg>
  );
}

/** Un badge qui dit seulement qu'une offre est souscrite. */
export function BadgePayant({ formule, className, sansInfoBulle }: ProprietesBadgePayant) {
  const badge = BADGES_PAYANTS[formule];
  const estExclusif = formule === 'exclusif';

  return (
    <span
      title={sansInfoBulle === true ? undefined : badge.infoBulle}
      className={cn(
        'relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1',
        'text-[0.7rem] font-bold tracking-wide uppercase',
        badge.classes,
        // Le reflet or animé de l'emblème Exclusif.
        estExclusif &&
          '[animation:lr-reflet-or_3.6s_ease-in-out_infinite] bg-[linear-gradient(100deg,#0F1115_0%,#0F1115_38%,rgba(201,162,77,0.45)_50%,#0F1115_62%,#0F1115_100%)] bg-[length:280%_100%]',
        className,
      )}
    >
      {formule === 'premium' && <EtoileOr />}
      {estExclusif && <CouronneOr />}
      {badge.libelle}
    </span>
  );
}

/** Le sceau d'exclusivité, affiché à côté de l'emblème Exclusif. */
export function SceauExclusivite({
  zone,
  className,
}: {
  readonly zone: string;
  readonly className?: string;
}) {
  return (
    <span
      title={`Le Renom ne compte qu'un seul partenaire Exclusif par métier et par zone. ${zone} est la zone concernée. Ce sceau indique un abonnement, pas une distinction de qualité.`}
      className={cn(
        'border-or/40 bg-nuit inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-or-clair text-[0.68rem] font-semibold tracking-wide',
        className,
      )}
    >
      <CouronneOr />
      Seul partenaire de sa catégorie · {zone}
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* Badges de mérite                                                           */
/* ------------------------------------------------------------------------- */

export type Merite =
  | 'entreprise-verifiee'
  | 'siret-verifie'
  | 'decennale-verifiee'
  | 'tres-bien-note'
  | 'repond-vite'
  | 'avis-verifies';

const BADGES_MERITE: Record<Merite, { libelle: string; critere: string }> = {
  'entreprise-verifiee': {
    libelle: 'Entreprise vérifiée',
    critere: 'SIRET contrôlé dans la base SIRENE et numéro de téléphone vérifié.',
  },
  'siret-verifie': {
    libelle: 'SIRET vérifié',
    critere: 'Le numéro SIRET a été contrôlé dans la base SIRENE de l’Insee.',
  },
  'decennale-verifiee': {
    libelle: 'Assurance décennale vérifiée',
    critere: 'Attestation d’assurance décennale fournie et en cours de validité.',
  },
  'tres-bien-note': {
    libelle: 'Très bien noté',
    critere: 'Note d’au moins 4,5 sur 5, calculée sur au moins 10 avis vérifiés.',
  },
  'repond-vite': {
    libelle: 'Répond en moins d’1 h',
    critere: 'Délai moyen de première réponse inférieur à une heure sur les 90 derniers jours.',
  },
  'avis-verifies': {
    libelle: 'Avis vérifiés',
    critere: 'Chaque avis est lié à une demande réelle et à des travaux déclarés réalisés.',
  },
};

function Coche() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="stroke-succes size-3 fill-none stroke-[1.8]"
    >
      <path d="M2 6.4l2.6 2.6L10 3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Un badge gratuit, calculé à partir d'un critère publié, accessible à toutes les fiches,
 * y compris gratuites. L'info-bulle donne le critère exact : c'est ce qui le distingue d'une
 * mention commerciale.
 */
export function BadgeMerite({
  merite,
  className,
}: {
  readonly merite: Merite;
  readonly className?: string;
}) {
  const badge = BADGES_MERITE[merite];
  return (
    <span
      title={badge.critere}
      className={cn(
        'border-succes/25 bg-succes-fond inline-flex shrink-0 items-center gap-1.5 rounded-full border',
        'text-succes px-2.5 py-1 text-[0.72rem] font-semibold',
        className,
      )}
    >
      <Coche />
      {badge.libelle}
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* Mention « Sponsorisé »                                                     */
/* ------------------------------------------------------------------------- */

/**
 * La mention obligatoire sur chaque emplacement payé. Elle n'est jamais masquée par une
 * personnalisation de fiche, et elle est toujours lisible : c'est une obligation de loyauté
 * des plateformes.
 */
export function MentionSponsorise({
  className,
  onPourquoi,
}: {
  readonly className?: string;
  readonly onPourquoi?: () => void;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="border-encre/15 bg-encre/[0.06] text-encre-70 rounded border px-1.5 py-0.5 text-[0.65rem] font-bold tracking-widest uppercase">
        Sponsorisé
      </span>
      {onPourquoi !== undefined && (
        <button
          type="button"
          onClick={onPourquoi}
          className="text-encre-55 hover:text-or-fonce text-[0.7rem] font-semibold underline decoration-dotted underline-offset-2 transition-colors"
        >
          Pourquoi ce résultat ?
        </button>
      )}
    </span>
  );
}

export function ListeBadgesMerite({
  merites,
  className,
}: {
  readonly merites: readonly Merite[];
  readonly className?: string;
}): ReactNode {
  if (merites.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {merites.map((m) => (
        <BadgeMerite key={m} merite={m} />
      ))}
    </div>
  );
}
