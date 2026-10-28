#!/usr/bin/env bash
#
# Prépare une base de données pour Le Renom, de zéro à utilisable.
#
# À lancer une fois, contre la base que l'hébergement utilisera : elle crée l'extension
# PostGIS, pose le schéma, applique les index géographiques et les garde-fous, puis charge les
# référentiels — 1 285 communes, 18 univers, 69 métiers, 479 prestations.
#
# Usage :
#   DATABASE_URL="postgresql://utilisateur:motdepasse@hote:5432/base?sslmode=require" \
#     bash scripts/initialise-base.sh
#
# Le jeu de démonstration (7 plombiers fictifs) est chargé par le semis. Pour une vraie mise
# en production, il faudra le retirer — voir docs/QUESTIONS.md.

set -euo pipefail

bleu() { printf '\n\033[1;34m── %s\033[0m\n' "$1"; }
vert() { printf '\033[0;32m✓ %s\033[0m\n' "$1"; }

if [ -z "${DATABASE_URL:-}" ]; then
  printf '\033[0;31m✗ DATABASE_URL est absente.\033[0m\n' >&2
  printf '  Exemple : DATABASE_URL="postgresql://user:motdepasse@hote:5432/lerenom?sslmode=require"\n' >&2
  exit 1
fi

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$racine"

bleu "Extension PostGIS"
# PostGIS porte les zones d'intervention et les recherches par distance. Sans elle, le schéma
# se pose mais les index géographiques échouent.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
vert "PostGIS disponible"

bleu "Client Prisma"
pnpm --filter @lerenom/db build
vert "Client généré"

bleu "Avant-schéma"
# Ce que Prisma refuserait d'ajouter lui-même : la contrainte d'unicité par entreprise sur les
# numéros de devis et de factures. `db push` exigerait un drapeau de perte de données.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/sql/avant-schema.sql
vert "Contraintes préalables posées"

bleu "Schéma"
pnpm --filter @lerenom/db pousser
vert "Schéma posé"

bleu "Index géographiques et garde-fous"
# Index GIST, unicité partielle des exclusivités, immuabilité des factures, journal d'audit
# en écriture seule : ce que Prisma ne sait pas déclarer.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/sql/postgis.sql
vert "Index et garde-fous en place"

bleu "Référentiels et démonstration"
pnpm --filter @lerenom/db semer
vert "Données chargées"

bleu "Contrôle"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
  SELECT
    (SELECT count(*) FROM communes)    AS communes,
    (SELECT count(*) FROM univers)     AS univers,
    (SELECT count(*) FROM metiers)     AS metiers,
    (SELECT count(*) FROM prestations) AS prestations,
    (SELECT count(*) FROM parametres)  AS parametres;"

printf '\n'
vert "Base prête. 1 285 communes, 18 univers, 69 métiers, 479 prestations attendus."
