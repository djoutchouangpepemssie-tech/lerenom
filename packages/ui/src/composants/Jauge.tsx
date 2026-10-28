import { cn } from '../utilitaires';

/**
 * Une jauge qui se remplit : forfait de demandes, complétude d'une fiche, part d'affichage.
 *
 * Elle porte toujours une valeur accessible (`role="progressbar"`) : la couleur seule ne suffit
 * pas à dire « vous avez consommé 80 % de votre forfait ».
 */
export function Jauge({
  valeur,
  maximum = 1,
  etiquette,
  detail,
  aspect = 'or',
  className,
}: {
  readonly valeur: number;
  readonly maximum?: number;
  readonly etiquette: string;
  readonly detail?: string;
  readonly aspect?: 'or' | 'succes' | 'alerte' | 'erreur';
  readonly className?: string;
}) {
  const part = maximum <= 0 ? 0 : Math.min(1, Math.max(0, valeur / maximum));
  const pourcent = Math.round(part * 100);

  const couleurs = {
    or: 'bg-or',
    succes: 'bg-succes',
    alerte: 'bg-alerte',
    erreur: 'bg-erreur',
  } as const;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-encre text-sm font-semibold">{etiquette}</span>
        {detail !== undefined && <span className="text-encre-55 text-sm">{detail}</span>}
      </div>
      <div
        role="progressbar"
        aria-label={etiquette}
        aria-valuenow={pourcent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={detail ?? `${pourcent} %`}
        className="bg-encre/[0.08] h-2 overflow-hidden rounded-full"
      >
        <div
          className={cn('h-full origin-left rounded-full', couleurs[aspect])}
          style={{
            width: `${pourcent}%`,
            animation: 'lr-remplissage var(--duree-longue) var(--courbe) both',
          }}
        />
      </div>
    </div>
  );
}

/**
 * L'anneau de qualité d'une fiche : le même chiffre que la jauge, en rond, pour l'espace pro.
 * Dessiné en SVG pur, sans dépendance, et lisible par un lecteur d'écran.
 */
export function Anneau({
  valeur,
  etiquette,
  taille = 84,
}: {
  readonly valeur: number;
  readonly etiquette: string;
  readonly taille?: number;
}) {
  const part = Math.min(1, Math.max(0, valeur));
  const rayon = (taille - 10) / 2;
  const circonference = 2 * Math.PI * rayon;

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <svg
        width={taille}
        height={taille}
        viewBox={`0 0 ${taille} ${taille}`}
        role="img"
        aria-label={`${etiquette} : ${Math.round(part * 100)} %`}
      >
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={rayon}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          className="text-encre/10"
        />
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={rayon}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circonference}
          strokeDashoffset={circonference * (1 - part)}
          transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
          className="text-or transition-[stroke-dashoffset] duration-[var(--duree-longue)] ease-[var(--courbe)]"
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-encre font-[family-name:var(--font-titre)] text-lg"
        >
          {/* Espace insécable fine avant le pour-cent : c'est la règle typographique française,
              et l'aria-label voisin l'applique déjà. Les deux doivent dire la même chose. */}
          {Math.round(part * 100)}&#8239;%
        </text>
      </svg>
      <span className="text-encre-55 text-xs font-semibold">{etiquette}</span>
    </div>
  );
}
