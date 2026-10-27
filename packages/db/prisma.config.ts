import 'node:process';
import { defineConfig } from 'prisma/config';

/**
 * Configuration Prisma.
 *
 * Depuis Prisma 7, l'URL de connexion ne vit plus dans le schéma : elle est lue ici, depuis
 * l'environnement. Aucun secret n'est écrit dans le dépôt.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/lerenom',
  },
});
