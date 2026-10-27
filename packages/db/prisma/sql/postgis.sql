-- Index géographiques PostGIS.
--
-- Prisma ne sait pas décrire une colonne `geography` : elle est ajoutée ici, calculée à partir
-- de la latitude et de la longitude, et maintenue par la base. Le code applicatif continue
-- d'écrire latitude/longitude ; PostGIS ne sert qu'à accélérer la recherche par distance.
--
-- La règle de distance elle-même vit dans packages/core, en fonction pure testée : sans PostGIS,
-- l'application fonctionne, elle est seulement plus lente sur les très grands volumes.
--
--   psql "$DATABASE_URL" -f packages/db/prisma/sql/postgis.sql

CREATE EXTENSION IF NOT EXISTS postgis;

-- Agences : c'est sur elles que porte l'éligibilité d'un pro à une demande.
ALTER TABLE agences
  ADD COLUMN IF NOT EXISTS point geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS agences_point_idx ON agences USING GIST (point);

-- Communes : pour les pages ville, les villes voisines et le rattachement d'une adresse.
ALTER TABLE communes
  ADD COLUMN IF NOT EXISTS point geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS communes_point_idx ON communes USING GIST (point);

-- Demandes : pour mesurer la distance entre l'adresse et chaque agence éligible.
ALTER TABLE demandes
  ADD COLUMN IF NOT EXISTS point geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS demandes_point_idx ON demandes USING GIST (point);

-- Une seule exclusivité active à la fois par métier et par zone. Prisma ne sait pas exprimer
-- un index partiel : cette contrainte est la garantie qu'on ne vend pas deux fois la même
-- place n° 1.
-- `now()` n'est pas immuable et ne peut pas entrer dans un prédicat d'index : la contrainte
-- porte donc sur le drapeau `active`, que le worker bascule à l'échéance.
CREATE UNIQUE INDEX IF NOT EXISTS exclusivites_active_idx
  ON exclusivites (metier_id, commune_id)
  WHERE active;

-- Une facture émise ne se modifie pas : une erreur se corrige par un avoir. Le déclencheur
-- rend la règle vraie dans la base, pas seulement dans le code.
CREATE OR REPLACE FUNCTION interdit_modification_facture_emise()
RETURNS trigger AS $$
BEGIN
  IF OLD.statut IN ('emise', 'payee') AND NEW.statut <> 'annulee_par_avoir' THEN
    IF NEW.total_ttc IS DISTINCT FROM OLD.total_ttc
       OR NEW.total_ht IS DISTINCT FROM OLD.total_ht
       OR NEW.numero IS DISTINCT FROM OLD.numero THEN
      RAISE EXCEPTION
        'Une facture émise ne peut être ni modifiée ni supprimée : corrigez-la par un avoir.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS factures_immuables ON factures;
CREATE TRIGGER factures_immuables
  BEFORE UPDATE ON factures
  FOR EACH ROW EXECUTE FUNCTION interdit_modification_facture_emise();

-- Le journal d'audit ne se corrige pas : une correction est une nouvelle ligne.
CREATE OR REPLACE RULE journal_audit_sans_modification AS
  ON UPDATE TO journal_audit DO INSTEAD NOTHING;

CREATE OR REPLACE RULE journal_audit_sans_suppression AS
  ON DELETE TO journal_audit DO INSTEAD NOTHING;
