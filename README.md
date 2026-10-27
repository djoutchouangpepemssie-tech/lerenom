# Le Renom

Plateforme française de référencement universel : toute entreprise peut y être référencée, quel
que soit son métier. Deux publics — ceux qui cherchent un professionnel (gratuit, sans compte) et
les entreprises qui veulent être trouvées (fiche gratuite, puis formules payantes) — et un
back-office qui pilote la distribution des demandes, les emplacements, la modération et les
finances.

Zone de lancement : l'Île-de-France, 8 départements, 1 285 villes et arrondissements.

## Documents

| Document                                 | Contenu                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| [`docs/PLAN.md`](docs/PLAN.md)           | Compréhension du projet, architecture et sa justification, découpage en phases, risques |
| [`docs/QUESTIONS.md`](docs/QUESTIONS.md) | Les questions ouvertes, chacune avec le choix par défaut appliqué                       |
| [`docs/JOURNAL.md`](docs/JOURNAL.md)     | Journal de bord, une entrée par phase                                                   |
| [`docs/captures/`](docs/captures)        | Les captures de chaque écran, à 390 px et 1440 px                                       |

## Organisation

```
apps/web/        Next.js : site public, espace pro et back-office, par sous-domaines
apps/worker/     Node + BullMQ : cascade de distribution, minuteurs, notifications, imports
packages/core/   Les règles métier, en fonctions pures et testées
packages/ui/     Le design system : jetons, composants, illustrations, animations
packages/db/     Schéma Prisma, migrations, données de démonstration
packages/emails/ Modèles d'e-mails et de SMS
data/            Scripts Python : SIRENE, Base Adresse Nationale, NAF 2025, baromètres
donnees/         Catalogue, communes d'Île-de-France, prix indicatifs
```

**La règle d'architecture qui compte le plus** : toute règle métier vit dans `packages/core`, en
fonction pure, et nulle part ailleurs. Les applications orchestrent — lire, appeler la règle,
écrire, journaliser — elles ne décident pas. Aucun prix, aucun délai, aucun seuil n'est écrit en
dur : tout vient de paramètres historisés, modifiables depuis le back-office.

## Démarrer

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## Vérifier

```bash
pnpm lint           # ESLint typé
pnpm typecheck      # TypeScript
pnpm test           # tests unitaires
pnpm test:couverture # tests + seuil de couverture (90 %)
pnpm build          # build de production
```

## Captures

Aucun écran n'est déclaré fini sans avoir été regardé. Le script de capture photographie chaque
page à **390 px** et **1440 px**, et vérifie à chaque largeur qu'aucune page ne déborde
horizontalement et qu'aucun élément ne sort du cadre.

```bash
pnpm --filter @lerenom/web build
pnpm --filter @lerenom/web exec next start --port 3100 &
pnpm captures
```

Les captures sont écrites dans `docs/captures/`, avec un `rapport.json` qui liste, pour chaque
page et chaque largeur, les débordements et les erreurs de console relevés.

## Outillage

Node 22 · pnpm 10 · TypeScript 6 · Next.js 16 · React 19 · Tailwind CSS 4 · Vitest 5 ·
Playwright · PostgreSQL 16 + PostGIS · Redis · Python 3.13

TypeScript est épinglé en 6.x et non 7.x : `typescript-eslint` déclare `typescript <6.1.0`, et le
lint typé vaut mieux que la dernière version du compilateur.
