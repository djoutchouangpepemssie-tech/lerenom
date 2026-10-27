import Link from 'next/link';

export interface ElementFilAriane {
  readonly libelle: string;
  readonly href?: string;
}

/**
 * Le fil d'Ariane. Il porte aussi les données structurées `BreadcrumbList`, en balise
 * invisible : le référencement se gère en coulisses, jamais en contenu visible.
 */
export function FilAriane({
  elements,
  clair = false,
}: {
  readonly elements: readonly ElementFilAriane[];
  /** Sur un en-tête sombre : sans cela, la page courante s'écrit en encre sur fond nuit. */
  readonly clair?: boolean;
}) {
  const donneesStructurees = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: elements.map((element, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: element.libelle,
      ...(element.href !== undefined ? { item: `https://lerenom.fr${element.href}` } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Fil d’Ariane">
        <ol
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${
            clair ? 'text-creme/60' : 'text-encre-55'
          }`}
        >
          {elements.map((element, index) => (
            <li key={element.libelle} className="flex items-center gap-2">
              {index > 0 && (
                <span aria-hidden="true" className={clair ? 'text-creme/35' : 'text-encre-40'}>
                  ›
                </span>
              )}
              {element.href !== undefined ? (
                <Link
                  href={element.href}
                  className={`transition-colors ${clair ? 'hover:text-or-clair' : 'hover:text-or-fonce'}`}
                >
                  {element.libelle}
                </Link>
              ) : (
                <span
                  className={`font-semibold ${clair ? 'text-creme' : 'text-encre'}`}
                  aria-current="page"
                >
                  {element.libelle}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />
    </>
  );
}
