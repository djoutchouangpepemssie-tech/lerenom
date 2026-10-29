import type { CSSProperties } from 'react';
import { cn } from '../utilitaires';

/**
 * Les toits de Paris, la nuit : zinc, mansardes, cheminées qui fument, fenêtres qui s'allument.
 *
 * Illustration originale dessinée en SVG : aucune photo de stock, quelques kilo-octets, et un
 * rendu net à toutes les densités — ce qui compte pour le LCP du héros de l'accueil.
 *
 * La composition est construite immeuble par immeuble, et les fenêtres sont posées à l'intérieur
 * de chaque façade plutôt qu'à des coordonnées absolues : l'illustration reste juste quelle que
 * soit la largeur, et ajouter un immeuble n'oblige pas à replacer ses fenêtres à la main.
 *
 * Chaque fenêtre s'allume avec son propre retard : l'effet est celui d'un quartier qui s'éveille,
 * pas celui d'un clignotant. Sous `prefers-reduced-motion`, la feuille de style globale coupe les
 * animations et les fenêtres restent allumées.
 */

const LARGEUR = 1200;
const HAUTEUR = 420;
const SOL = HAUTEUR;

interface Immeuble {
  readonly x: number;
  readonly largeur: number;
  /** Hauteur du haut de la façade (plus le nombre est petit, plus l'immeuble est haut). */
  readonly toit: number;
  /** Hauteur de la mansarde posée sur la façade. */
  readonly mansarde: number;
  readonly cheminees: number;
}

/** Rang du fond : plus bas, plus sombre, moins détaillé. */
const FOND: readonly Immeuble[] = [
  { x: -20, largeur: 130, toit: 172, mansarde: 26, cheminees: 2 },
  { x: 104, largeur: 108, toit: 146, mansarde: 30, cheminees: 1 },
  { x: 206, largeur: 142, toit: 186, mansarde: 24, cheminees: 2 },
  { x: 342, largeur: 118, toit: 158, mansarde: 28, cheminees: 1 },
  { x: 454, largeur: 136, toit: 178, mansarde: 26, cheminees: 2 },
  { x: 584, largeur: 112, toit: 150, mansarde: 30, cheminees: 1 },
  { x: 690, largeur: 144, toit: 190, mansarde: 24, cheminees: 2 },
  { x: 828, largeur: 120, toit: 162, mansarde: 28, cheminees: 1 },
  { x: 942, largeur: 138, toit: 180, mansarde: 26, cheminees: 2 },
  { x: 1074, largeur: 146, toit: 154, mansarde: 30, cheminees: 1 },
];

/** Rang du premier plan : plus haut en contraste, plus bas sur l'image. */
const PREMIER_PLAN: readonly Immeuble[] = [
  { x: -16, largeur: 156, toit: 244, mansarde: 34, cheminees: 2 },
  { x: 134, largeur: 128, toit: 218, mansarde: 38, cheminees: 1 },
  { x: 256, largeur: 168, toit: 258, mansarde: 32, cheminees: 2 },
  { x: 418, largeur: 134, toit: 226, mansarde: 36, cheminees: 2 },
  { x: 546, largeur: 158, toit: 250, mansarde: 34, cheminees: 1 },
  { x: 698, largeur: 130, toit: 214, mansarde: 38, cheminees: 2 },
  { x: 822, largeur: 164, toit: 262, mansarde: 32, cheminees: 2 },
  { x: 980, largeur: 136, toit: 230, mansarde: 36, cheminees: 1 },
  { x: 1110, largeur: 110, toit: 246, mansarde: 34, cheminees: 2 },
];

interface Fenetre {
  readonly x: number;
  readonly y: number;
  readonly l: number;
  readonly h: number;
  readonly retard: number;
  readonly allumee: boolean;
  /**
   * Cette fenêtre s'allume et s'éteint, ou reste fixe.
   *
   * Les deux tiers des fenêtres étaient allumées **et** animées : près de 235 animations
   * infinies sur une illustration décorative, chacune avec son style en ligne recopié dans
   * le balisage puis dans la charge d'hydratation. L'accueil envoyait 351 Kio de données
   * d'hydratation pour 83 liens, et passait 1,3 s à composer.
   *
   * L'effet recherché est que *quelques* fenêtres s'allument — une façade dont toutes les
   * fenêtres clignotent de concert ne ressemble d'ailleurs à rien. Une sur sept suffit, et
   * c'est même plus juste.
   */
  readonly scintille: boolean;
}

/**
 * Pose une grille de fenêtres dans une façade.
 *
 * Toutes les fenêtres ne s'allument pas : une façade entièrement éclairée ne ressemble pas à un
 * immeuble habité. Le choix est déterministe — dérivé de la position — pour que le rendu serveur
 * et le rendu client soient identiques, et pour qu'une capture d'écran soit reproductible.
 */
function fenetresDe(immeuble: Immeuble, premierPlan: boolean): readonly Fenetre[] {
  const largeurFenetre = premierPlan ? 13 : 10;
  const hauteurFenetre = premierPlan ? 18 : 14;
  const ecartX = premierPlan ? 34 : 27;
  const ecartY = premierPlan ? 36 : 29;

  const hautFacade = immeuble.toit + immeuble.mansarde + 8;
  const colonnes = Math.max(1, Math.floor((immeuble.largeur - 16) / ecartX));
  const marge = (immeuble.largeur - (colonnes - 1) * ecartX - largeurFenetre) / 2;
  const rangs = Math.max(1, Math.floor((SOL - hautFacade - 10) / ecartY));

  const fenetres: Fenetre[] = [];
  for (let colonne = 0; colonne < colonnes; colonne += 1) {
    for (let rang = 0; rang < rangs; rang += 1) {
      // Suite déterministe, suffisamment irrégulière pour ne pas se voir.
      const graine = (immeuble.x * 7 + colonne * 31 + rang * 17) % 23;
      fenetres.push({
        x: immeuble.x + marge + colonne * ecartX,
        y: hautFacade + rang * ecartY,
        l: largeurFenetre,
        h: hauteurFenetre,
        retard: (graine % 11) * 0.9,
        allumee: graine % 3 !== 0,
        scintille: graine % 3 !== 0 && graine % 7 === 0,
      });
    }
  }
  return fenetres;
}

/** Les lucarnes de la mansarde : une ou deux par immeuble, toujours allumées en premier. */
function lucarnesDe(immeuble: Immeuble): readonly Fenetre[] {
  const nombre = immeuble.largeur > 140 ? 2 : 1;
  const l = 14;
  const h = 15;
  return Array.from({ length: nombre }, (_, index) => ({
    x: immeuble.x + (immeuble.largeur * (index + 1)) / (nombre + 1) - l / 2,
    y: immeuble.toit + immeuble.mansarde - h - 3,
    l,
    h,
    retard: ((immeuble.x + index * 13) % 17) * 0.6,
    allumee: true,
    // Les lucarnes sont peu nombreuses et au premier plan : ce sont elles qu'on regarde,
    // donc ce sont elles qui méritent de scintiller.
    scintille: true,
  }));
}

function cheminéesDe(
  immeuble: Immeuble,
): readonly { x: number; y: number; l: number; h: number }[] {
  return Array.from({ length: immeuble.cheminees }, (_, index) => {
    const l = 13;
    const h = 30 + ((immeuble.x + index * 9) % 3) * 7;
    return {
      x: immeuble.x + (immeuble.largeur * (index + 1)) / (immeuble.cheminees + 1) - l / 2 + 18,
      y: immeuble.toit - h,
      l,
      h,
    };
  });
}

function RangImmeubles({
  immeubles,
  premierPlan,
}: {
  readonly immeubles: readonly Immeuble[];
  readonly premierPlan: boolean;
}) {
  const remplissage = premierPlan ? 'url(#lr-zinc-pres)' : 'url(#lr-zinc-loin)';
  const remplissageToit = premierPlan ? '#3F4552' : '#2E333C';
  const opacite = premierPlan ? 1 : 0.8;

  return (
    <g opacity={opacite}>
      {immeubles.map((immeuble, index) => {
        const hautFacade = immeuble.toit + immeuble.mansarde;
        return (
          <g key={`${premierPlan ? 'pres' : 'loin'}-${immeuble.x}`}>
            {/* Cheminées et fumée, dessinées derrière la mansarde. */}
            {cheminéesDe(immeuble).map((cheminee, rang) => (
              <g key={`cheminee-${cheminee.x}`}>
                <ellipse
                  cx={cheminee.x + cheminee.l / 2}
                  cy={cheminee.y - 10}
                  rx="8"
                  ry="13"
                  fill="url(#lr-fumee)"
                  style={{
                    animation: `lr-fumee ${7 + ((index + rang) % 4)}s ease-out infinite`,
                    animationDelay: `${((index * 2 + rang) % 7) * 1.1}s`,
                    transformOrigin: `${cheminee.x + cheminee.l / 2}px ${cheminee.y - 10}px`,
                  }}
                />
                <rect
                  x={cheminee.x}
                  y={cheminee.y}
                  width={cheminee.l}
                  height={cheminee.h}
                  fill={remplissageToit}
                  rx="1.5"
                />
                <rect
                  x={cheminee.x - 2.5}
                  y={cheminee.y - 4}
                  width={cheminee.l + 5}
                  height="5"
                  fill="#4A5160"
                  rx="1.5"
                />
                {/* Les mitres de terre cuite, détail parisien. */}
                <rect
                  x={cheminee.x + 1.5}
                  y={cheminee.y - 9}
                  width="4"
                  height="6"
                  fill="#6B4A32"
                  rx="1"
                />
                <rect
                  x={cheminee.x + 7}
                  y={cheminee.y - 9}
                  width="4"
                  height="6"
                  fill="#6B4A32"
                  rx="1"
                />
              </g>
            ))}

            {/* La mansarde : un trapèze, comme un toit parisien en zinc. */}
            <path
              d={`M${immeuble.x} ${hautFacade} L${immeuble.x + 9} ${immeuble.toit} L${immeuble.x + immeuble.largeur - 9} ${immeuble.toit} L${immeuble.x + immeuble.largeur} ${hautFacade} Z`}
              fill={remplissageToit}
            />
            {/* La corniche, qui sépare le toit de la façade. */}
            <rect
              x={immeuble.x - 3}
              y={hautFacade}
              width={immeuble.largeur + 6}
              height="6"
              fill="#4A5160"
              rx="1"
            />

            {/* La façade. */}
            <rect
              x={immeuble.x}
              y={hautFacade + 5}
              width={immeuble.largeur}
              height={SOL - hautFacade}
              fill={remplissage}
            />

            {/* Lucarnes de la mansarde, puis fenêtres de la façade. */}
            {[...lucarnesDe(immeuble), ...fenetresDe(immeuble, premierPlan)].map((fenetre) => (
              <g key={`fenetre-${fenetre.x}-${fenetre.y}`}>
                <rect
                  x={fenetre.x - 1.5}
                  y={fenetre.y - 1.5}
                  width={fenetre.l + 3}
                  height={fenetre.h + 3}
                  fill="#161A21"
                  rx="1.5"
                />
                <rect
                  x={fenetre.x}
                  y={fenetre.y}
                  width={fenetre.l}
                  height={fenetre.h}
                  fill={fenetre.allumee ? '#E2C27A' : '#272C35'}
                  rx="1"
                  className={fenetre.scintille ? 'fenetre-scintillante' : undefined}
                  style={
                    // Seul le retard varie d'une fenêtre à l'autre : la déclaration
                    // d'animation vit dans la feuille de style, pas recopiée deux cent fois
                    // dans le document.
                    fenetre.scintille
                      ? ({ '--retard': `${fenetre.retard}s` } as CSSProperties)
                      : undefined
                  }
                />
                {/* Le montant central de la fenêtre à la française. */}
                {fenetre.allumee && (
                  <rect
                    x={fenetre.x + fenetre.l / 2 - 0.5}
                    y={fenetre.y}
                    width="1"
                    height={fenetre.h}
                    fill="#161A21"
                    opacity="0.55"
                  />
                )}
              </g>
            ))}

            {/* Les joints debout du zinc, sur la mansarde. */}
            <g stroke="#565E6E" strokeWidth="0.7" opacity="0.5">
              {Array.from({ length: Math.floor(immeuble.largeur / 18) }, (_, trait) => (
                <line
                  key={trait}
                  x1={immeuble.x + 12 + trait * 18}
                  y1={immeuble.toit}
                  x2={immeuble.x + 9 + trait * 18}
                  y2={hautFacade}
                />
              ))}
            </g>
          </g>
        );
      })}
    </g>
  );
}

export function ToitsDeParis({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
      preserveAspectRatio="xMidYMax meet"
      className={cn('block w-full', className)}
      role="img"
      aria-label="Les toits de Paris la nuit : mansardes en zinc, cheminées qui fument et fenêtres allumées"
    >
      <defs>
        <linearGradient id="lr-zinc-loin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#262B34" />
          <stop offset="100%" stopColor="#1A1E25" />
        </linearGradient>
        <linearGradient id="lr-zinc-pres" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#333945" />
          <stop offset="100%" stopColor="#1E222A" />
        </linearGradient>
        <linearGradient id="lr-fumee" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#E7E3D8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#E7E3D8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lr-lueur" cx="0.5" cy="1" r="0.75">
          <stop offset="0%" stopColor="#C9A24D" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#C9A24D" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* La lueur chaude de la ville, au ras des toits. */}
      <rect y={HAUTEUR * 0.45} width={LARGEUR} height={HAUTEUR * 0.55} fill="url(#lr-lueur)" />

      <RangImmeubles immeubles={FOND} premierPlan={false} />
      <RangImmeubles immeubles={PREMIER_PLAN} premierPlan />
    </svg>
  );
}

/** Une épingle de carte, qui tombe puis pulse. L'épingle couronne est réservée à l'Exclusif. */
export function Epingle({
  variante = 'standard',
  retardMs = 0,
  className,
}: {
  readonly variante?: 'standard' | 'or' | 'couronne';
  readonly retardMs?: number;
  readonly className?: string;
}) {
  const couleurs = {
    standard: { corps: '#4A4D55', bord: '#2A2D34' },
    or: { corps: '#C9A24D', bord: '#8A6A1F' },
    couronne: { corps: '#16181D', bord: '#C9A24D' },
  } as const;
  const c = couleurs[variante];

  return (
    <span
      className={cn('animation-epingle relative inline-flex', className)}
      style={{ animationDelay: `${retardMs}ms` }}
    >
      <svg viewBox="0 0 24 32" className="size-7" role="img" aria-label="Emplacement sur la carte">
        <path
          d="M12 1c6 0 11 4.7 11 10.6C23 19.4 12 31 12 31S1 19.4 1 11.6C1 5.7 6 1 12 1z"
          fill={c.corps}
          stroke={c.bord}
          strokeWidth="1.5"
        />
        {variante === 'couronne' ? (
          <path d="M7 14h10l-.8-4.6-2.4 1.8L12 7.6l-1.8 3.6-2.4-1.8z" fill="#C9A24D" />
        ) : (
          <circle cx="12" cy="11.6" r="3.4" fill="#F6F4EE" />
        )}
      </svg>
      {variante !== 'standard' && (
        /* Le halo est un disque translucide qu'on agrandit, non une ombre portée qu'on
           redessine : voir `lr-pulsation` dans la feuille de style. */
        <span
          aria-hidden="true"
          className="animation-pulsation bg-or/45 absolute bottom-1 left-1/2 size-3 -translate-x-1/2 rounded-full"
        />
      )}
    </span>
  );
}

/** Un ciel étoilé discret, à poser derrière les toits. */
export function CielEtoile({ className }: { readonly className?: string }) {
  const etoiles: readonly [number, number, number][] = [
    [84, 34, 1.1],
    [212, 22, 0.9],
    [318, 46, 1.2],
    [448, 28, 1],
    [566, 40, 0.8],
    [688, 20, 1.1],
    [794, 44, 0.9],
    [902, 30, 1.2],
    [150, 58, 0.8],
    [628, 62, 1],
    [1024, 38, 0.9],
    [1136, 26, 1.1],
  ];

  return (
    <svg
      viewBox="0 0 1200 120"
      preserveAspectRatio="xMidYMin meet"
      className={cn('block w-full', className)}
      aria-hidden="true"
    >
      {etoiles.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#E2C27A" opacity="0.45" />
      ))}
    </svg>
  );
}
