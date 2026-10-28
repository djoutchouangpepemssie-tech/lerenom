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

# Les secrets, une fois pour toutes les étapes.
#
# Plusieurs d'entre elles en ont besoin : le worker refuse de démarrer sans, et les tests qui
# tirent un code de vérification aussi — à juste titre, un service à moitié configuré est pire
# qu'un service qui refuse de partir. Mais cette porte vérifie que le **code** tient, pas que
# la machine du développeur détient les secrets de production. On en fabrique un éphémère.
#
# Il est exporté une fois, en haut : chaque étape qui le fabriquerait pour elle-même en aurait
# un différent, et deux étapes qui ne s'accordent pas sur un secret ne s'accordent sur rien.
export SECRET_VERIFICATION="${SECRET_VERIFICATION:-$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')}"

etape "Formatage" pnpm run format:verifie
etape "Lint" pnpm run lint
etape "Types" pnpm run typecheck
etape "Tests" pnpm run test
etape "Build" pnpm run build

# Le worker n'a pas de test propre — c'est du câblage — donc rien ne vérifiait qu'il
# **démarre**. Il ne démarrait pas : Node exige des extensions explicites là où Vitest n'en
# demande pas, et l'erreur n'apparaissait qu'en production. On le lance pour de bon.
bleu "Démarrage du worker"
if [ -z "${REDIS_URL:-}" ] && ! redis-cli ping > /dev/null 2>&1; then
  printf '\033[0;33m! Redis injoignable : démarrage du worker non vérifié.\033[0m\n'
else
  # Le worker ne s'arrête pas tout seul : on le laisse démarrer, puis on l'interrompt et on
  # lit ce qu'il a écrit. Chaîner `timeout` à un `grep` masquerait le résultat derrière le
  # code de sortie de `timeout`.
  journal="$(mktemp)"
  timeout 20 pnpm --filter @lerenom/worker start > "$journal" 2>&1 || true
  if grep -q 'en écoute' "$journal"; then
    vert "Démarrage du worker"
  else
    rouge "Démarrage du worker"
    sed -n '1,15p' "$journal"
    echec=1
  fi
  rm -f "$journal"
fi

# Les tests d'intégration ont besoin d'une base et de Redis. Leur absence n'est pas un échec :
# c'est une couverture moindre, et le script le dit au lieu de faire croire au contraire.
if [ -z "${DATABASE_URL:-}" ]; then
  printf '\n\033[0;33m! DATABASE_URL absente : tests d’intégration non exécutés.\033[0m\n'
elif ! pg_isready -q 2>/dev/null; then
  printf '\n\033[0;33m! Base injoignable : tests d’intégration non exécutés.\033[0m\n'
else
  # Avant le schéma : ce que Prisma refuserait d'ajouter lui-même. `db push` demande un
  # drapeau de perte de données pour poser une contrainte d'unicité sur une table déjà
  # peuplée — drapeau qui autoriserait aussi des suppressions non voulues. On pose donc la
  # contrainte en SQL, avec le nom que Prisma attend, et `db push` ne voit plus de différence.
  etape "Avant-schéma" pnpm --filter @lerenom/db sql:avant
  etape "Schéma" pnpm --filter @lerenom/db pousser
  # Les garde-fous SQL — immuabilité des factures émises, unicité des exclusivités actives,
  # journal d'audit en écriture seule — ne sont pas exprimables en Prisma. Ils n'étaient
  # appliqués qu'au déploiement : localement, aucun test ne pouvait les éprouver, et un
  # garde-fou que personne n'exerce est un garde-fou dont personne ne sait s'il tient.
  etape "Garde-fous SQL" pnpm --filter @lerenom/db sql
  etape "Semis" pnpm --filter @lerenom/db semer
fi

printf '\n'
if [ "$echec" -eq 0 ]; then
  vert "Porte de validation franchie."
else
  rouge "Porte de validation refusée."
  exit 1
fi
