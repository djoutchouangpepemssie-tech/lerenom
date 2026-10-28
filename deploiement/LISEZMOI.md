# Configuration de déploiement Railway

Deux services applicatifs partagent le même dépôt, et n'en font pas la même chose : le site
sert des pages, le worker fait tourner la cascade. Leur configuration ne peut donc pas vivre
dans un seul `railway.json` à la racine — Railway le lirait pour les deux.

Chaque service pointe vers son fichier ici, par son réglage **Config-as-code path** :

| Service  | Fichier                           | Rôle                                                                                                                      |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `web`    | `deploiement/railway-web.json`    | Le site, Next.js. Construit tout le monorepo, puis sert.                                                                  |
| `worker` | `deploiement/railway-worker.json` | La cascade, les minuteurs, les travaux de nuit. Ne construit que le client Prisma : il exécute le TypeScript directement. |

## Pourquoi le worker ne peut pas vivre sur Vercel

C'est la raison pour laquelle le projet est hébergé ici. Vercel n'exécute que des fonctions
éphémères, déclenchées par une requête et arrêtées aussitôt après. Le worker, lui, est un
processus qui ne s'arrête pas : il tient des files BullMQ, attend des échéances à la seconde,
et exécute des travaux de nuit. Sans lui, une demande déposée n'est jamais distribuée.

## Le port

Le site démarre sur `${PORT:-3000}`. Railway attribue un port par déploiement et l'injecte
dans `PORT` ; un port écrit en dur le ferait ignorer, et le service resterait injoignable
derrière son domaine — une panne d'autant plus déroutante que les journaux diraient que tout
va bien.

## Le réseau privé et la construction

Le réseau privé de Railway n'existe **qu'à l'exécution**, jamais pendant la construction. Or
les pages publiques sont pré-rendues et lisent la base. La construction a donc besoin d'une URL
joignable depuis l'extérieur : c'est le mandataire TCP de la base, et c'est pourquoi la base
doit avoir **SSL activé** — sans quoi les identifiants et les données des clients
transiteraient en clair sur Internet.

Voir `docs/DEPLOIEMENT.md` pour les variables à déclarer.
