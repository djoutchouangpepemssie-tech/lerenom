import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Le design system est consommé en source : pas d'étape de build intermédiaire.
  transpilePackages: ['@lerenom/ui', '@lerenom/core', '@lerenom/db'],
  // Les routes typées sont désactivées : l'essentiel des liens du site est construit à partir
  // du catalogue et de la géographie (`/${metier.slug}`, `/${commune.slug}`), que le typage
  // statique ne peut pas connaître. Les faire passer exigerait une assertion à chaque lien,
  // ce qui supprimerait justement la garantie recherchée.
  typedRoutes: false,
};

export default config;
