# Journal de bord

Une entrée par phase. Ce qui est fait, ce qui reste, les décisions prises, les captures produites.

---

## Phase 0 — Cadrage · 27 octobre 2026

### Fait

- Lecture intégrale du cahier des charges (22 sections) et de l'étude de faisabilité
  (1 008 lignes). Les deux versions de l'étude transmises ont été comparées : celle retenue est
  la version à jour du 27 octobre 2026, qui porte les prix validés (Premium 79 €, Exclusif 229 €)
  et non les prix antérieurs (119 € / 349 €).
- `docs/PLAN.md` : compréhension du projet, architecture retenue et sa justification,
  organisation du dépôt, découpage en 11 phases avec portes de validation, méthode écran par
  écran, invariants validés, risques techniques et parades.
- `docs/QUESTIONS.md` : 14 questions ouvertes, chacune avec son choix par défaut appliqué
  immédiatement. Quatre sont marquées bloquantes avant l'ouverture des paiements.

### Décisions prises

1. **Les règles métier vivent toutes dans `packages/core`**, en fonctions pures sans dépendance
   framework. Les applications orchestrent, elles ne décident pas. C'est la condition pour tenir
   90 % de couverture sur des règles de cette densité.
2. **Aucun prix, aucun délai, aucun seuil écrit en dur.** Les valeurs validées du 27 octobre 2026
   sont les valeurs par défaut d'une table `parametres` historisée, pas des constantes du code.
3. **L'étude de faisabilité ne prime jamais sur le cahier des charges.** Trois divergences
   relevées et tranchées en faveur du cahier des charges : périmètre de l'exclusivité
   (commune/arrondissement et non quartier, Q3), absence d'espace client (Q11), nombre de pages
   du back-office (Q12).
4. **Les fichiers de données annoncés sont absents** du dépôt reçu. Ils sont reconstruits : les
   communes depuis la source officielle `@etalab/decoupage-administratif`, le catalogue et les
   prix depuis le cahier des charges et l'étude, marqués `aValider` (Q1).

### Environnement vérifié

Node 22.22 · pnpm 10.28 · Python 3.13.17 · PostgreSQL 16.15 **avec PostGIS 3.4 installé** ·
Redis · Docker · Playwright et Chromium pré-installés. Toute la stack validée tourne en local,
y compris la recherche géographique.

### Socle livré

- **Monorepo** Turborepo + pnpm, TypeScript strict (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), ESLint typé, Prettier.
- **`packages/core`** : les règles métier en fonctions pures, **228 tests**, couverture de
  98,4 % des instructions, 94,1 % des branches, 100 % des fonctions — au-dessus de la porte
  de 90 %.
- **`packages/ui`** : jetons de couleur, de typographie, d'espacement et de durée exposés à
  Tailwind 4 par `@theme` ; polices DM Serif Display et Manrope auto-hébergées par `next/font` ;
  animations (apparition échelonnée, flottement, chute et pulsation d'épingle, reflet or,
  bandeau défilant, compteurs, remplissage de jauge, fenêtres qui s'allument, fumée des
  cheminées), toutes coupées sous `prefers-reduced-motion` ; composants Bouton, Badge, Carte,
  Champ, Puce, Onglets, Jauge, Anneau, Minuteur, Compteur, Bandeau, Note, Modale, Tiroir,
  Barre collante.
- **Illustration originale** des toits de Paris, dessinée en SVG immeuble par immeuble —
  mansardes en zinc, mitres de terre cuite, lucarnes, fenêtres qui s'allument chacune à son
  rythme. Aucune photo de stock, quelques kilo-octets.
- **`apps/web`** : Next.js 16, App Router, page de démonstration du design system.
- **CI GitHub Actions** : formatage, lint, types, tests avec seuil de couverture, build.
- **Script de captures** : chaque page photographiée à 390 et 1440 px, avec vérification
  automatique de l'absence de débordement horizontal et d'erreur de console.

### Ce que les captures ont corrigé

La règle « rien ne se termine sans vérification visuelle » a servi dès la première page. Cinq
défauts invisibles au code ont été trouvés en regardant les images :

1. **L'illustration des toits était étirée** : dessinée comme une bande de 960 × 300 mais posée
   en fond d'un héros très haut, elle zoomait au point que les fenêtres flottaient dans le ciel.
   Elle a été redessinée immeuble par immeuble, avec les fenêtres posées **à l'intérieur de
   chaque façade** plutôt qu'à des coordonnées absolues : elle reste juste à toutes les largeurs.
2. **Les chiffres clés se lisaient mal** sur les fenêtres allumées. Ils sont passés sur un
   panneau voilé, et le dégradé du héros a été renforcé.
3. **Un débordement horizontal de 49 px à 390 px**, que le premier contrôle n'avait pas vu :
   `overflow-x: hidden` sur `<html>` masque le débordement à `scrollWidth` de la racine, mais
   pas à celui du corps. La cause était une carte en élément de grille, dont le
   `min-width: auto` imposait sa largeur minimale de contenu à la piste. Le contrôle mesure
   désormais les deux, et `Carte` porte `min-w-0`.
4. **La note disparaissait sur la carte Exclusif** : le chiffre était en encre sur fond nuit.
   `Note` accepte maintenant une variante claire.
5. **L'emblème Exclusif ressemblait au badge Premium** : les deux étaient des pastilles or
   clair. L'Exclusif est passé sur fond nuit avec liseré or, et son reflet traverse désormais
   un fond sombre.

### Porte de validation

- [x] Plan commité avant toute ligne de code
- [x] Page de démonstration du design system capturée à 390 et 1440 px
      (`docs/captures/design-system-390.png`, `docs/captures/design-system-1440.png`)
- [x] Aucun débordement horizontal, aucune erreur de console, à aucune des deux largeurs
- [x] Formatage, lint, types, tests et build verts

### Choix d'outillage à noter

- **TypeScript 6.0.3 et non 7.x** : `typescript-eslint` 8.x déclare `typescript <6.1.0`. Entre
  le compilateur le plus récent et un lint typé qui fonctionne, le lint typé a été préféré. À
  réexaminer quand `typescript-eslint` acceptera TypeScript 7.
- **PostGIS est installé dans le conteneur de développement** : toute la stack validée tourne
  en local, y compris la recherche géographique. La distance reste malgré tout une fonction
  pure testée dans `packages/core`, pour que l'éligibilité d'un pro ne dépende jamais de la
  présence de PostGIS.
- `apps/worker`, `packages/db` et `packages/emails` sont décrits dans `PLAN.md` mais ne sont
  pas créés à vide : ils arrivent avec leur phase (1, 4 et 5).

---

## Phase 1 — Données · 27 octobre 2026 · partielle

### Fait

- **Les trois fichiers de `donnees/`**, reconstruits par des scripts reproductibles plutôt que
  déposés à la main (`QUESTIONS.md` Q1) :
  - `communes-ile-de-france.json` : **1 285 entrées**, 1 265 communes et les 20 arrondissements
    de Paris, depuis la source officielle de l'Insee distribuée par Etalab. Chaque décompte
    départemental tombe juste par rapport au cahier des charges. Le script vérifie l'unicité des
    slugs : deux villes ne peuvent pas se disputer une URL.
  - `catalogue.json` : **18 univers, 69 métiers, 479 prestations**. Le script échoue si les
    comptes s'écartent de la règle validée n° 13.
  - `prix-indicatifs.json` : une fourchette TTC pour **chacune des 479 prestations**, avec le
    taux de TVA de son métier. Le script échoue si une seule prestation reste sans fourchette.
- **Le schéma de base** : 65 tables, de `univers` à `scores_qualite`, couvrant l'intégralité du
  modèle de données du §5. Poussé et vérifié sur un vrai PostgreSQL 16 + PostGIS 3.4.
- **Les garde-fous posés dans la base, pas seulement dans le code**, et vérifiés :
  - une facture émise ne peut être ni modifiée ni supprimée — un déclencheur la refuse, et seul
    le passage en avoir est accepté ;
  - le journal d'audit n'accepte ni modification ni suppression — une correction est une
    nouvelle ligne ;
  - une seule exclusivité active par métier × commune, par index partiel : on ne peut pas vendre
    deux fois la même place n° 1.
- **Le seed** : les référentiels réels, 21 paramètres historisés, et le jeu de démonstration du
  §19 — les 7 plombiers de Paris 11e avec leurs formules, l'exclusivité de Plomberie Martin, les
  3 emplacements payés et une demande en cours de distribution. Les entreprises de démonstration
  portent `source: manuelle` et un SIRET de test, et le seed refuse de tourner en production.
- **La CI exerce la base** : un service PostGIS, le schéma, les index, le seed, puis une
  vérification en SQL que les comptes 1 285 et 18/69/479 tombent juste.

### Bloqué par la politique réseau de cet environnement

`geo.api.gouv.fr` et `data.gouv.fr` sont refusés par le proxy sortant. Deux livrables de la
phase 1 en dépendent :

- **les coordonnées des 1 285 communes** (Base Adresse Nationale) ;
- **l'import SIRENE d'Île-de-France**, avec le statut de diffusion et le géocodage.

Les deux scripts sont écrits (`data/geocoder_communes.py`, `data/importer_sirene.py`) et
s'arrêtent avec un message explicite plutôt que d'inventer des données : une coordonnée fausse,
c'est un professionnel éligible à tort ou écarté à tort, et une entreprise inventée n'a rien à
faire dans un annuaire. Ils tourneront tels quels dans un environnement qui autorise ces hôtes.

Conséquence sur le schéma : `latitude`, `longitude` et `sourceCoordonnees` sont nullables, et le
calcul de distance reste une fonction pure testée dans `packages/core` — l'éligibilité d'un pro
ne dépend ni de PostGIS ni de la présence des coordonnées pour être **juste**, seulement pour
être **calculable**.

### Porte de validation

- [x] Catalogue, communes et prix conformes aux comptes validés, vérifiés en CI
- [x] Schéma complet poussé sur PostgreSQL + PostGIS, seed vert, garde-fous testés
- [ ] 100 % des établissements actifs d'Île-de-France importés — **bloqué**, voir ci-dessus

---

## Phases 2 à 11 · à venir

Le site public, l'espace pro, le moteur de demandes, les devis et factures, la monétisation, le
back-office, la personnalisation, les avis et le référencement technique restent à construire.
`packages/core` porte déjà leurs règles, testées : ces phases les branchent sur des écrans et
sur la base.
