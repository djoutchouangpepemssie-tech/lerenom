-- Ce qui doit exister **avant** que Prisma ne compare le schéma à la base.
--
-- `prisma db push` refuse d'ajouter une contrainte d'unicité à une table existante sans un
-- drapeau de perte de données — drapeau qui ouvrirait aussi la porte à des suppressions non
-- voulues, et qu'on ne veut pas dans une commande de déploiement. Les contraintes sont donc
-- posées ici, avec exactement les noms que Prisma attend : une fois en place, `db push` ne
-- voit plus de différence et s'exécute sans avertissement.
--
-- Chaque instruction est gardée par `to_regclass` : sur une base vierge, les tables n'existent
-- pas encore, `db push` les créera avec leurs contraintes, et ce fichier n'aura rien à faire.
--
--   psql "$DATABASE_URL" -f packages/db/prisma/sql/avant-schema.sql

-- PostGIS, avant tout le reste.
--
-- Le schéma Prisma déclare trois colonnes `geography(Point, 4326)` — les points des agences,
-- des communes et des demandes. Le type n'existe pas sans l'extension : sur une base vierge,
-- `db push` échouerait avant d'avoir rien créé.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Numérotation : une série par entreprise, pas une série pour toute la plateforme.
--
-- Le défaut corrigé n'était pas théorique : le numéro était unique **globalement**, alors que
-- chaque société repart à 0001 chaque année. Le deuxième artisan à envoyer un devis aurait vu
-- sa requête refusée, en production, sans explication utilisable.
DO $$
BEGIN
  IF to_regclass('public.devis') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS devis_entreprise_id_numero_key
      ON devis (entreprise_id, numero);
  END IF;

  IF to_regclass('public.factures') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS factures_entreprise_id_numero_key
      ON factures (entreprise_id, numero);
  END IF;

  -- Les avoirs reçoivent aussi une colonne `entreprise_id` : la série des numéros d'avoir
  -- appartient à la société, pas à la plateforme. La table est vide à ce stade du projet,
  -- donc la colonne peut être posée obligatoire sans valeur de repli.
  IF to_regclass('public.avoirs') IS NOT NULL THEN
    ALTER TABLE avoirs ADD COLUMN IF NOT EXISTS entreprise_id text;
    CREATE UNIQUE INDEX IF NOT EXISTS avoirs_entreprise_id_numero_key
      ON avoirs (entreprise_id, numero);
  END IF;
END
$$;
