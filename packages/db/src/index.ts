/**
 * @lerenom/db — l'accès à la base de données.
 *
 * Le client est créé une seule fois par processus. En développement, Next.js recharge les
 * modules à chaque modification : sans ce cache, chaque rechargement ouvrirait un nouveau
 * pool de connexions et la base finirait par les refuser.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './genere/client.js';

export * from './genere/client.js';

function creeClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString === '') {
    throw new Error(
      "DATABASE_URL n'est pas défini. Copiez packages/db/.env.example vers .env et renseignez-le.",
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const cache = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = cache.prisma ?? creeClient();

if (process.env['NODE_ENV'] !== 'production') {
  cache.prisma = prisma;
}

export { nettoieLesDonneesDeTest } from './nettoyage-test';
