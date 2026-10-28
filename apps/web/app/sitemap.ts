import type { MetadataRoute } from 'next';
import { prisma } from '@lerenom/db';
import { baseDuSite, siteIndexable } from '@/lib/site';

/**
 * Le plan du site.
 *
 * Il est construit à partir de la base, jamais écrit à la main : Le Renom existe par ses
 * pages métier × ville, et une liste figée vieillirait dès la première ville ouverte.
 *
 * Deux choix méritent d'être dits.
 *
 * **Les croisements métier × ville ne sont listés que pour les villes ouvertes.** Le produit
 * cartésien complet ferait 1 285 villes × 69 métiers, soit près de 89 000 adresses — au-delà
 * de la limite d'un fichier unique, et surtout sans intérêt : une page de ville d'annuaire,
 * sans professionnel référencé, n'a rien à proposer au visiteur qui l'atteindrait depuis un
 * moteur. Les villes elles-mêmes y figurent toutes, parce qu'une page de ville existe et dit
 * quelque chose d'utile même sans croisement.
 *
 * **La priorité et la fréquence sont posées avec parcimonie.** Les moteurs les ignorent
 * largement ; les renseigner finement donnerait l'illusion d'un réglage qui n'existe pas.
 */

/**
 * Rendu à l'exécution, comme tout ce qui lit la base.
 *
 * Pré-rendu, ce plan interrogerait la base pendant la construction — où le réseau privé de
 * l'hébergeur n'existe pas encore. Le piège était discret : sans `LERENOM_ENV`, la fonction
 * sort avant toute requête et la construction passe ; avec elle, c'est-à-dire en production,
 * elle échoue. Un défaut qui ne se montre que là où il coûte le plus cher.
 *
 * Le coût du rendu à chaque appel est négligeable : un plan de site est demandé quelques fois
 * par jour, pas à chaque visite.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseDuSite();

  // Une préproduction ne publie pas de plan : elle n'a rien à faire indexer.
  if (!siteIndexable()) return [];

  const [metiers, communes, departements, entreprises] = await Promise.all([
    prisma.metier.findMany({
      where: { masque: false },
      select: { slug: true, modifieLe: true },
      orderBy: { slug: 'asc' },
    }),
    prisma.commune.findMany({
      select: { slug: true, statut: true, modifieLe: true },
      orderBy: { slug: 'asc' },
    }),
    prisma.departement.findMany({ select: { slug: true }, orderBy: { code: 'asc' } }),
    prisma.entreprise.findMany({
      where: { retireeLe: null, suspendue: false },
      select: { slug: true, modifieLe: true },
      orderBy: { slug: 'asc' },
    }),
  ]);

  const pagesFixes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/services`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/ile-de-france`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/guide-des-prix`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/demande`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/pro`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/pro/inscription`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/comment-ca-marche`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/comment-nous-classons`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/charte-avis`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/cgu`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/cgv-pro`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/cookies`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/signaler`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const pagesMetier: MetadataRoute.Sitemap = metiers.map((metier) => ({
    url: `${base}/${metier.slug}`,
    lastModified: metier.modifieLe,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const pagesDepartement: MetadataRoute.Sitemap = departements.map((departement) => ({
    url: `${base}/${departement.slug}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const pagesVille: MetadataRoute.Sitemap = communes.map((commune) => ({
    url: `${base}/${commune.slug}`,
    lastModified: commune.modifieLe,
    changeFrequency: 'weekly',
    // Une ville ouverte reçoit des demandes ; une ville d'annuaire se contente d'exister.
    priority: commune.statut === 'ouvert' ? 0.7 : 0.4,
  }));

  const villesOuvertes = communes.filter((commune) => commune.statut === 'ouvert');
  const pagesCroisees: MetadataRoute.Sitemap = villesOuvertes.flatMap((commune) =>
    metiers.map((metier) => ({
      url: `${base}/${metier.slug}/${commune.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
  );

  const pagesEntreprise: MetadataRoute.Sitemap = entreprises.map((entreprise) => ({
    url: `${base}/entreprise/${entreprise.slug}`,
    lastModified: entreprise.modifieLe,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [
    ...pagesFixes,
    ...pagesMetier,
    ...pagesCroisees,
    ...pagesVille,
    ...pagesDepartement,
    ...pagesEntreprise,
  ];
}
