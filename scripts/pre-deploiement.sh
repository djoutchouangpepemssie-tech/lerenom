#!/usr/bin/env bash
#
# Ce que la base doit recevoir avant que la nouvelle version ne serve des requêtes.
#
# Cette commande s'exécute sur le réseau privé de l'hébergeur, après la construction et avant
# le démarrage — le seul moment où la base est joignable et où la version déployée n'a pas
# encore de trafic. Elle vivait dans une case du tableau de bord : un ordre d'exécution
# invisible dans le dépôt, que rien ne versionne et que personne ne relit. Elle vit ici.
#
# L'ordre compte, et chacune des quatre étapes a une raison d'être à sa place :
#
#   1. **avant-schema.sql** — ce que Prisma refuserait d'ajouter lui-même. Poser une contrainte
#      d'unicité sur une table déjà peuplée lui fait exiger un drapeau de perte de données,
#      drapeau qui autoriserait aussi la suppression de colonnes. On ne met pas ça dans une
#      commande de déploiement. La contrainte est donc posée en SQL, sous le nom exact que
#      Prisma attend : il ne voit ensuite plus de différence. Sur une base vierge, les tables
#      n'existent pas encore et le fichier ne fait rien.
#   2. **le schéma** — tables, colonnes, index déclarés.
#   3. **postgis.sql** — les garde-fous que Prisma ne sait pas déclarer : immuabilité des
#      factures émises, unicité partielle des exclusivités actives, journal d'audit en
#      écriture seule, index géographiques.
#   4. **le semis** — référentiels (communes, univers, métiers, prestations) et démonstration.
#
# Les quatre fichiers SQL sont rejouables : `IF NOT EXISTS`, `OR REPLACE`, gardes `to_regclass`.
# Le semis l'est aussi. Un déploiement qui échoue à mi-chemin se reprend donc sans dégât.

set -euo pipefail

bleu() { printf '\n\033[1;34m── %s\033[0m\n' "$1"; }

bleu "Contraintes préalables au schéma"
pnpm --filter @lerenom/db sql:avant

bleu "Schéma"
pnpm --filter @lerenom/db pousser

bleu "Garde-fous SQL"
pnpm --filter @lerenom/db sql

bleu "Référentiels et démonstration"
pnpm --filter @lerenom/db semer

printf '\n\033[0;32m✓ Base prête.\033[0m\n'
