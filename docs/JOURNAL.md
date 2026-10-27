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

## Phase 1 — Données · à venir

Prochaine étape : schéma Prisma, catalogue, les 1 285 communes avec leurs géométries, les prix
indicatifs, puis l'import SIRENE d'Île-de-France avec le statut de diffusion, le géocodage par
la Base Adresse Nationale et la correspondance NAF 2025 → métiers.

**Point d'attention** : les trois fichiers de `donnees/` annoncés comme fournis sont absents du
dépôt reçu (`QUESTIONS.md` Q1). Ils seront reconstruits — les communes depuis la source
officielle `@etalab/decoupage-administratif`, le catalogue et les prix depuis le cahier des
charges et l'étude, marqués `aValider`.
