import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Le design system est consommé en source : pas d'étape de build intermédiaire.
  transpilePackages: ['@lerenom/ui', '@lerenom/core'],
  // Les routes sont typées : un lien vers une page qui n'existe pas ne compile pas.
  typedRoutes: true,
};

export default config;
