import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Les paquets internes sont consommés en source, sans étape de construction intermédiaire :
  // il faut donc les nommer tous. Un paquet oublié ici se voit rarement en développement et
  // casse la construction en production.
  transpilePackages: [
    '@lerenom/core',
    '@lerenom/db',
    '@lerenom/distribution',
    '@lerenom/files',
    '@lerenom/liens',
    '@lerenom/securite',
    '@lerenom/ui',
  ],
  // Les routes typées sont désactivées : l'essentiel des liens du site est construit à partir
  // du catalogue et de la géographie (`/${metier.slug}`, `/${commune.slug}`), que le typage
  // statique ne peut pas connaître. Les faire passer exigerait une assertion à chaque lien,
  // ce qui supprimerait justement la garantie recherchée.
  typedRoutes: false,
};

export default config;
