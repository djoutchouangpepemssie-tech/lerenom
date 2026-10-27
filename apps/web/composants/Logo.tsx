import { cn } from '@lerenom/ui';

/** Le logo : un nom en serif, et le point or qui le signe. */
export function Logo({
  clair = false,
  className,
}: {
  readonly clair?: boolean;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        'font-[family-name:var(--font-titre)] text-[1.4rem] leading-none tracking-tight',
        clair ? 'text-creme' : 'text-encre',
        className,
      )}
    >
      Le Renom<span className="text-or">.</span>
    </span>
  );
}
