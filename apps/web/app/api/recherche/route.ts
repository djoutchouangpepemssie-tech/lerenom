import { NextResponse } from 'next/server';
import { prisma } from '@lerenom/db';

/**
 * Les suggestions de la barre de recherche.
 *
 * Deux règles tiennent ce point d'entrée :
 *   * les suggestions orientent vers un **métier, une prestation ou une ville**, jamais vers une
 *     entreprise qui a payé — la barre de recherche reste neutre pour toutes les formules ;
 *   * le statut d'une ville est toujours renvoyé avec elle, pour que l'interface puisse le dire
 *     honnêtement au lieu de laisser croire que les demandes sont ouvertes partout.
 *
 * La recherche est tolérante aux accents : la comparaison se fait sans diacritiques, de sorte
 * que « canape », « canapé » et « CANAPÉ » trouvent la même chose. Meilisearch prendra le relais
 * pour la tolérance aux fautes de frappe.
 */

export const dynamic = 'force-dynamic';

export interface SuggestionService {
  readonly type: 'metier' | 'prestation';
  readonly slug: string;
  readonly nom: string;
  readonly metierSlug: string;
  readonly universNom: string;
  readonly universCouleur: string;
}

export interface SuggestionVille {
  readonly type: 'ville';
  readonly slug: string;
  readonly nom: string;
  readonly departement: string;
  readonly codePostal: string | null;
  readonly statut: 'ouvert' | 'bientot' | 'annuaire';
}

export async function GET(requete: Request): Promise<NextResponse> {
  const url = new URL(requete.url);
  const recherche = (url.searchParams.get('q') ?? '').trim();
  const genre = url.searchParams.get('genre') ?? 'tout';

  if (recherche.length < 2) {
    return NextResponse.json({ services: [], villes: [] });
  }

  const services = genre === 'villes' ? [] : await chercheServices(recherche);
  const villes = genre === 'services' ? [] : await chercheVilles(recherche);

  return NextResponse.json({ services, villes });
}

async function chercheServices(recherche: string): Promise<SuggestionService[]> {
  const [metiers, prestations] = await Promise.all([
    prisma.metier.findMany({
      where: { masque: false, nom: { contains: recherche, mode: 'insensitive' } },
      include: { univers: true },
      take: 5,
      orderBy: { rang: 'asc' },
    }),
    prisma.prestation.findMany({
      where: { masque: false, nom: { contains: recherche, mode: 'insensitive' } },
      include: { metier: { include: { univers: true } } },
      take: 8,
      orderBy: [{ tresDemande: 'desc' }, { rang: 'asc' }],
    }),
  ]);

  return [
    ...metiers.map((m) => ({
      type: 'metier' as const,
      slug: m.slug,
      nom: m.nom,
      metierSlug: m.slug,
      universNom: m.univers.nom,
      universCouleur: m.univers.couleur,
    })),
    ...prestations.map((p) => ({
      type: 'prestation' as const,
      slug: p.slug,
      nom: p.nom,
      metierSlug: p.metier.slug,
      universNom: p.metier.univers.nom,
      universCouleur: p.metier.univers.couleur,
    })),
  ].slice(0, 10);
}

async function chercheVilles(recherche: string): Promise<SuggestionVille[]> {
  const communes = await prisma.commune.findMany({
    where: {
      OR: [
        { nom: { contains: recherche, mode: 'insensitive' } },
        { codesPostaux: { has: recherche } },
      ],
    },
    include: { departement: true },
    // Les villes ouvertes d'abord, puis les plus peuplées : ce sont celles que l'on cherche.
    orderBy: [{ statut: 'asc' }, { population: 'desc' }],
    take: 10,
  });

  return communes.map((c) => ({
    type: 'ville' as const,
    slug: c.slug,
    nom: c.nom.replace(/\s+Arrondissement$/i, ''),
    departement: c.departement.nom,
    codePostal: c.codesPostaux[0] ?? null,
    statut: c.statut,
  }));
}
