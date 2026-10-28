# Déploiement Railway

Le projet tourne sur Railway, en quatre services. Ce document dit comment ils sont configurés
et pourquoi, de façon qu'un déploiement reproductible ne dépende pas d'un souvenir.

| Service    | Source                   | Rôle                                                                  |
| ---------- | ------------------------ | --------------------------------------------------------------------- |
| `postgres` | `postgis/postgis:16-3.4` | PostgreSQL 16 + PostGIS 3.4, la même image que l'intégration continue |
| `redis`    | `redis:7-alpine`         | Files BullMQ : cascade, minuteurs, travaux de nuit                    |
| `web`      | ce dépôt                 | Le site, Next.js                                                      |
| `worker`   | ce dépôt                 | La cascade, les minuteurs, les travaux de nuit                        |

## Pourquoi le worker ne peut pas vivre sur Vercel

C'est la raison qui a décidé de l'hébergement. Vercel n'exécute que des fonctions éphémères,
déclenchées par une requête et arrêtées aussitôt après. Le worker, lui, est un processus qui
ne s'arrête pas : il tient des files, attend des échéances à la seconde, exécute des travaux
de nuit. Sans lui, **une demande déposée n'est jamais distribuée** — le site fonctionnerait et
ne servirait à rien.

## Les commandes de chaque service

| Service  | Construction                      | Démarrage                             |
| -------- | --------------------------------- | ------------------------------------- |
| `web`    | `pnpm run build`                  | `pnpm --filter @lerenom/web start`    |
| `worker` | `pnpm --filter @lerenom/db build` | `pnpm --filter @lerenom/worker start` |

Le worker ne construit que le client Prisma : il exécute le TypeScript directement, sans étape
de compilation.

Le site démarre sur `${PORT:-3000}`. Railway attribue un port par déploiement et l'injecte
dans `PORT` ; un port écrit en dur le ferait ignorer, et le service resterait injoignable
derrière son domaine — une panne d'autant plus déroutante que les journaux diraient que tout
va bien.

## Le réseau privé n'existe qu'à l'exécution

C'est le point qui structure toute la configuration : **le réseau privé de Railway n'est pas
joignable pendant la construction.** Or les pages publiques sont pré-rendues et lisent la base.

Deux conséquences :

1. La construction du site utilise l'URL **publique** de la base, par le mandataire TCP. C'est
   pourquoi PostgreSQL démarre avec **SSL activé** — sans quoi les identifiants et les
   coordonnées des clients transiteraient en clair sur Internet.
2. Le worker, lui, n'a pas d'étape de pré-rendu : il utilise l'URL **privée**, qui ne sort
   jamais du réseau de Railway.

PostgreSQL est démarré avec une commande explicite plutôt qu'avec `POSTGRES_INITDB_ARGS` :
cette variable n'agit qu'à l'initialisation du cluster, donc elle serait sans effet sur une
base déjà créée. SSL est un réglage du serveur, qui se pose au démarrage :

```
postgres -c ssl=on \
  -c ssl_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem \
  -c ssl_key_file=/etc/ssl/private/ssl-cert-snakeoil.key
```

## L'initialisation de la base

Elle se fait en **pré-déploiement** du service `web`, parce que c'est le seul endroit qui
tourne à l'exécution — donc sur le réseau privé — avant que le site ne serve une requête :

```
pnpm --filter @lerenom/db pousser && \
pnpm --filter @lerenom/db sql && \
pnpm --filter @lerenom/db semer
```

Les trois commandes sont **rejouables** : `pousser` aligne le schéma, `sql` pose des
garde-fous en `IF NOT EXISTS` ou `OR REPLACE`, et le semis se contente de vérifier les
comptes attendus quand tout est déjà là. Un déploiement ordinaire ne coûte donc que quelques
secondes de contrôle. `FORCE_SEMIS=1` force la réécriture, après un changement du jeu de
données.

`sql` passe par le pilote PostgreSQL et non par `psql`, qui n'existe pas dans les images
d'exécution.

## Les variables

Voir `docs/DEPLOIEMENT.md`. Les secrets ne sont pas dans ce dépôt : ils vivent dans les
variables du projet Railway.

## Configuration as code

Railway a déprécié `railway.json` et `railway.toml` (lecture arrêtée au 1er décembre 2026) au
profit de l'infrastructure as code (`.railway/railway.ts`), appliquée par la CLI Railway et
non lue au déploiement. La configuration actuelle est donc posée sur les services eux-mêmes ;
la basculer vers `.railway/railway.ts` demande la CLI authentifiée, ce qui se fait depuis un
poste et non depuis ce dépôt.
