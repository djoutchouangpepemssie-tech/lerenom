#!/usr/bin/env bash
#
# Relance PostgreSQL et Redis après un redémarrage de la machine de développement.
#
# Pourquoi ce script existe : le conteneur de développement a redémarré en cours de session,
# et retrouver *comment* relancer les services a pris plus de temps que le travail qu'ils
# bloquaient. Deux pièges s'y cachaient, et ils sont notés ici plutôt que redécouverts.
#
# **Il y a deux instances PostgreSQL sur cette machine.** Celle de Debian
# (`/var/lib/postgresql/16/main`, lancée par `service postgresql start`) est vide et exige un
# mot de passe ; celle du projet (`/var/lib/postgresql/data`) porte les données et accepte les
# connexions locales sans mot de passe. Démarrer la première occupe le port 5432 et fait
# échouer la seconde avec un message qui ne dit pas pourquoi.
#
# **Le journal doit être écrit là où `postgres` peut écrire.** Le pointer vers un répertoire
# appartenant à `root` fait échouer le démarrage avec « could not start server », sans plus
# d'explication — l'erreur réelle n'arrive jamais dans le fichier qu'on n'a pas pu créer.
#
# Usage : bash scripts/services.sh

set -euo pipefail

DONNEES=/var/lib/postgresql/data
BINAIRES=/usr/lib/postgresql/16/bin

bleu() { printf '\n\033[1;34m── %s\033[0m\n' "$1"; }
vert() { printf '\033[0;32m✓ %s\033[0m\n' "$1"; }

bleu "PostgreSQL"
# L'instance Debian d'abord : si elle tourne, elle tient le port et celle du projet ne
# démarrera pas.
service postgresql stop > /dev/null 2>&1 || true

if su postgres -c "$BINAIRES/pg_ctl -D $DONNEES status" > /dev/null 2>&1; then
  vert "déjà démarré"
else
  su postgres -c "$BINAIRES/pg_ctl -D $DONNEES -l $DONNEES/serveur.log -o '-p 5432' start"
  vert "démarré"
fi

bleu "Redis"
if redis-cli ping > /dev/null 2>&1; then
  vert "déjà démarré"
else
  # `ulimit` échoue sans privilèges dans ce conteneur ; le service démarre quand même, et
  # c'est pourquoi l'erreur est ignorée ici au lieu d'arrêter le script.
  service redis-server start 2>&1 | grep -v 'ulimit' || true
  vert "démarré"
fi

bleu "Contrôle"
psql "postgresql://postgres@127.0.0.1:5432/lerenom" -tAc \
  "SELECT 'communes : ' || count(*) FROM communes"
printf 'redis : %s\n' "$(redis-cli ping)"

cat <<'FIN'

Les variables attendues par les commandes du dépôt :

  export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/lerenom"
  export REDIS_URL="redis://127.0.0.1:6379"
  export SECRET_VERIFICATION="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

`pnpm run verifie` fabrique lui-même le secret s'il est absent ; les jetons de démonstration,
non : ils sont signés, et doivent l'être avec le secret du serveur qu'on photographie.
FIN
