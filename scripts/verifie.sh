#!/usr/bin/env bash
#
# La porte de validation, en une commande.
#
# Elle fait exactement ce que fait l'intégration continue, dans le même ordre : formatage,
# lint, types, tests unitaires, build, puis — si une base est joignable — le schéma, le semis
# et les tests d'intégration.
#
# Pourquoi ce script existe : l'intégration continue de ce dépôt n'a jamais pu s'exécuter
# (voir docs/JOURNAL.md, « L'intégration continue n'a jamais tourné »). Tant que GitHub ne
# lance pas les travaux, la seule porte de validation réelle est locale — et elle doit être
# reproductible, sinon « ça marche chez moi » devient la seule garantie du projet.
#
# Usage : pnpm run verifie

set -euo pipefail

bleu() { printf '\n\033[1;34m── %s\033[0m\n' "$1"; }
vert() { printf '\033[0;32m✓ %s\033[0m\n' "$1"; }
rouge() { printf '\033[0;31m✗ %s\033[0m\n' "$1"; }

echec=0
etape() {
  local titre="$1"
  shift
  bleu "$titre"
  if "$@"; then
    vert "$titre"
  else
    rouge "$titre"
    echec=1
  fi
}

etape "Formatage" pnpm run format:verifie
etape "Lint" pnpm run lint
etape "Types" pnpm run typecheck
etape "Tests" pnpm run test
etape "Build" pnpm run build

# Les tests d'intégration ont besoin d'une base et de Redis. Leur absence n'est pas un échec :
# c'est une couverture moindre, et le script le dit au lieu de faire croire au contraire.
if [ -z "${DATABASE_URL:-}" ]; then
  printf '\n\033[0;33m! DATABASE_URL absente : tests d’intégration non exécutés.\033[0m\n'
elif ! pg_isready -q 2>/dev/null; then
  printf '\n\033[0;33m! Base injoignable : tests d’intégration non exécutés.\033[0m\n'
else
  etape "Schéma" pnpm --filter @lerenom/db pousser
  etape "Semis" pnpm --filter @lerenom/db semer
fi

printf '\n'
if [ "$echec" -eq 0 ]; then
  vert "Porte de validation franchie."
else
  rouge "Porte de validation refusée."
  exit 1
fi
