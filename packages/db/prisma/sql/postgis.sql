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

-- Prisma crée ces trois colonnes comme des colonnes **ordinaires** : il sait qu'elles
-- existent — c'est ce qui l'empêche de les supprimer — mais pas qu'elles se calculent toutes
-- seules. Le bloc ci-dessous les convertit en colonnes générées, une fois, puis ne fait plus
-- rien : `is_generated` dit si le travail a déjà été fait.
--
-- La conversion passe forcément par une suppression et un ajout — PostgreSQL ne transforme
-- pas une colonne ordinaire en colonne générée. Elle est donc sans danger seulement parce que
-- la valeur est entièrement dérivée de `latitude` et `longitude` : rien n'est perdu qui ne se
-- recalcule dans la même instruction.
DO $$
DECLARE
  cible text;
BEGIN
  FOREACH cible IN ARRAY ARRAY['agences', 'communes', 'demandes'] LOOP
    IF to_regclass('public.' || cible) IS NULL THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = cible
        AND column_name = 'point' AND is_generated = 'NEVER'
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN point', cible);
    END IF;
  END LOOP;
END
$$;

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

-- Un seul relevé bancaire actif par entreprise.
--
-- C'est le compte sur lequel les clients virent l'argent : deux comptes actifs en même temps
-- et plus personne ne peut dire lequel figure sur la prochaine facture. Index partiel, pour
-- la même raison que ci-dessus — Prisma ne sait pas l'exprimer.
CREATE UNIQUE INDEX IF NOT EXISTS ribs_actif_idx
  ON ribs (entreprise_id)
  WHERE actif;

-- Une facture émise ne se modifie pas : une erreur se corrige par un avoir. Le déclencheur
-- rend la règle vraie dans la base, pas seulement dans le code.
CREATE OR REPLACE FUNCTION interdit_modification_facture_emise()
RETURNS trigger AS $$
BEGIN
  -- La suppression, d'abord. Le déclencheur ne portait que sur `UPDATE` : une facture émise
  -- ne pouvait pas être modifiée, mais rien n'empêchait de l'effacer — ce qui revient au
  -- même en pire, puisqu'il ne reste alors rien à opposer. Un garde-fou qui ferme une porte
  -- et laisse l'autre ouverte ne garde rien.
  --
  -- L'exception est la même que pour les avoirs : dans une suppression en cascade,
  -- PostgreSQL efface l'entreprise avant ses factures, donc elle est déjà absente ici. Un
  -- effacement demandé par son dirigeant, ou un nettoyage de jeu de test, passe ; la
  -- suppression d'une facture seule, non.
  IF TG_OP = 'DELETE' THEN
    IF OLD.statut IN ('emise', 'payee', 'annulee_par_avoir')
       AND EXISTS (SELECT 1 FROM entreprises WHERE id = OLD.entreprise_id) THEN
      RAISE EXCEPTION
        'Une facture émise ne peut être ni modifiée ni supprimée : corrigez-la par un avoir.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.statut IN ('emise', 'payee') THEN
    -- Les montants et le numéro d'une facture émise ne bougent plus, quoi qu'il arrive au
    -- statut. La version précédente ne vérifiait rien dès lors que la facture passait à
    -- `annulee_par_avoir` : il suffisait d'annuler et de réécrire les totaux dans la même
    -- instruction pour contourner tout le dispositif. Une porte de sortie doit être
    -- étroite, sinon elle n'est qu'un autre chemin.
    IF NEW.total_ttc IS DISTINCT FROM OLD.total_ttc
       OR NEW.total_ht IS DISTINCT FROM OLD.total_ht
       OR NEW.total_tva IS DISTINCT FROM OLD.total_tva
       OR NEW.montant_a_payer_ttc IS DISTINCT FROM OLD.montant_a_payer_ttc
       OR NEW.numero IS DISTINCT FROM OLD.numero
       OR NEW.emise_le IS DISTINCT FROM OLD.emise_le
       OR NEW.rib_id IS DISTINCT FROM OLD.rib_id THEN
      RAISE EXCEPTION
        'Une facture émise ne peut être ni modifiée ni supprimée : corrigez-la par un avoir.';
    END IF;

    -- Le statut, lui, continue de vivre : une facture émise se paie, et se fait annuler par
    -- un avoir. Elle ne redevient jamais un brouillon.
    IF NEW.statut NOT IN ('emise', 'payee', 'annulee_par_avoir') THEN
      RAISE EXCEPTION 'Une facture émise ne peut pas redevenir un brouillon.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS factures_immuables ON factures;
CREATE TRIGGER factures_immuables
  BEFORE UPDATE OR DELETE ON factures
  FOR EACH ROW EXECUTE FUNCTION interdit_modification_facture_emise();

-- Deux rendez-vous ne se chevauchent pas, et c'est la base qui le tient.
--
-- Un artisan ne peut pas être à deux endroits. Le contrôle applicatif existe, mais deux
-- requêtes simultanées peuvent le franchir toutes les deux : chacune lit un agenda libre,
-- puis chacune écrit. La contrainte d'exclusion est le seul endroit où la règle devient vraie.
--
-- `btree_gist` permet de mêler une égalité (l'entreprise) et un recouvrement d'intervalle
-- dans le même index.
--
-- `tsrange` et non `tstzrange` : les colonnes sont des horodatages **sans** fuseau, et les
-- convertir en demanderait un — celui de la session, qui peut changer d'une connexion à
-- l'autre. PostgreSQL refuse à juste titre une expression d'index qui n'est pas immuable.
--
-- Les créneaux **proposés** en sont exclus, et ce n'est pas un oubli : une proposition cesse
-- d'occuper son horaire dès qu'elle expire, or `now()` n'est pas immuable et ne peut pas
-- entrer dans un prédicat d'index. Cette règle-là vit donc dans `packages/core`, où le temps
-- se passe en paramètre. La base garantit ce qui est ferme ; le code arbitre ce qui dépend
-- de l'heure qu'il est.
--
-- Les plages **annulées** en sont exclues aussi, pour une raison différente : elles ne
-- disparaissent pas. Les effacer emporterait le rendez-vous en cascade, et un rendez-vous
-- annulé est une trace qui compte. Elles restent donc en base sans occuper leur horaire.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF to_regclass('public.creneaux') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'creneaux_sans_chevauchement'
     ) THEN
    ALTER TABLE creneaux ADD CONSTRAINT creneaux_sans_chevauchement
      EXCLUDE USING gist (
        entreprise_id WITH =,
        tsrange(debut_le, fin_le, '[)') WITH &&
      )
      WHERE (type <> 'propose' AND annule_le IS NULL);
  END IF;
END
$$;

-- Un avoir ne se modifie ni ne se supprime.
--
-- Il n'a pas de brouillon : il est définitif dès sa création. Un document de correction
-- qu'on pourrait corriger ne vaudrait pas mieux que la facture qu'il rectifie — et comme il
-- porte un numéro dans une série continue, le supprimer y ferait un trou.
CREATE OR REPLACE FUNCTION interdit_modification_avoir()
RETURNS trigger AS $$
BEGIN
  -- Supprimer un avoir **pour corriger une erreur** est interdit. Supprimer toute
  -- l'entreprise — effacement demandé par son dirigeant, nettoyage d'un jeu de test — est un
  -- autre acte, et le verrou ne doit pas le confondre avec le premier.
  --
  -- La cascade les distingue d'elle-même : PostgreSQL efface la ligne parente avant ses
  -- enfants, donc l'entreprise est déjà absente quand ce déclencheur s'exécute pour un avoir
  -- emporté par elle. Un avoir supprimé seul, lui, a toujours son entreprise en face.
  -- (Vérifié plutôt que supposé : voir le test « un avoir ne se supprime pas ».)
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM entreprises WHERE id = OLD.entreprise_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'Un avoir est définitif : il ne se modifie ni ne se supprime. Émettez-en un autre.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS avoirs_immuables ON avoirs;
CREATE TRIGGER avoirs_immuables
  BEFORE UPDATE OR DELETE ON avoirs
  FOR EACH ROW EXECUTE FUNCTION interdit_modification_avoir();

-- Le journal d'audit ne se corrige pas : une correction est une nouvelle ligne.
CREATE OR REPLACE RULE journal_audit_sans_modification AS
  ON UPDATE TO journal_audit DO INSTEAD NOTHING;

CREATE OR REPLACE RULE journal_audit_sans_suppression AS
  ON DELETE TO journal_audit DO INSTEAD NOTHING;

