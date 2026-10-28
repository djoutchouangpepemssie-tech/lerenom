/**
 * @lerenom/db — l'accès à la base de données.
 *
 * Deux précautions gouvernent ce fichier.
 *
 * **Le client est créé une seule fois par processus.** En développement, Next.js recharge les
 * modules à chaque modification : sans ce cache, chaque rechargement ouvrirait un nouveau pool
 * de connexions et la base finirait par les refuser.
 *
 * **Il est créé à la demande, pas à l'import.** Construire le site charge des modules qui
 * importent celui-ci sans forcément s'en servir : une création immédiate ferait échouer la
 * construction entière d'une page qui ne touche pas la base, pour une variable d'environnement
 * absente. On ne se connecte qu'au premier accès réel.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './genere/client.js';

export * from './genere/client.js';

function creeClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString === '') {
    throw new Error(
      'DATABASE_URL est absente. En local, copiez .env.exemple vers .env à la racine du dépôt ; ' +
        'en hébergement, déclarez-la dans les variables d’environnement du projet.',
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const cache = globalThis as unknown as { prismaLeRenom?: PrismaClient };

/** Le client, construit au premier accès et conservé ensuite. */
function client(): PrismaClient {
  cache.prismaLeRenom ??= creeClient();
  return cache.prismaLeRenom;
}

/**
 * Le client Prisma.
 *
 * C'est un mandataire : il se comporte exactement comme le client, mais ne le construit qu'au
 * premier accès à l'une de ses propriétés. Importer ce module ne coûte donc rien et n'exige
 * aucune variable d'environnement.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_cible, propriete) {
    const reel = client();
    const valeur: unknown = Reflect.get(reel, propriete);

    // Les méthodes doivent rester liées au client, pas au mandataire : `prisma.$connect`
    // détaché de son objet perdrait son `this`. Le typage de `bind` ne survit pas au passage
    // par `unknown`, d'où l'assertion — contenue à cette seule ligne.
    if (typeof valeur === 'function') {
      return (valeur as (...arguments_: readonly unknown[]) => unknown).bind(reel);
    }
    return valeur;
  },
  has(_cible, propriete) {
    return Reflect.has(client(), propriete);
  },
});

export { nettoieLesDonneesDeTest } from './nettoyage-test';
