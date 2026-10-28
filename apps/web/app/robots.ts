import type { MetadataRoute } from 'next';
import { baseDuSite, siteIndexable } from '@/lib/site';

/**
 * Ce que les moteurs ont le droit de parcourir.
 *
 * Un refus mérite d'être expliqué, parce qu'il ne relève pas du référencement mais de la
 * confidentialité : **`/suivi/` porte un jeton secret dans son adresse**. C'est ce jeton qui
 * donne accès au suivi d'une demande, à ses coordonnées et au dépôt d'un avis, sans compte à
 * créer. Une adresse de suivi indexée serait une fuite de données personnelles — et le robots
 * n'y suffirait pas seul : les pages concernées portent aussi `noindex`, puisqu'un fichier
 * robots n'est qu'une convention que rien n'oblige à respecter.
 *
 * `/pro/espace/` et `/api/` sont refusés pour une raison plus ordinaire : il n'y a rien à y
 * voir sans session, et les faire parcourir ne produirait que des redirections.
 *
 * Le fichier est rendu à l'exécution, comme le plan du site. Pré-rendu, il fige l'adresse
 * connue au moment de la construction — où `LERENOM_URL` n'est pas encore là. Il a bel et bien
 * annoncé `Host: http://localhost:3000` avant que cette ligne n'existe : un robots.txt qui
 * renvoie les moteurs vers une machine de développement.
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = baseDuSite();

  // Une préproduction indexée vole son référencement à la production : tant que l'environnement
  // n'est pas la production, tout est refusé.
  if (!siteIndexable()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/suivi/', '/pro/espace/', '/api/', '/design'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
