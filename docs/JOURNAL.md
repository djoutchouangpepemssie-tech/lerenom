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

## Phase 2 — Site public · 27 octobre 2026 · l'essentiel est là

### Fait

- **Socle commun.** En-tête collant avec les deux méga-menus — Services (18 univers → métiers →
  prestations très demandées, encart Urgence) et Villes (8 départements, villes les plus
  recherchées, villes ouvertes avec leur statut) — et tiroir plein écran à accordéons sur
  téléphone. Pied de page sombre avec les promesses, les colonnes, les liens légaux et la
  mention obligatoire des sources SIRENE et Base Adresse Nationale. **Aucune liste n'est écrite
  en dur** : tout vient de la base, donc aucun lien ne meurt quand Arcel ajoute un métier.
- **Recherche service + ville** avec suggestions, combobox ARIA complet au clavier, et le statut
  de la ville annoncé dès la suggestion. Les suggestions mènent à un métier, une prestation ou
  une ville — jamais à une entreprise qui a payé.
- **Les pages** : accueil, Île-de-France, département, ville, métier, résultats métier × ville,
  fiche entreprise selon la formule, tous les services, guide des prix avec estimateur,
  professionnels et tarifs avec calculateur de pages, comment ça marche, comment nous classons,
  et les sept pages légales et de confiance.
- **La liste de résultats est classée par `packages/core`, pas par SQL** : la base fournit les
  entreprises éligibles et leur score du soir, `classePageResultats` décide de l'ordre. Le
  séparateur « Classement naturel », la mention « Sponsorisé » et le texte de « Pourquoi ce
  résultat ? » viennent tous de `core` — le même mot pour mot sur chaque écran.
- **Règle d'indexation appliquée dans le rendu, invisible à l'écran** : une page métier × ville
  sous trois entreprises et une fiche non enrichie passent en `noindex, follow`.
- **28 captures** à 390 et 1440 px, sans débordement horizontal ni erreur de console.

### Trouvé en regardant les captures

1. Le fil d'Ariane était **illisible sur l'en-tête sombre** d'une fiche Exclusif : encre sur
   nuit. Il a désormais une variante claire.
2. « Paris 11e Arrondissement » **alourdissait chaque titre**. Les données gardent le nom
   officiel de l'Insee — c'est lui qui fait foi dans un export ou un litige — et l'affichage
   écrit « Paris 11e », avec un helper qui gère aussi « au Plessis-Robinson ».
3. Un **débordement horizontal de 49 px** à 390 px, invisible au premier contrôle parce que
   `overflow-x: hidden` sur `<html>` le masque à `scrollWidth` de la racine. Le contrôle mesure
   maintenant aussi le corps.

### Reste pour clore la phase 2

- Filtres réels sur la page de résultats (urgence, disponible aujourd'hui, note, partenaires,
  prestations, tri) et carte synchronisée avec la liste.
- Sélection de 3 pros et barre collante « Demander des devis à 3 pros ».
- Carte interactive des 8 départements sur l'accueil et les pages ville.
- Lighthouse mobile ≥ 90 à mesurer.

---

## Phases 3 et 4 — premiers jalons · 27 octobre 2026

### Demande de devis (phase 4)

Le parcours en 5 étapes est en ligne et **fonctionne de bout en bout jusqu'à la base** :
service (fenêtre du catalogue ou recherche), détails (trois questions adaptées à l'univers,
description, urgence), où et quand, coordonnées avec le consentement, confirmation.

L'API vérifie la saisie, normalise le mobile en E.164, **refuse les doublons** (même numéro,
même prestation, même ville sur 7 jours), enregistre **le texte exact du consentement**, et fixe
le statut selon la ville : `brouillon` dans une ville ouverte — rien ne part tant que le
téléphone n'est pas vérifié — et `en_attente_ouverture` ailleurs, ce que le formulaire annonce
avant l'envoi. Vérifié en conditions réelles contre la base.

Reste : l'envoi du code SMS (opérateur à raccorder), la cascade de distribution dans le worker,
les pages d'une seule action côté client, et le suivi jusqu'à l'avis.

### Inscription professionnelle (phase 3)

Les 8 étapes sont en ligne, avec la colonne sombre, l'aperçu vivant de la carte qui change avec
la formule, et l'anneau de complétude. Deux mécanismes y sont réels :

- le **compteur de pages** utilise `nombreDePages` de `core`, la même fonction que la page de
  tarifs : un professionnel ne découvrira pas un autre chiffre après avoir payé ;
- le **retrait de villes en descente de formule** utilise `ajusteZonesPourFormule` et **nomme
  les villes retirées**, dans l'ordre imposé — le siège en dernier, puis les villes ouvertes,
  puis « bientôt », puis l'annuaire.

Reste : la recherche SIRENE (hôte refusé par la politique réseau), l'envoi du code de
vérification, l'enregistrement du compte et le paiement Stripe.

---

## Phase 4 — Le moteur de distribution · 27 octobre 2026

C'est le cœur du produit : ce qui décide **qui** reçoit une demande, **quand**, et **ce que ça
coûte**. Tout y est désormais réel, de la saisie du code à la cinquième sollicitation.

### La cascade, dans `apps/worker`

Le worker n'édicte aucune règle : il orchestre. Les décisions viennent de `@lerenom/core`, les
seuils de la table `parametres` que le back-office modifie, et le minutage de BullMQ.

- **Un tour à la fois.** L'Exclusif de la zone est seul pendant 30 minutes ; les Premium
  suivent, du moins servi au plus servi ; puis les autres. Chaque proposition part avec son
  minuteur, programmé sous un identifiant fixe pour que relancer la cascade ne crée pas deux
  échéances sur la même proposition.
- **Rien n'est facturé sur un refus ni sur une expiration.** Le refus est libre, le motif
  obligatoire. Seule l'acceptation consomme un forfait ou déclenche une facturation.
- **L'acceptation est définitive**, et sérialisée : la transaction verrouille la ligne de
  distribution (`SELECT … FOR UPDATE`), donc deux pros qui acceptent à la même seconde ne
  peuvent pas prendre la même place.

**Un vrai défaut de conception a été trouvé par le test d'intégration**, pas par la lecture : la
cascade s'arrêtait au bout de 3 **sollicitations**. Or la règle est « jamais revendue à plus de
3 pros » — le plafond porte sur ceux qui **obtiennent** la demande. Des refus ne doivent pas
condamner une demande valable. `placesRestantes` compte désormais les acceptés et les
propositions en cours, et rien d'autre.

Treize tests d'intégration jouent le scénario complet contre la vraie base, avec six
professionnels construits pour l'occasion, et ne laissent aucune trace derrière eux.

### La vérification du mobile : la barrière d'entrée

Le Renom n'a pas de compte client. Le mobile est la seule identité, et le code à six chiffres la
seule preuve. La boucle est désormais fermée de bout en bout :

1. le dépôt tire un code avec le générateur cryptographique, le **hache** (HMAC-SHA-256, salé
   par l'identifiant de la demande) et met le code en clair dans le SMS, nulle part ailleurs ;
2. `POST /api/demande/verification` confronte la saisie à temps constant, compte les tentatives
   (5 au maximum, 15 minutes de validité), et n'ouvre la distribution qu'en cas de succès ;
3. `PUT` renvoie un code — le « je n'ai rien reçu » — et remet le compteur à zéro, sans quoi
   cinq erreurs de frappe seraient une impasse ;
4. le code qui a servi est effacé, et la cascade est **programmée**, pas exécutée : le visiteur
   n'attend pas que six professionnels soient sollicités pour voir sa confirmation.

Dans une ville non ouverte, le mobile se vérifie comme ailleurs mais la demande ne part pas :
elle attend l'ouverture, ce que l'écran dit avant l'envoi.

L'ordre des refus n'est pas indifférent : déjà vérifié, puis trop de tentatives, puis expiré,
puis code faux. Un robot ne doit pas pouvoir distinguer un code faux d'un code périmé.

### Deux paquets nouveaux, pour une raison précise

- `@lerenom/files` sort les files BullMQ du worker, pour que le site puisse programmer la
  cascade. Tout y est construit **à la demande** : une connexion Redis ouverte à l'import ferait
  échouer un `next build` sur une machine où Redis ne tourne pas. Vérifié en construisant le
  site avec un `REDIS_URL` injoignable.
- `@lerenom/securite` isole le tirage et le hachage, qui ont besoin de Node. `@lerenom/core`
  reste utilisable dans le navigateur : le formulaire valide la saisie avec exactement les mêmes
  règles que le serveur.

### Trouvé en regardant les captures

- Le numéro de mobile se **coupait en fin de ligne** (« 06 12 00 00 / 44 ») : `whitespace-nowrap`.
- Les chiffres du code paraissaient **décalés vers la gauche** : l'interlettrage ajoute un blanc
  après le dernier caractère, compensé par un retrait de `0.5em`.

Le script de captures sait désormais **jouer un scénario** avant de photographier : l'écran de
vérification n'a pas d'adresse propre, on n'y arrive qu'en remplissant les quatre étapes. Le
tunnel entier est donc vérifié dans un vrai navigateur, aux deux largeurs, à chaque passage.
32 captures, aucun débordement.

### La page de suivi : tout ce qu'un client a, sans compte

Le Renom ne crée pas de compte client. Ce qu'un client possède, c'est un lien reçu par SMS —
et c'est tout. Ce lien est désormais réel, de bout en bout.

**Le jeton n'existe en clair qu'une fois**, dans le message. La base n'en garde que
l'empreinte, et c'est par elle qu'on retrouve la ligne : lire la base ne donne donc pas les
clés des dossiers en cours. Un test le vérifie, plutôt que de le supposer.

La doctrine est écrite dans `packages/core/src/liens.ts` : **un lien, une portée**. Le lien de
suivi ouvre une demande — la sienne — et ce qu'on peut en faire : voir qui a accepté, annuler.
Il ne signe rien et ne paie rien ; ce qui engage juridiquement ou financièrement aura son
propre lien, à usage unique, pour qu'un lien de suivi oublié dans une boîte mail ne puisse pas
engager son destinataire. Les durées suivent l'usage, pas une règle unique : 90 jours pour
revenir sur les coordonnées d'un artisan, 7 pour annuler, 3 pour modifier — au-delà, la demande
est périmée de toute façon.

Sur la page, trois choses et rien d'autre : où en est la demande, qui a accepté et comment le
joindre, et le droit de tout arrêter.

**Deux promesses sont tenues dans la requête, pas seulement à l'affichage**, et c'est ce que le
test d'intégration vérifie :

- les coordonnées d'un professionnel **qui n'a pas accepté** ne sortent jamais de la base. Le
  client sait qu'un troisième pro a été sollicité ; il ne saura jamais lequel tant que celui-ci
  n'a pas accepté ;
- **annuler ne reprend rien à personne.** Les propositions en attente passent à « retirée » —
  le pro n'a rien refusé, rien ne doit lui être compté — mais celles qui ont été acceptées
  restent telles quelles : ces professionnels ont payé. La page le dit au client, en toutes
  lettres, avant qu'il confirme.

L'annulation est idempotente : un double clic ou un retour en arrière répond comme la première
fois, plutôt que d'afficher une erreur à quelqu'un qui a fait ce qu'il fallait.

Le worker prévient le client **à chaque acceptation** et lui joint son lien. L'envoi a lieu
après la transaction, jamais dedans : un SMS qui échoue ne doit pas pouvoir annuler une
acceptation déjà acquise et déjà facturée. Un échec laisse une alerte au back-office.

### Trouvé en regardant les captures

- Les numéros s'affichaient en format technique (`+33199000011`). `telephoneLisible` les écrit
  comme on les lit, et rend tel quel ce qui n'est pas un numéro français plutôt que de le
  découper n'importe comment.
- Les sept plombiers de démonstration partageaient **le même numéro**, et aucun n'avait
  d'adresse électronique : le bouton « Écrire » n'apparaissait jamais. Ils ont maintenant des
  coordonnées distinctes, prises dans la plage `01 99 00 00 xx` que l'Arcep réserve à la
  fiction — aucun vrai abonné ne peut être dérangé par une donnée de démonstration.

La page de suivi n'ayant pas d'adresse devinable, `pnpm --filter @lerenom/db demo:suivi`
fabrique un lien de démonstration et l'écrit à la racine ; le script de captures le retrouve
seul. Sans lui, la page n'est pas photographiée **et le script le dit** au lieu de l'ignorer
en silence. 36 captures, aucun débordement.

### Les avis : un seul chemin, et il est vérifiable

La charte publique engage Le Renom sur trois points. Ils sont désormais tenus par le code, pas
par la bonne volonté.

**Un avis ne peut venir que d'une intervention réellement effectuée.** Le point de départ n'est
pas l'acceptation mais l'étape `travaux_realises` : un professionnel qui a accepté sans jamais
intervenir ne récolte pas d'avis. L'invitation part quinze jours après, une fois et une seule,
et le délai vient des paramètres (`joursDemandeAvis`) — Arcel peut le changer sans déploiement.
Il n'existe aucun autre chemin : ni formulaire libre, ni import. C'est ce qui permet d'écrire
« avis vérifié » sans mentir, et ce que l'article L111-7-2 attend d'une plateforme.

**Aucun avis n'est publié d'emblée.** Il entre `en_attente` et crée une tâche à valider. Le
module `packages/core/src/avis.ts` ne modère pas : il **signale**. Un numéro de téléphone, une
adresse, un lien, une injure probable, un texte tout en capitales, une accusation grave
(« arnaque », « vol ») font remonter l'avis en tête de la pile — mais rien n'est jamais refusé
automatiquement. Un automate qui trancherait seul finirait par refuser un client mécontent et
honnête, et la charte promet exactement l'inverse.

**Un avis négatif est publié comme un autre**, et le formulaire le dit au client avant qu'il
écrive, plutôt que de le laisser le découvrir.

Deux détails qui comptent :

- le lien d'invitation **porte l'entreprise visée**. Le client ne choisit pas qui il note dans
  une liste déroulante : on ne devine pas, et il ne doit pas pouvoir noter un professionnel qui
  n'est jamais venu chez lui. Un test le vérifie ;
- **une demande, un avis.** Le lien est à usage unique : on ne revient pas changer sa note une
  semaine plus tard. Deux envois simultanés franchissent pourtant le garde du lien avant qu'il
  ne se ferme — c'est la contrainte d'unicité en base qui tranche alors, et la réponse reste
  aimable : un double clic n'est pas une faute du client. Les deux cas sont testés.

### Trouvé en écrivant les tests

Le premier jet affirmait que redéposer un avis répondait « déjà déposé ». C'était faux : le
lien étant consommé, la porte se ferme **avant** qu'on examine la saisie, et la réponse est un 410. Le comportement du code était le bon ; c'est l'attente du test qui était fausse. Le test
dit maintenant ce qui se passe vraiment, et un second test couvre le cas de course qui, lui,
atteint bien la réponse aimable.

40 captures, aucun débordement. Le formulaire est photographié vide et rempli, aux deux
largeurs, via un lien de démonstration que `demo:suivi` fabrique.

### Les trous rebouchés : quatre décisions prises, pas reportées

Quatre questions ouvertes bloquaient la chaîne ou laissaient un déséquilibre. Elles sont
tranchées et codées, pas renvoyées à plus tard.

**Q19 — qui déclare que les travaux sont réalisés.** C'était le trou le plus grave : l'étape
« travaux réalisés » ne pouvait venir que du professionnel, donc un professionnel qui ne
déclare jamais rien n'aurait jamais eu de mauvais avis. Désormais, sept jours après
l'acceptation, si le pro n'a rien déclaré, **le client est interrogé** : « votre intervention
avec X a-t-elle eu lieu ? ». Oui enregistre l'étape **au nom du client** — l'origine est tracée,
c'est elle qui fait foi dans un litige — et ouvre le formulaire d'avis sur la même page. Non
marque le dossier perdu et alerte le back-office. Une question, deux relances espacées, puis on
laisse tomber : on interroge, on ne harcèle pas.

La conséquence compte autant que la mécanique : **la chaîne des avis n'a plus besoin de
l'espace professionnel pour fonctionner.** Elle tourne de bout en bout avec le seul client.

**Q5 et Q18 — le recrédit.** La règle tient en une phrase : on recrédite ce que Le Renom peut
vérifier dans sa propre base, et rien d'autre. Trois motifs se prouvent — appels tracés,
doublon, annulation immédiate — et sont accordés sans discussion ; les autres passent par un
humain qui motive sa décision. Deux refus sont tout aussi automatiques, et ils comptent autant :
une intervention confirmée par le client ferme le débat quel que soit le motif invoqué, et
« client injoignable » tombe si un appel a abouti.

Le cas concret : un client annule dans l'heure suivant une acceptation, avant tout contact. Le
professionnel a payé des coordonnées qu'il n'a pas eu le temps d'utiliser. **Le Renom ouvre la
contestation lui-même et la tranche dans la foulée** — le pro n'a rien à réclamer. Attendre
qu'il réclame aurait été plus simple ; mais la plupart ne réclameraient jamais, et c'est
précisément ce silence qui rendrait la pratique rentable. Un recrédit rend exactement ce qui a
été pris : l'unité de forfait si la demande y était incluse, l'argent si elle a été facturée,
jamais les deux. Tout passe par une contestation tracée, même accordée d'office.

**Q20 — les coordonnées dans un avis.** On caviarde plutôt que de refuser, et le caviardage est
visible : « [numéro retiré] ». Le texte d'origine n'est jamais écrasé, et seules les données
personnelles sont retirées — une accusation est un propos, elle se publie ou se refuse avec un
motif, elle ne se réécrit pas.

**Q16/Q21 — le secret de hachage.** Il en existait **trois contrôles écrits séparément**. Trois
contrôles finissent par diverger, et celui qui diverge est toujours celui qu'on avait oublié de
relire : il n'y en a plus qu'un, dans `@lerenom/securite`. Et le worker refuse désormais de
démarrer sans secret, au lieu de découvrir le problème au premier client qui valide son numéro.
Le message nomme toutes les variables manquantes d'un coup, pour qu'on n'en corrige pas une,
relance, et en découvre une autre.

### Deux défauts d'outillage, corrigés au passage

- **Un test interrompu bloquait sa propre relance.** Les entreprises laissées derrière lui
  faisaient échouer la contrainte d'unicité sur le slug, et l'on perdait du temps à chercher
  une régression qui n'existait pas. Chaque suite d'intégration nettoie maintenant sa marque
  avant de commencer.
- **Les passages de captures s'accumulaient en base** : huit demandes fictives traînaient.
  `demo:suivi` purge désormais la plage de numéros réservée à la fiction avant de préparer la
  démonstration.

44 captures, aucun débordement. 455 tests verts.

### Reste pour clore la phase 4

Le raccordement d'un opérateur SMS (les messages attendent dans `messages_sortants`), la
modération des avis au back-office, le dépôt d'une contestation par le professionnel lui-même
— la mécanique d'instruction existe et est testée, il lui manque l'écran — et l'anti-fraude.

---

## Phase 3 — L'espace professionnel · 28 octobre 2026

C'est la pièce qui transforme un moteur qui tourne en produit utilisable. Jusqu'ici, la
cascade distribuait des demandes que **personne ne pouvait accepter** autrement qu'en appelant
une fonction depuis du code. Désormais un artisan se connecte, voit ce qui l'attend, accepte
ou refuse, et déclare ses interventions.

### Les mots de passe : la longueur plutôt que la complexité

Le parti pris suit la CNIL et l'ANSSI, pas les habitudes des années 2000 : douze caractères
minimum, **aucune exigence de composition**. Imposer une majuscule, un chiffre et un caractère
spécial produit `Password1!` — court, prévisible, et noté « fort » par la plupart des
formulaires. Une phrase de passe vaut infiniment mieux, et le formulaire le dit.

Ce qui est refusé l'est fermement : trop court, presque sans caractères distincts, figurant
parmi les plus essayés, ou bâti sur l'adresse électronique du compte.

Le hachage utilise **scrypt** de la bibliothèque standard, à 64 Mio par calcul. Argon2id serait
marginalement préférable, mais suppose un module natif compilé : une dépendance binaire de plus
à construire et à déployer, pour un gain théorique. Un algorithme standard correctement
paramétré vaut mieux qu'un meilleur algorithme mal installé. L'empreinte **porte ses propres
paramètres**, donc durcir le coût demain n'invalidera pas les mots de passe d'hier : on les
réécrira à la connexion suivante, sans rien demander à personne.

### Les sessions : en base, pas dans un jeton auto-porté

Le cookie ne contient qu'un identifiant et un jeton aléatoire ; tout le reste vit en base, et
la base n'en garde que l'empreinte. Ce choix coûte une requête par page, et il l'achète : une
session doit pouvoir être **révoquée** — un salarié qui part, un mot de passe changé, une
connexion suspecte. Un jeton auto-porté ne se révoque pas, il expire, et c'est insuffisant pour
un compte qui engage de l'argent.

### La défense : limiter les essais, pas compliquer les mots de passe

Cinq tentatives, puis un quart d'heure d'attente. Le verrou **se lève tout seul** : un compte
bloqué définitivement serait une arme entre les mains de n'importe qui — il suffirait de saisir
dix mauvais mots de passe sur le compte d'un concurrent pour le sortir de la plateforme un jour
de pointe.

Le message d'échec est unique et vague, que l'adresse soit inconnue ou le mot de passe faux :
distinguer les deux donnerait à quiconque le moyen de savoir quels artisans sont inscrits chez
nous. Un test vérifie que les deux réponses sont **identiques au caractère près**.

### La frontière des coordonnées, tenue dans la requête

Avant acceptation, le client n'est ni nommé ni joignable : ni prénom, ni téléphone, ni adresse.
Ce n'est pas une affaire d'affichage — les colonnes ne sont pas même lues en base. Le test le
vérifie en sérialisant la réponse et en y cherchant le numéro : s'il apparaissait, le test
échouerait.

### Trouvé en travaillant

- **Le prix affiché avant le clic était faux.** Le champ `montantHT` d'une distribution ne vaut
  rien tant que la demande n'est pas acceptée : le bouton annonçait donc « Gratuite » une
  demande facturée 12 €. Le coût est maintenant recalculé avec la formule et le forfait du
  mois, par la même fonction que la facturation — un professionnel sait ce qu'il paie au
  moment où il décide.
- **Le test a révélé un défaut de conception** : la remise à zéro du compteur d'échecs était
  cachée dans l'ouverture de session. Une décision de sécurité n'a rien à faire là : un futur
  appelant aurait remis un compteur à zéro sans le savoir. Elle est remontée dans le contrôle
  d'identité, où elle appartient.
- **Un défaut d'hydratation, invisible en développement.** Le minuteur calculait le temps
  restant au rendu serveur puis au rendu client : deux textes différents, et React refusait
  d'hydrater **toute la page**. Un décompte est par nature une affaire de navigateur : il ne
  rend plus rien de daté avant son montage. Dans la foulée, toutes les dates du site sont
  désormais écrites explicitement en heure de Paris — sans quoi le serveur (UTC) et le
  navigateur écrivent deux heures différentes, bogue qui ne se voit qu'en production, sur les
  pages mises en cache, à certaines heures.

### Un déplacement d'architecture

L'orchestration de la distribution vivait dans le worker. Elle est passée dans
`@lerenom/distribution`, partagé : l'acceptation doit être **synchrone**, parce que le verrou
qui empêche deux professionnels de prendre la même place doit se poser pendant la requête du
pro, et parce qu'il attend ses coordonnées à l'écran. Passer par une file aurait rendu
l'opération asynchrone, donc le verrou inutile.

Le worker n'est plus que du câblage — files, minuteurs, signaux d'arrêt — et il l'assume : son
routage des travaux de nuit est sorti dans une fonction testée, qui **lève sur un nom inconnu**
plutôt que de ne rien faire toutes les nuits sans que personne ne s'en aperçoive.

54 captures, aucun débordement. 509 tests verts.

### Reste pour clore la phase 3

L'inscription en 8 étapes ne crée toujours pas de compte : le formulaire existe, sa
persistance non. Manquent aussi la gestion de la fiche, des zones et des agences depuis
l'espace, et la revendication d'une fiche existante.

---

## L'intégration continue n'a jamais tourné · constat du 28 octobre 2026

**Les dix exécutions de l'atelier GitHub ont échoué, toutes, depuis la première.** Il faut le
dire clairement : aucune des portes de validation annoncées dans ce journal n'a jamais été
franchie sur GitHub. Elles l'ont été localement, et c'est vérifiable — mais ce n'est pas la
même garantie.

### Ce que disent les faits

| Observation                                                  | Ce qu'elle élimine                                 |
| ------------------------------------------------------------ | -------------------------------------------------- |
| Les dix exécutions échouent en **2 à 4 secondes**            | Un échec de test ou de build prendrait des minutes |
| `runner_id: 0`, `runner_name: ""`                            | **Aucune machine ne leur a jamais été attribuée**  |
| Aucun journal téléchargeable (HTTP 404)                      | Rien ne s'est exécuté, il n'y a rien à lire        |
| Les deux travaux échouent à la même seconde                  | Le problème est en amont des travaux               |
| Le fichier `ci.yml` est un YAML valide, déclencheurs compris | Ce n'est pas une erreur de syntaxe                 |

Le travail n'a pas échoué : **il n'a jamais démarré**. C'est une condition de compte, pas une
condition de code, et aucune modification du dépôt ne la lèvera.

### Les deux causes possibles, et où regarder

Le dépôt est **privé**, ce qui est déterminant : un dépôt public dispose de minutes GitHub
Actions sans limite, un dépôt privé en consomme un quota.

1. **Compte neuf non vérifié.** GitHub bloque l'exécution des ateliers tant que l'adresse
   électronique du compte n'est pas confirmée. Le compte et le dépôt datent du 27 octobre :
   c'est l'hypothèse la plus probable. À vérifier dans **Settings → Emails**.
2. **Minutes épuisées ou limite de dépense à zéro.** Un dépôt privé sur l'offre gratuite
   dispose de 2 000 minutes par mois ; au-delà, les travaux échouent exactement ainsi, sans
   journal. À vérifier dans **Settings → Billing and plans → Plans and usage**.

Accessoirement, vérifier que les ateliers sont autorisés : **Settings du dépôt → Actions →
General → Allow all actions**.

### Ce qui a été fait en attendant

`pnpm run verifie` exécute **exactement** ce que fait l'atelier, dans le même ordre :
formatage, lint, types, tests, build, puis schéma et semis si une base est joignable. Tant que
GitHub ne lance rien, c'est la seule porte de validation réelle du projet, et elle devait être
reproductible — sinon « ça marche chez moi » devient la seule garantie.

Le script **dit** quand il saute les tests d'intégration faute de base, au lieu de laisser
croire qu'il les a passés. C'est la même règle que partout ailleurs ici : une vérification non
faite se signale, elle ne se tait pas.

L'atelier a par ailleurs reçu des droits explicites et minimaux (`contents: read`) : un travail
qui n'écrit rien n'a pas besoin d'un jeton qui écrit.

---

## Déploiement · la base sans porte publique

La base de données est sur Railway, par choix explicite. Restait à décider comment le site
l'atteint, et ce chapitre a coûté plusieurs tentatives qui méritent d'être écrites, parce que
chacune a échoué pour une raison différente.

Le point de départ : le réseau privé de Railway n'existe qu'à l'exécution. Pendant la
construction, `postgres.railway.internal` ne résout pas — et toutes les pages publiques
lisaient la base, puisqu'elles étaient pré-rendues. Première réponse : un proxy TCP public pour
la construction, le réseau privé pour l'exécution. Elle fonctionnait, et elle était mauvaise :
le mot de passe de la base traversait Internet **en clair**.

Il a fallu trois constats pour l'admettre :

1. `P1011 — server does not support TLS`. L'image `postgis/postgis` n'embarque aucun
   certificat ; `ssl=on` ne peut pas s'y activer.
2. La commande de démarrage était posée **après** le dernier redémarrage. Elle n'avait donc
   jamais pris effet, et rien ne le signalait. Un redéploiement a corrigé cela — sans rien
   changer.
3. La commande de démarrage n'est **pas appliquée** à ce service d'image : ni le `ls` que j'y
   avais glissé, ni le message de génération du certificat n'apparaissent dans les journaux.
   Elle est enregistrée, visible dans la configuration, et ignorée.

On peut passer longtemps à chercher comment faire du TLS. La bonne question était autre :
_pourquoi la construction lit-elle la base ?_ Elle n'en lit que les référentiels, que le dépôt
contient déjà. Le besoin n'était pas légitime, il était hérité.

`dynamic = 'force-dynamic'` sur la disposition publique, et la construction n'ouvre plus une
seule connexion — elle réussit sans `DATABASE_URL` du tout. Le schéma, les index géographiques
et les référentiels passent en `preDeployCommand`, après la construction et sur le réseau
privé. Le proxy public n'a plus de raison d'être.

Deux bénéfices n'étaient pas cherchés. Les migrations s'appliquent maintenant **après** la
construction et **avant** le démarrage : un changement de schéma ne peut plus casser une
construction qui lisait l'ancien. Et la base n'a plus aucun port ouvert sur Internet, ce qui
vaut mieux que le TLS auto-signé que je cherchais à installer.

Le coût est réel et il est écrit en Q22 : les pages ville et métier ne sont plus mises en cache
entre deux visiteurs. La reprise n'est pas un réglage — le cache de Next sérialise ce qu'il
garde, et les `Decimal` de Prisma n'y survivent pas comme des `Decimal`. Les remettre en cache
sans objets de transfert explicites rendrait les prix silencieusement faux. Mieux vaut une page
plus lente qu'un prix douteux.

### Le worker ne démarrait pas, et 509 tests verts ne le disaient pas

À noter ici parce que c'est la leçon la plus coûteuse de la phase : le worker n'avait **jamais
été lancé**. Node, quand il exécute du TypeScript directement, exige l'extension dans les
imports relatifs ; Vitest résout sans. Toute la suite passait sur du code qui ne démarrait pas.
La porte de validation lance désormais le worker et vérifie qu'il se met en écoute. Un câblage
sans test n'excuse pas un câblage sans vérification.

---

## Phase 3 · l'inscription enregistre enfin quelque chose

Le formulaire d'inscription comptait huit étapes, un compteur de pages vivant, un ajustement
des villes à la formule — et **ne créait aucun compte**. « Valider mon inscription »
incrémentait un numéro d'étape et affichait des félicitations. C'est le genre de manque qu'une
démonstration ne révèle jamais : tout se passe bien jusqu'à ce que quelqu'un revienne le
lendemain.

### Ce qu'il a fallu décider

Six décisions, toutes consignées en Q23, dont trois qui engagent vraiment :

**Créer ou revendiquer.** L'annuaire contient des entreprises venues de la base SIRENE que
personne n'a réclamées. Un SIRET déjà présent ne crée pas un doublon : il reprend la fiche,
avec son ancienneté, ses avis et son adresse déjà indexée — le slug existant est conservé, car
il est peut-être partagé. Si la fiche est déjà revendiquée, on refuse et on renvoie vers la
connexion : deux personnes ne peuvent pas tenir la même fiche sans que l'une s'en aperçoive.

**Le mot de passe est demandé, pas envoyé.** Un lien « définissez votre mot de passe » serait
plus élégant et prouverait l'adresse. Il est impossible aujourd'hui : sans opérateur SMS ni
service d'envoi, **aucun professionnel ne pourrait terminer**. Deux champs de plus dans l'étape
« Vérification », et l'inscription fonctionne dès maintenant.

**L'agence prend les coordonnées de sa commune.** L'adresse exacte n'est pas demandée — huit
étapes suffisent. Mais une agence sans latitude ni longitude n'est éligible à rien : elle serait
inscrite et ne recevrait jamais une demande. Une approximation honnête vaut mieux qu'un trou.

### Ce que le travail a révélé

`siretValide('00000000000000')` rendait **vrai**. La clé de Luhn est satisfaite — la somme vaut
zéro — et c'est exactement la saisie de quelqu'un qui veut franchir l'étape sans donner son
numéro. L'Insee n'attribue pas le SIREN `000000000` : il est refusé, ainsi qu'un numéro
d'établissement nul. Deux tests le gardent.

Le rail annonçait « Paiement » à l'étape 7, là où l'écran montre un récapitulatif et où rien
n'est encaissé. Renommé.

Trois listes du formulaire — univers, métiers, villes — n'avaient pas de nom accessible. Elles
en ont un maintenant : un lecteur d'écran annonce ce qu'il parcourt, et les captures les
désignent sans s'accrocher à des classes CSS.

### La vérification

Cinquante-six tests nouveaux : trente-sept sur les règles pures, dix-neuf sur la route et la
base. Les plus utiles ne vérifient pas un succès mais une absence — **une inscription refusée
n'écrit rien**, et ne laisse pas un SIRET pris sans compte pour l'ouvrir.

Six captures nouvelles, aux deux largeurs, regardées une à une. L'écran de fin a été vérifié par
une inscription réelle jouée de bout en bout, puis effacée. Au passage, le script de captures
accepte un filtre : reprendre les cinquante-six captures pour vérifier un écran coûtait un quart
d'heure, et ce coût décourageait exactement ce qu'il faut faire souvent — regarder.

### Ce qui manque encore à l'inscription

La recherche automatique dans la base SIRENE (l'accès à l'API de l'Insee n'est pas ouvert sur
cet environnement), l'envoi réel du code SMS, et le paiement. Les trois sont des raccordements,
pas des décisions.

---

## Phase 3 (suite) · « Ma fiche », et un chiffre qui ne classait rien

L'inscription crée un compte ; il fallait maintenant qu'un professionnel puisse modifier ce
qu'il montre. En construisant l'écran, une découverte a changé la portée du travail.

### Un chiffre qui classait, et que personne ne calculait

`completude` alimente la composante **pertinence** du score de qualité — donc le classement
naturel des résultats. Rien ne la calculait. Le semis écrivait 0,45 pour une fiche gratuite,
0,68 pour une Essentiel, 0,92 pour une Exclusif. Des valeurs posées à la main, qui décidaient
de l'ordre d'affichage.

`completudeFiche` existe désormais dans `@lerenom/core`, avec douze critères pondérés, tous
écrits au même endroit et consignés en Q24. Le principe : **le poids mesure l'utilité pour la
personne qui cherche, pas l'effort du professionnel.** Une présentation vaut 20 %, un slogan
2 %. Une attestation décennale expirée ne compte pas — l'afficher comme acquise reviendrait à
mieux classer une entreprise qui n'est plus couverte.

Et rien n'est exigé. Une fiche incomplète existe, s'affiche et reçoit des demandes. La
complétude la classe, elle ne la conditionne pas : c'est la différence entre un annuaire et un
péage.

### L'écran dit ce que chaque champ rapporte

La colonne de droite n'est pas un ornement. Elle liste les douze critères avec leur poids, du
plus utile au moins utile, et l'anneau bouge à la frappe — avec la fonction qui sert au
classement, pas une approximation d'affichage. Un professionnel qui n'a dix minutes doit savoir
où les passer.

Les quatre éléments qu'on ne saisit pas sur cet écran — photos, logo, couverture, horaires —
sont nommés quand même. Les taire afficherait une fiche « complète » à 100 % qui ne l'est pas.

### Ce que la construction a rattrapé

Mon composant client importait une **valeur** depuis le module qui ouvre la base. Résultat :
Prisma, puis `pg`, puis `dns` et `fs` embarqués dans le paquet envoyé au navigateur. Turbopack
a refusé, et il avait raison. La constante est partie dans `@lerenom/core`, où vivent les règles
partagées entre le serveur et l'écran ; le composant n'importe plus qu'un type.

Deux autres corrections sont venues en regardant les captures : l'anneau écrivait « 72% » quand
le texte voisin écrivait « 72 % », dans la même carte ; et le téléphone s'affichait brut
(`+33199000010`) dans un champ qu'on vient modifier.

### Le jeu de démonstration remis d'aplomb

Une fois la complétude calculée pour de bon, les sept plombiers fictifs tombaient tous à 0,45 :
pas de photos, pas d'assurance, pas d'horaires. La démonstration du classement perdait son
sens. Le jeu d'essai a reçu des éléments **vérifiables** — horaires, slogan, attestation
décennale à échéance glissante — gradués par formule. Le dégradé est de nouveau lisible (72 %,
45 %, 40 %), et chacun de ces chiffres se vérifie champ par champ.

Un défaut de mon propre correctif mérite d'être noté : j'avais d'abord calculé la complétude
dans la boucle de semis, avant que les prestations ne soient créées. Tout le monde avait zéro
prestation. Elle est maintenant calculée en une passe finale, une fois tout en place.

### La vérification

39 tests nouveaux : 21 sur les règles de complétude, 18 sur la route et la base. Deux d'entre
eux gardent une frontière qui ne se voit pas à l'écran : l'entreprise modifiée est celle de la
session, jamais celle que le corps de la requête désigne.

Deux captures nouvelles aux deux largeurs, dont une qui remplit l'attestation sans enregistrer,
pour vérifier que l'anneau et la liste bougent bien à la frappe.

---

## Référencement technique · le plan du site et ce qu'on refuse aux moteurs

Il manquait `robots.ts` et `sitemap.ts`. Les écrire a surtout servi à découvrir deux choses.

### Ce qu'on refuse compte plus que ce qu'on publie

`/suivi/` est refusé aux moteurs, et ce n'est pas une question de référencement : **ces
adresses portent un jeton secret**. C'est lui qui donne accès au suivi d'une demande, à ses
coordonnées et au dépôt d'un avis, sans compte à créer. Une seule adresse de suivi indexée
serait une fuite de données personnelles. Le fichier robots n'y suffit pas — ce n'est qu'une
convention que rien n'oblige à respecter : les pages concernées portaient déjà `noindex`, et
un test vérifie maintenant que le plan du site n'en annonce aucune.

Hors production, **tout** est refusé. Une préproduction indexée vole son référencement à la
production, et l'erreur ne se voit qu'une fois ses effets produits. En l'absence de
`LERENOM_ENV`, on refuse aussi : se tromper dans ce sens-là se répare, dans l'autre beaucoup
moins.

### Une adresse écrite en dur, et deux fichiers figés à la construction

`metadataBase` valait `https://lerenom.fr`, en dur, alors que `LERENOM_URL` existe et désigne
l'adresse réelle de chaque environnement. Une préproduction annonçait donc les adresses
canoniques de la production — deux sites réclamant les mêmes pages.

Pire, et découvert en regardant la sortie réelle plutôt qu'en relisant le code : `robots.txt`
annonçait **`Host: http://localhost:3000`**. Il était statique, donc figé au moment de la
construction, où `LERENOM_URL` n'existe pas encore. Un robots.txt qui renvoie les moteurs vers
une machine de développement.

Le plan du site portait le même piège, en plus discret : il lit la base, et sans `LERENOM_ENV`
il sortait avant toute requête — donc la construction passait. Avec la variable, c'est-à-dire
en production, elle aurait échoué, puisque le réseau privé de l'hébergeur n'existe pas pendant
la construction. Un défaut qui ne se montre que là où il coûte le plus cher. Les deux fichiers
sont désormais rendus à l'exécution.

### Le plan lui-même

1 730 adresses : les pages fixes, les 69 métiers, les 8 départements, les 1 285 villes, les
345 croisements métier × ville des villes ouvertes, et les fiches d'entreprises.

Les croisements ne sont listés que pour les villes **ouvertes**. Le produit cartésien complet
ferait près de 89 000 adresses — au-delà de la limite d'un fichier unique, et sans intérêt :
une page de ville d'annuaire, sans professionnel référencé, n'a rien à proposer au visiteur qui
l'atteindrait depuis un moteur. Les villes y figurent toutes, parce qu'une page de ville dit
quelque chose d'utile même sans croisement.

---

## Horaires · savoir si l'on peut appeler maintenant

L'écran « Ma fiche » affirmait que les horaires se réglaient « depuis les autres écrans de
votre espace ». C'était faux : aucun écran ne le permettait. Une phrase d'interface qui
promet ce qui n'existe pas est pire qu'un manque avoué.

### Ce que le modèle devait permettre

Plusieurs créneaux par jour. La pause du midi n'est pas une exception chez les artisans, c'est
la règle, et un modèle à une seule plage obligerait à mentir — annoncer 8 h – 19 h quand on ne
décroche pas entre midi et deux.

Aucune heure n'est calculée dans `@lerenom/core` à partir d'une date : les fonctions reçoivent
le jour et la minute déjà exprimés dans le fuseau du site. Mélanger les règles d'ouverture et
l'arithmétique des fuseaux produit exactement le genre d'écart d'une heure qui ne se voit qu'au
changement d'heure, un dimanche d'octobre.

Le module répond à deux questions : « est-ce ouvert ? » et « quand est-ce que ça rouvre ? ».
C'est ce qu'un visiteur veut savoir, et un annuaire qui ne le dit pas le laisse appeler dans
le vide.

### Trois défauts trouvés en regardant

**`08:00 AM`.** Les champs `<input type="time">` affichent l'heure dans la langue **du
navigateur**, pas dans celle de la page : sur un navigateur configuré en anglais, un artisan
francophone lisait « 08:00 AM » sur son propre écran. Remplacés par des listes déroulantes au
quart d'heure, qui disent « 8 h » partout et se manipulent aussi bien au doigt qu'à la souris.
Le champ de date de l'assurance reste natif : son calendrier est réellement meilleur, et son
format suit le navigateur de l'utilisateur — c'est-à-dire le sien.

**Un débordement de 25 px à 390.** Trois champs d'heure et deux boutons sur une seule ligne ne
tiennent pas sur un téléphone. La ligne passe en colonne sous 640 px.

**Un commentaire JSX frère de l'élément racine**, qui a fait échouer la construction. Rattrapé
par l'outil, pas par moi.

### Ce qui a suivi

La complétude ne se contente plus de vérifier que le champ existe : un objet vide ou une
semaine entièrement fermée ne comptent pas. « Le champ est rempli » aurait donné le point à une
fiche qui n'annonce rien.

Le semis écrivait les horaires en texte (`'08:00-19:00'`), une forme que rien ne sait relire.
Corrigé — et le JSON de la base est désormais relu puis vérifié avant usage, plutôt que cru sur
parole : s'y fier sans contrôle reviendrait à faire confiance à une version du code qui n'existe
pas encore.

38 tests sur les règles, 4 sur la route et la base. Les plus utiles portent sur les bornes :
une entreprise qui ferme à 18 h n'est pas ouverte à 18 h, et deux plages saisies « 8 h – 12 h »
puis « 12 h – 18 h » décrivent une journée continue, pas une pause.

---

## Périmètre · ouvrir une ville sans nous écrire

L'inscription fixe un périmètre une fois. Jusqu'ici, ouvrir une ville ou ajouter un métier
demandait de nous écrire. L'écran « Mon périmètre » règle cela — et il a demandé deux
décisions, consignées en Q25.

### On ne retire rien à la place du professionnel

À l'inscription, les villes au-delà du plafond de la formule étaient **retirées
automatiquement**. C'était acceptable : l'écran les nommait avant la validation, et le
professionnel les voyait partir.

Ici, personne ne regarde par-dessus son épaule. Dépasser son plafond est donc **refusé avec le
compte exact**, pas corrigé d'autorité : lui retirer une zone sans qu'il s'en aperçoive serait
lui faire perdre des demandes en silence. L'écran le dit avant l'enregistrement, et le bouton
reste désactivé tant que la sélection déborde.

### Une ville qui porte un emplacement payé ne se retire pas

Une exclusivité ou un emplacement en cours est rattaché à une commune. Supprimer la zone
laisserait un emplacement vendu sans ville où l'honorer. La ville s'affiche verrouillée, avec
sa mention, et le refus la nomme.

Ce que ce refus laisse ouvert est écrit en Q25 : il n'existe aucune procédure pour mettre fin
à un emplacement avant son terme, parce que la règle de remboursement au prorata n'est pas
écrite. Elle le sera avec Stripe. Le message renvoie donc vers un contact humain, et le dit.

### Deux défauts vus sur les captures

**Une jauge pleine là où il n'y a pas de limite.** En formule Exclusif, le plafond est `null` ;
la jauge calculait alors son maximum sur le nombre de villes choisies et affichait une barre
pleine — c'est-à-dire « vous êtes à votre limite » à quelqu'un qui n'en a aucune. Remplacée par
un simple compte.

**Aucun onglet n'indiquait la page courante.** Avec deux onglets cela passait ; avec quatre,
dont un qui sort du cadre sur téléphone, ne pas savoir où l'on se trouve devient un inconfort
réel. Les onglets marquent désormais la page courante — soulignée _et_ `aria-current`, parce
que la couleur seule ne suffit ni à un lecteur d'écran ni à qui distingue mal les contrastes —
et la barre se déplace pour amener l'onglet courant dans la vue.

22 tests, dont les deux qui comptent : le plafond refusé n'écrit rien, et une ville verrouillée
ne se retire pas.

---

## Agences · et une fonctionnalité annoncée qui n'existait pas

L'inscription crée une agence sur la commune du siège, avec le rayon par défaut. Sans écran,
une entreprise à deux adresses ne pouvait en déclarer qu'une, et personne ne pouvait corriger
un rayon. « Mes agences » comble cela — et a mis au jour un manque plus sérieux.

### Aucune commune n'a de coordonnées

Les 1 285 communes ont bien des colonnes `latitude`, `longitude` et `sourceCoordonnees` :
**toutes à `null`**. Le géocodage n'a jamais tourné. Aucune agence n'a donc de position non
plus, puisqu'elle recopie celle de sa commune.

Trois conséquences, qu'aucun test ne signalait :

- **le rayon d'une agence n'a aucun effet.** L'éligibilité se décide entièrement sur la liste
  des villes. Un professionnel réglant son rayon à 3 km recevrait les mêmes demandes qu'à
  50 km ;
- **la proximité ne compte pas dans le classement.** `noteMixte` annonce « 60 % qualité, 40 %
  proximité » ; faute de distance, la proximité vaut 0,5 pour tout le monde, donc le classement
  est purement qualitatif ;
- **la page « Comment nous classons » promettait au public** la proximité entre l'adresse des
  travaux et l'agence la plus proche. C'était inexact.

Ce qui sauve le système, et qui était prévu : `packages/core` accepte une zone déclarée **par
liste de communes** autant que par rayon, et traite une distance inconnue comme neutre plutôt
que comme nulle. Rien ne casse ; une fonctionnalité annoncée est simplement inerte.

### Ce que j'ai fait, et ce que je n'ai pas pu faire

Les centroïdes des communes sont une donnée publique et gratuite (`geo.api.gouv.fr`). **Cet
environnement ne peut pas y accéder** : sa politique réseau refuse le domaine. Je ne peux donc
pas combler la donnée, et je ne vais pas l'inventer.

Restait à ne pas mentir. L'écran des agences porte un avertissement qui dit la chose
franchement — le rayon se règle, il ne fait rien encore, il s'appliquera au raccordement — et
la phrase publique de « Comment nous classons » a été corrigée pour décrire ce qui se passe
réellement. Le détail est consigné en Q26, marqué bloquant.

### Une assertion qui ne vérifiait rien

Le test d'inscription contenait `expect(agence.latitude).toBe(commune.latitude)`. Les deux
valant `null`, il passait en ne prouvant rien — et c'est précisément ce test qui aurait dû
révéler le manque. Il pose désormais lui-même une coordonnée, éprouve le chemin, et la retire.
La leçon est la même qu'avec le worker qui ne démarrait pas : une suite verte n'est une preuve
que de ce qu'elle regarde vraiment.

### Les garanties de l'écran

20 tests. Trois portent sur des invariants qui ne se voient pas : **exactement une** agence
principale, toujours — c'est son adresse qui figure sur la fiche publique ; des **coordonnées**
recopiées depuis la commune, sans quoi l'agence ne serait éligible à rien ; et une agence qui
**reste dans le périmètre**, faute de quoi elle recevrait des demandes que le professionnel a
lui-même écartées.

---

## Phase 5 · les devis

`packages/core/src/devis.ts` portait déjà tout : calcul des totaux et des lignes de TVA au
centime, mentions obligatoires d'un devis de dépannage à domicile, numérotation sans trou,
préparation des factures d'acompte et de solde. Quarante fonctions, testées, et aucun écran
pour les appeler. Cette phase les branche.

### Ce qu'un devis est, et ce qui en découle

Un devis envoyé est un engagement remis à quelqu'un. Deux règles en découlent, consignées en
Q27 :

**Il ne se modifie plus.** Le client en détient un exemplaire ; le changer sous ses yeux n'est
pas une correction, c'est une substitution — et si le prix diffère entre ce qu'il a lu et ce
qui est en base, personne ne peut dire lequel fait foi. L'écran propose « Dupliquer en nouveau
brouillon » : la copie porte la version suivante, l'original reste tel qu'il a été remis.

**Le numéro n'est attribué qu'à l'envoi.** Un brouillon abandonné ne consomme pas de numéro.
Un trou dans une série est un défaut comptable, et numéroter à la création en produirait un à
chaque devis commencé puis laissé. Le numéro est tiré dans la transaction d'envoi, et la
contrainte d'unicité de la base est le dernier rempart si deux envois se croisent.

### La colonne qui distingue cet écran d'un tableur

Les mentions obligatoires sont listées à droite, cochées au fil de la saisie, et **le bouton
d'envoi reste fermé tant qu'il en manque une**. Ce n'est pas une politesse réglementaire : un
devis de dépannage à domicile qui les omet expose l'artisan qui l'a signé.

Une subtilité mérite d'être dite : des frais de déplacement à **zéro** comptent comme une
mention. « Déplacement offert » est une information ; l'absence d'information n'en est pas
une. Le brouillon naît donc avec des frais à 0 € et non à « non renseigné ».

### Deux corrections venues de la capture

`LIBELLES_UNITE` écrit « u » et « h ». C'est juste **sur le document** — un devis se lit en
diagonale et la colonne des unités n'a pas à prendre la largeur d'un mot. Dans une liste
déroulante où il faut choisir, « u » ne dit rien. Deux tables plutôt qu'un compromis qui
dessert les deux usages : `NOMS_UNITE` donne « À l'unité », « À l'heure ».

Et une note de bas de devis — de la prose — se saisissait dans un champ d'une ligne, qui en
cachait la fin au moment même où on l'écrivait.

### La vérification

26 tests sur la route et la base. Les plus utiles portent sur les refus : un devis envoyé
refuse toute modification _et rien ne bouge en base_, un devis non conforme ne part pas et
dit ce qui manque, trois envois successifs produisent trois numéros sans trou ni doublon,
et trois brouillons abandonnés n'en consomment aucun.

Le compte de démonstration reçoit un devis en brouillon, pour que l'éditeur ait quelque chose
à montrer : recherche de fuite, pièces, main-d'œuvre, 410,30 € TTC avec 30 % d'acompte.

### Et le même piège que la complétude, à nouveau

La liste affichait **0 €** pour ce devis à 410,30 €. Les totaux sont stockés sur la ligne du
devis — pour que la liste et la comptabilité n'aient pas à recalculer — et le semis écrivait
les lignes sans les calculer. L'écran de détail, lui, était juste : il recalcule à la lecture.

C'est exactement la leçon de la complétude des fiches, rencontrée deux phases plus tôt : **une
valeur stockée qu'un seul chemin calcule finit par mentir dès qu'un autre chemin écrit**. Le
semis les calcule désormais avec la même fonction que l'application, et le commentaire le dit
à l'endroit où on serait tenté de l'oublier.

---

## Phase 4 bis · Les factures

Une facture ne se saisit pas. Elle naît du devis signé, par les mêmes fonctions de calcul —
une facture tapée à la main à côté d'un devis finit par en différer, et c'est exactement
l'écart qu'un contrôle relève. Le professionnel déclare la signature (le client a signé sur
papier, ou dit oui au téléphone) ; deux factures naissent alors quand le devis prévoit un
acompte : l'appel de fonds, puis le solde qui le déduit.

Trois propriétés rendent une facture opposable, et chacune a son test.

**Une facture émise ne se modifie pas.** Pas « le code l'empêche » : _la base_ l'interdit, par
déclencheur. Un contrôle applicatif se contourne dès qu'on écrit en SQL. Le test le prouve en
tentant la modification interdite par Prisma et en attendant le refus de PostgreSQL. Une
erreur se corrige par un avoir, jamais par une retouche.

**Le RIB est figé à l'émission.** Un professionnel qui change de banque ne doit pas voir ses
anciennes factures désigner un compte qu'il n'a plus — sinon un client qui paie une facture de
l'an dernier paie sur le mauvais compte. Tant que la facture n'est pas émise, l'écran montre
le RIB actif du jour, en disant que c'est celui qui sera figé.

**Le numéro est attribué à l'émission**, comme pour les devis : une facture préparée puis
abandonnée ne laisse pas de trou dans la série.

### Le défaut le plus grave de la phase

`numero` était `@unique` — unique **sur toute la plateforme**. Or chaque société repart à
`0001` chaque année. Le deuxième artisan à émettre sa première facture de l'année aurait vu
sa requête refusée, en production, avec un message incompréhensible. La contrainte est
désormais `@@unique([entrepriseId, numero])`, sur les devis, les factures et les avoirs — ces
derniers ont gagné au passage le `entrepriseId` qui leur manquait.

Ce défaut n'a été vu ni par un test ni par une relecture : il a fallu se demander, devant le
schéma, _ce qui se passe quand deux entreprises font la même chose le même jour_. C'est une
question à se poser devant chaque contrainte d'unicité.

### Un ordre de déploiement qui n'existait nulle part

Poser cette contrainte sur une base déjà peuplée fait exiger à `prisma db push` un drapeau de
perte de données — drapeau qui autoriserait aussi la suppression de colonnes, et qu'on ne met
pas dans une commande de déploiement. Les contraintes sont donc posées en SQL, sous le nom
exact que Prisma attend : il ne voit ensuite plus aucune différence.

Mais ce SQL doit passer **avant** le schéma, alors que les garde-fous passent après. Cet ordre
vivait dans une case du tableau de bord de l'hébergeur : invisible dans le dépôt, versionné
nulle part, relu par personne. Il vit maintenant dans `scripts/pre-deploiement.sh`, joué à
l'identique en local, en intégration continue et au déploiement. Les quatre étapes y sont
commentées une à une, parce qu'un ordre d'exécution sans justification se fait réordonner par
le premier qui passe.

### Ce que les captures ont attrapé

Sur la facture, « 1122 € ». Le séparateur de milliers _était_ dans la chaîne : `formatEuros`
pose une espace fine insécable, comme le veut la typographie française, et un test l'exigeait.
Mesure faite dans la police du site : cette fine rend **1,6 px** contre 3,2 px pour une espace
insécable ordinaire. Manrope ne la dessine pas ; le navigateur la réduit à presque rien.

Un séparateur qu'on ne voit pas ne sépare rien. Sur une facture, « 1122 » et « 1 122 » ne se
lisent pas à la même vitesse. La règle typographique sert la lecture ; quand son application
la dessert, c'est la lecture qui gagne — insécable partout, et le pourquoi écrit à côté du
code pour que personne ne « corrige » en sens inverse.

Et la barre d'onglets de l'espace pro montrait « tre » collé au bord gauche. Un mot tranché
net ressemble à un défaut d'affichage ; rien ne disait qu'il suffisait de faire glisser. La
barre s'estompe désormais du côté où il reste des onglets, et seulement de ce côté-là.

Aucun des deux n'était visible dans un test. Les deux sautaient aux yeux sur l'image.

### Un piège de l'outillage, pas du produit

Trois captures échouaient : les boutons attendus n'existaient pas sur la page. Les jetons de
démonstration sont **signés** par `SECRET_VERIFICATION` ; ceux du dépôt avaient été fabriqués
avec un autre secret que celui du serveur photographié. Les pages s'affichaient donc en état
« lien invalide ». Rien de cassé dans le produit — mais une heure perdue à chercher au mauvais
endroit, et la leçon vaut d'être écrite : un jeton signé ne vaut que par le secret du service
qui le relit.

La porte de validation, elle, mentait d'une autre façon : elle déclarait le worker en échec
dès que la machine n'avait pas les secrets de production. Elle vérifie qu'il _démarre_ ; elle
lui en fabrique un éphémère, comme le ferait n'importe qui à la main.

### La vérification

758 tests verts, 74 captures sans un seul débordement. Les 18 tests de la facture portent,
là encore, surtout sur les refus : la base qui rejette la modification d'une facture émise,
l'ancien RIB qui survit au changement de banque, l'acompte et le solde dont la somme retombe
au centime sur le total du devis, et la facture d'un confrère qu'on ne lit ni n'émet.

---

## Phase 4 ter · Les avoirs

Chaque écran de facture promettait qu'« une erreur se corrige par un avoir ». L'avoir
n'existait pas. Une promesse affichée sans mécanisme derrière est une dette qui se découvre
le jour où quelqu'un en a besoin — c'est-à-dire au pire moment.

L'avoir corrige en **ajoutant** un document plutôt qu'en retouchant : il constate une dette de
l'artisan envers son client, porte son numéro dans sa propre série, et laisse la facture
telle qu'elle a été remise. Les deux se lisent ensemble.

### Les trois règles, et pourquoi elles tiennent

**On ne crédite que ce qui a été facturé.** La somme des avoirs d'une facture ne peut pas
dépasser son montant. Le test qui compte n'est pas celui du premier avoir trop gros — c'est
celui de deux avoirs acceptables séparément et excessifs ensemble, parce que c'est ainsi que
le dépassement arriverait vraiment.

**Un avoir est définitif dès sa création.** Pas de brouillon, pas d'étape d'émission : un
document de correction qu'on pourrait corriger ne vaudrait pas mieux que la facture qu'il
rectifie.

**Tout se passe dans une transaction.** Lire le reste créditable, prendre le numéro suivant,
écrire, éventuellement annuler la facture : hors transaction, deux avoirs simultanés
liraient le même « reste » et le dépasseraient à eux deux. La contrainte d'unicité par
entreprise reste le dernier filet.

### Deux trous dans un garde-fou que je venais d'écrire

En relisant le déclencheur d'immuabilité des factures pour y brancher l'annulation, deux
défauts ont sauté aux yeux.

Le premier : la condition était `OLD.statut IN ('emise','payee') AND NEW.statut <>
'annulee_par_avoir'`. Autrement dit, il suffisait d'annuler une facture **et** d'en réécrire
les totaux dans la même instruction pour contourner tout le dispositif. Une porte de sortie
doit être étroite, sinon elle n'est qu'un autre chemin. Les montants, le numéro, la date
d'émission et le RIB d'une facture émise ne bougent désormais plus, quoi qu'il arrive au
statut — seul le statut vit, et jamais vers l'arrière.

Le second : rien ne protégeait les avoirs eux-mêmes. Ils en ont maintenant leur propre
déclencheur.

### Une distinction qu'il a fallu faire, pas desserrer

Ce déclencheur a immédiatement cassé la suppression d'une entreprise : ses avoirs partent en
cascade, et le verrou les retenait. La tentation était de n'interdire que la modification.
Mais supprimer un avoir **pour corriger une erreur** et supprimer **toute une société** —
effacement demandé par son dirigeant, nettoyage d'un jeu de test — sont deux actes
différents, et un verrou qui les confond protège mal.

PostgreSQL les distingue de lui-même : dans une cascade, la ligne parente est effacée avant
ses enfants, donc l'entreprise est déjà absente quand le déclencheur s'exécute pour un avoir
emporté par elle. Un avoir supprimé seul, lui, a toujours son entreprise en face.

Cette propriété a été **vérifiée sur une table temporaire avant d'écrire la moindre ligne qui
en dépende**, plutôt que supposée depuis un souvenir de documentation. Elle est maintenant
tenue par deux tests.

### Ce que les captures ont attrapé, encore

Le montant pré-rempli du formulaire s'écrivait « 325.26 », avec un point, au milieu d'une page
qui emploie la virgule partout ailleurs. Un champ pré-rempli enseigne la syntaxe attendue :
celui-là enseignait la mauvaise.

Plus sérieux, et sur un écran livré deux phases plus tôt : une facture d'acompte passait de
« TVA 112,20 € » à « À payer 370,26 € » sans rien pour expliquer le saut. Les lignes décrivent
la commande entière, l'acompte n'en réclame qu'une part — mais un client qui lit la facture ne
pouvait pas refaire le calcul. Une ligne « Acompte demandé · 30 % — sur 1 234,20 € TTC » le
rétablit. Aucun test ne pouvait voir cela : le montant était juste, c'est son explication qui
manquait.

### La vérification

791 tests verts, 78 captures sans un débordement. Les 16 tests des avoirs portent, une fois
de plus, surtout sur ce qui doit être refusé — y compris par la base elle-même.

---

## Phase 5 · Le compte bancaire

Les factures affichaient un RIB que seul le semis savait poser. Aucun écran n'en proposait la
saisie : un vrai professionnel n'avait aucun moyen d'indiquer où le payer. Même constat que
pour l'avoir — le produit promettait une chose qu'il ne permettait pas.

### La règle qui gouverne tout le reste

Détourner les encaissements est la fraude la plus banale sur ce genre de plateforme. L'escroc
qui prend la main sur un espace professionnel n'a rien à y voler : il veut seulement que les
virements des clients arrivent chez lui. Trois décisions en découlent.

**Le code part au mobile déjà enregistré**, jamais à un numéro fourni dans la même requête —
qui ne prouverait rien, puisque l'escroc l'aurait écrit lui-même. Un test garde exactement
ce point, en envoyant un numéro dans le corps de la requête et en vérifiant que le SMS part
quand même à l'autre.

**L'ancien compte reste actif tant que le code n'est pas saisi.** Un attaquant qui n'aboutit
pas ne doit même pas pouvoir couper les encaissements de sa victime : échouer ne doit rien
coûter à celui qu'on attaque.

**Sans mobile enregistré, on refuse** — et l'écran le dit _avant_ la saisie, pas après. Une
confirmation sans second canal n'est pas une confirmation ; et faire taper un IBAN pour le
rejeter ensuite est la séquence qui fait perdre confiance au moment précis où on en demande.

Aucun SMS ne part réellement : les messages s'empilent dans `messages_sortants`, comme toutes
les notifications de la plateforme, en attendant un fournisseur. Le changement de compte est
donc inutilisable en production, et c'est volontaire — mieux vaut une porte verrouillée dont
on n'a pas encore la clé qu'une porte ouverte. C'est consigné en Q30.

### Un mécanisme qui n'avait de spécifique que son nom

Le code à usage unique existait déjà, pour vérifier le mobile des clients : tirage, hachage
salé, limite de tentatives, expiration. Son sel s'appelait `demandeId`. Ce nom laissait croire
que le mécanisme ne sortait pas des demandes, et aurait fait réécrire ailleurs ce qui existait
déjà. Il s'appelle `sel` ; rien d'autre n'a changé, et le même code sert maintenant aux deux.

### Le trou trouvé en cours de route

En rendant les avoirs immuables, j'avais cassé la suppression d'une entreprise. En réparant
cela proprement, j'ai relu le déclencheur des factures — et vu qu'il ne portait que sur
`UPDATE`.

Autrement dit : une facture émise ne pouvait pas être modifiée, mais rien n'empêchait de
l'**effacer**. Ce qui revient au même en pire, puisqu'il ne reste alors rien à opposer. Une
sonde en SQL l'a confirmé en trois lignes avant toute correction. Un garde-fou qui ferme une
porte et laisse l'autre ouverte ne garde rien.

La suppression est désormais refusée, avec la même exception de cascade que pour les avoirs,
et trois tests la couvrent — y compris celui qui vérifie qu'une facture **non** émise, elle,
se supprime toujours : un verrou qui bloque tout ne protège rien de particulier.

### Ce que ce verrou a coûté, et pourquoi on l'a payé

Le semis de démonstration effaçait ses factures à chaque passage pour les reconstruire. Il ne
le peut plus. La tentation était de desserrer le verrou ; c'eût été exactement l'erreur, car
**un jeu d'essai qui peut effacer ce que la production ne peut pas effacer n'éprouve plus les
mêmes règles que le produit**. Le semis constate désormais ce qui existe au lieu de le refaire.

### Ce que les captures ont attrapé

Le numéro masqué se coupait en fin de ligne : « au • • • • • • • • / 92 ». Un numéro de
téléphone ne se coupe pas, masqué ou non — séparateurs insécables.

### Une porte de validation qui mentait, deux fois

Elle déclarait le worker en échec dès que la machine n'avait pas les secrets de production ;
on lui en fabriquait un à cette étape-là. Les nouveaux tests en ont eu besoin à leur tour, et
la porte a de nouveau échoué pour la même raison. Le secret est maintenant fabriqué **une
fois, en haut** : deux étapes qui ne s'accordent pas sur un secret ne s'accordent sur rien.

### La vérification

834 tests verts, 82 captures sans un débordement. Les 20 tests du compte bancaire portent
surtout sur ce qui doit échouer : le code qui ne vaut que pour un compte, l'essai de trop,
le code rejoué, et le confrère qui n'en confirme aucun.

---

## Phase 5 bis · Le devis arrive chez le client

« Envoyer au client » attribuait un numéro, rendait le devis immuable, basculait son statut —
et n'envoyait rien. Le client n'apprenait jamais que le devis existait.

Ce n'était pas un oubli isolé : c'est le troisième de la même famille, après la facture sans
avoir et la facture sans RIB saisissable. **Un verbe dans une interface est une promesse**, et
trois promesses non tenues en trois phases valent une règle : avant de livrer un écran, relire
ce que ses boutons annoncent et vérifier que chacun le fait.

### Ce qui part, et par où

Un courriel et un SMS, selon les coordonnées du client, portant un lien à usage limité — la
mécanique qui dessert déjà tout ce que Le Renom adresse à un client, puisqu'il n'y a pas de
compte client. Le lien porte l'action `signer_devis`, qui existait dans le schéma depuis le
début sans que rien ne la crée.

La réponse dit **par où c'est parti**, et surtout quand ce n'est parti nulle part : un client
sans courriel ni mobile existe, et l'écran le dit plutôt que de laisser croire à un envoi.
Le devis reste envoyé pour autant — il porte son numéro et il est immuable. Revenir sur cet
état parce qu'un message n'a pas pu être mis en file creuserait un trou dans la numérotation
pour une panne qui se rattrape.

### Un mécanisme qui n'avait, lui non plus, de spécifique que son nom

`creeLien` exigeait une demande. La colonne était facultative depuis toujours ; seule la
fonction l'interdisait. Or un devis qu'un professionnel établit pour son propre client n'a
pas de demande derrière lui.

C'est la deuxième fois en deux phases : après le sel du code de vérification, le lien. Dans
les deux cas, un mécanisme général portait le nom du premier usage qu'on en avait fait, et
ce nom aurait fait réécrire à côté ce qui existait déjà. Les appelants qui ont besoin d'une
demande utilisent désormais `resoudLienDeDemande`, qui le garantit **par le type** plutôt que
par un contrôle répété à chaque appel.

### La page du client

Elle porte le document entier : les lignes, les totaux, l'acompte chiffré en euros — pas en
pourcentage —, les mentions obligatoires, et qui s'engage, SIRET compris. Un client n'a pas
de compte où aller chercher le reste : ce qu'il ne voit pas ici, il ne le voit pas.

Les totaux y sont **recalculés à la lecture**. Non par défiance envers la colonne stockée,
mais parce que la version que le client a sous les yeux doit être celle que le code sait
justifier ligne à ligne. Un écart se verrait ici plutôt que dans une réclamation.

L'acceptation passe par la même fonction que la signature déclarée par le professionnel.
Deux façons de signer qui prépareraient des factures différentes seraient pires que pas de
signature du tout.

Une règle s'ajoute côté client : **un devis périmé ne s'accepte pas**, même si son lien vit
encore. Le lien dure trente jours, la validité du devis quinze : deux durées indépendantes,
et c'est la plus courte qui doit gagner. Un professionnel qui déclare une signature sait ce
qu'il fait ; un client peut ouvrir un vieux courriel.

### Ce que les captures ont attrapé

L'adresse de l'entreprise affichait « 75011 Paris 11e Arrondissement » — le nom brut de la
table — et le téléphone « +33199000010 », la forme qui sert à appeler. Les deux utilitaires
existaient. Un devis est un document, pas un extrait de base.

### La vérification

847 tests verts, 86 captures sans un débordement. Les 13 tests du parcours client portent sur
l'étroitesse du lien : il n'ouvre que son devis, il ne vaut pas pour une autre action, il ne
sert qu'une fois, et il n'accepte rien de périmé.

---

## Hors phase · Les communes retrouvent leurs coordonnées

Q26 était le seul point marqué bloquant du projet : aucune des 1 285 communes n'avait de
coordonnées, donc la distance valait `null` pour tout le monde, le rayon d'intervention d'une
agence n'avait aucun effet, et la page publique « Comment nous classons » promettait un
critère inerte.

La cause tenait en une ligne : `geo.api.gouv.fr` est refusé par la politique réseau de cette
machine. La leçon aussi : **une source refusée ne veut pas dire une donnée inaccessible.**
`raw.githubusercontent.com`, lui, répond, et la base officielle des codes postaux de La Poste
y est redistribuée en données ouvertes.

### Juger la source plutôt que lui faire confiance

`scripts/coordonnees-communes.mjs` la télécharge et **refuse d'écrire** si l'un de quatre
contrôles échoue : couverture des 1 285 communes, appartenance au cadre francilien, vingt
points distincts pour les vingt arrondissements de Paris, et sept communes témoins à moins de
cinq kilomètres de positions connues par ailleurs.

Le troisième contrôle est celui qui importe le plus. Un jeu de données communal peut très bien
donner le même point à tout Paris : la couverture serait parfaite, le cadre respecté, et la
proximité intra-parisienne ne voudrait plus rien dire — précisément là où elle compte le plus.

Au recoupement, l'écart va de 50 mètres à 2,3 kilomètres. C'est la précision d'un point de
référence communal, et c'est assez pour **classer** — « celui-ci est plus près que celui-là ».
Pas pour un itinéraire, et l'écran ne prétend pas le contraire : « dans votre ville » en deçà
d'un kilomètre et demi, le kilomètre entier en deçà de dix, par tranches de cinq au-delà.
« À 1,2 km » aurait revendiqué cent mètres de précision que la donnée n'a pas.

### Trois défauts qui dormaient depuis le premier jour

C'est la partie intéressante. Remplir le champ a réveillé trois chemins jamais éprouvés.

**Le semis ne convergeait pas.** `createMany` avec `skipDuplicates` **saute** les lignes
existantes. Le référentiel pouvait naître du fichier sur une base vierge, jamais s'y
conformer ensuite : les 1 285 communes ont été sautées en silence, et relancer le semis n'a
rien changé. Il ajuste désormais ce que le fichier possède légitimement — coordonnées,
population, ouverture — et laisse le nom et le slug, qui vivent dans des adresses indexées.

**`db push` supprimait les colonnes PostGIS à chaque passage.** Les points générés des
agences, communes et demandes n'existaient pas dans le schéma Prisma : il les effaçait, le
fichier SQL les recréait juste après, et personne ne le voyait puisqu'elles étaient vides. Le
jour où elles ont contenu 1 281 valeurs, Prisma a refusé — ce qui est le bon comportement, et
la seule raison pour laquelle le défaut s'est révélé. Les trois colonnes sont maintenant
déclarées `Unsupported(...)` avec `@default(dbgenerated())` ; `postgis.sql` convertit en
colonne générée ce que Prisma crée en colonne ordinaire, une fois, puis ne fait plus rien.
Le chemin d'une base vierge a été éprouvé pour de bon, sur une base jetable.

**Deux tests détruisaient le référentiel.** Ils posaient des coordonnées sur quatre
arrondissements de Paris, puis les remettaient à `null` — une restauration écrite quand `null`
était la valeur d'origine. Le commentaire disait « un test ne laisse pas de données derrière
lui, pas même des données justes » : principe juste, prémisse devenue fausse. Ils relisent
désormais ce qu'ils trouvent et le rendent tel quel.

### La règle qui en sort

Les trois défauts ont la même forme, et elle est écrite dans `docs/PLAN.md` :

> **Un champ vide ne prouve rien.** Tant qu'une donnée manque, tout ce qui la traverse est
> exercé à blanc : les contrôles passent, les suppressions sont indolores, les restaurations
> sont justes par accident.

Quand un champ passe de « toujours vide » à « renseigné », il faut relire ce qui l'écrit, ce
qui le supprime, ce qui le restaure et ce qui l'affiche. Les quatre mentaient ici, et la porte
de validation était verte.

### Un quatrième défaut, trouvé en vérifiant le déploiement

Le déploiement est passé au vert, et la production n'avait toujours pas les coordonnées.

Le semis se juge « déjà fait » et s'arrête tôt — un raccourci posé pour éviter de reposer
1 285 communes et 479 prestations à chaque déploiement. La convergence que je venais
d'écrire était **après** ce raccourci. Elle n'a donc jamais tourné là où elle servait.

Le commentaire du raccourci disait déjà ce qu'il fallait lire : « `FORCE_SEMIS=1` le force
malgré tout : c'est ce qu'on veut après avoir changé le jeu de données, **sans quoi les
corrections ne s'appliqueraient jamais** ». La phrase était juste, et personne — moi
compris — n'en avait tiré la conséquence : une correction de données ne doit pas dépendre
d'une variable d'environnement que le déploiement ne pose pas.

L'alignement du référentiel tourne maintenant **avant** le raccourci, à chaque passage. Il
ne coûte rien quand il n'y a rien à faire. C'est la même leçon que les trois précédentes,
d'un cran plus haut : un chemin qu'on n'emprunte jamais n'est pas un chemin sûr, c'est un
chemin inconnu.

### La vérification

854 tests verts. Un test neuf garde ce que tout ceci devait débloquer : deux serruriers
identiques en tout sauf leur commune — Melun et Montreuil —, et le plus proche passe devant.
Un critère silencieusement neutre ne casse aucun test ; celui-là en casserait un.

La page « Comment nous classons » dit maintenant la vérité, y compris sa limite : la
proximité se mesure de commune à commune, elle distingue un artisan de votre ville d'un
artisan à trente kilomètres, pas deux artisans de votre quartier.

---

## Hors phase · Lighthouse, mesuré pour la première fois

La phase 2 exigeait « Lighthouse mobile ≥ 90 ». Personne ne l'avait mesuré. Une exigence
qu'on ne mesure pas est un souhait, et celle-ci l'était depuis le début du projet.

Première mesure sur l'accueil : performance 86, accessibilité 92, référencement **63**.

### Mesurer juste avant de corriger quoi que ce soit

Les 63 du référencement n'étaient pas un défaut du site : mon serveur tournait en
développement, et `robots.ts` y interdit l'indexation de tout le site — à juste titre, une
préproduction n'a rien à faire dans un moteur de recherche. Je mesurais un réglage, pas une
page. En production, le même écran rend **100**.

Le second piège est plus retors : enchaîner dix mesures dans une même instance de navigateur
fait dériver les scores. L'accueil rendait 94 mesuré seul et 87 en huitième position, sur la
même construction. Le guide des prix est passé de 84 à 95 rien qu'en lui donnant un
navigateur neuf. **Un chiffre qui dépend de l'ordre de passage ne mesure rien** — j'ai failli
optimiser une page qui n'avait rien.

### Ce qui coûtait vraiment

**Deux animations infinies peignaient en permanence.** La première animait `box-shadow`, une
propriété de peinture : le navigateur redessinait la zone à chaque image, indéfiniment. La
seconde était pire — deux fenêtres sur trois des toits de Paris, soit près de 235 éléments,
chacun avec sa propre animation infinie **déclarée en style en ligne**, donc recopiée dans le
balisage puis dans la charge d'hydratation de React. L'accueil envoyait 351 Kio de données
d'hydratation pour 83 liens.

Les deux sont corrigées, et la règle est écrite dans la feuille de style : une animation
infinie n'anime que `transform`, `scale`, `translate`, `rotate` ou `opacity`. Une animation
qui s'arrête peut se permettre davantage ; une animation qui ne s'arrête jamais, non.

Pour les fenêtres, j'ai aussi réduit la proportion qui scintille d'une sur deux à une sur
sept. Ce n'est pas une concession : une façade dont toutes les fenêtres clignotent de concert
ne ressemble à rien, et quelques-unes suffisent à donner l'effet.

**La page Île-de-France rendait 1 285 lignes dont quinze sont visibles.** La tentation était
d'alléger la page. C'eût été la mauvaise réponse : le transfert ne pesait que 80 Kio une fois
compressé — le coût était entièrement dans la mise en page et la peinture de 875 Kio de
balisage. Et « les 1 285 villes, sans exception » est une promesse écrite dans le titre.

`content-visibility: auto` règle exactement ce problème : tout reste dans le document, pour
les moteurs comme pour les lecteurs d'écran, mais le navigateur saute ce qui est hors écran.
Vérifié en faisant défiler jusqu'à la quarante-millième ligne : les communes s'y affichent
normalement.

### Deux couleurs sous la norme

`encre-40` rendait 2,97:1 sur le crème, là où AA demande 4,5 pour du petit texte — et ses 55
emplois sont tous du petit texte. Corrigé au niveau du jeton, donc partout d'un coup.

J'ai calculé le premier gris qui passe… sur fond blanc. Mauvais fond : le site pose ses textes
sur quatre nuances de crème, et la plus foncée laissait encore passer 4,24:1. **Le contraste
se juge contre le fond le plus foncé où la couleur se pose**, pas contre le blanc.

La correction a une conséquence que je n'ai pas voulu masquer : `encre-40` et `encre-55` sont
désormais presque identiques, et la hiérarchie à trois crans n'en a plus vraiment trois.
Rééchelonner la gamme est une décision de conception, pas une correction de défaut : elle est
posée en Q32.

### Le résultat

Les dix gabarits publics sont au-dessus de 90, de 91 à 100, avec 100 partout en référencement
et en bonnes pratiques. La porte de validation de la phase 2 est franchie — et elle est
désormais **reproductible** : `node scripts/lighthouse.mjs`, avec les deux pièges de mesure
écrits en tête du fichier pour que personne n'y retombe.

---

## Phase 5 ter · L'agenda

Le schéma portait `Creneau` et `RendezVous` depuis le premier jour, avec leurs statuts, leurs
champs de relance et de rappel. Rien ne les écrivait, et aucun écran ne les montrait.

### Le piège du vocabulaire

`horaires.ts` appelait déjà « créneau » une tranche hebdomadaire — « le mardi de 9 h à 12 h »,
sans date. L'agenda manipule des **plages datées**. Deux notions voisines qui ne se mélangent
pas : le module s'appelle `agenda.ts` et son type `Plage`, pour qu'aucun import n'ait à
choisir entre deux `Creneau`.

### La règle qui compte

Quand un professionnel propose un créneau à un client, ce créneau est réservé — sinon il le
vendrait deux fois. Mais si le client ne répond jamais, **le blocage ne doit pas durer**. Au
bout de quarante-huit heures la plage redevient libre, sans que personne ait à faire le
ménage : `occupeEncore` prend l'heure en paramètre et répond non.

Sans cette règle, un agenda se minéralise au fil des clients qui ne répondent pas, et le
professionnel cesse de s'en servir. C'est le genre de défaut qui ne casse aucun test — la
donnée est juste, l'écran est juste — et qui tue l'usage.

### Ce que la base garantit, et ce qu'elle ne peut pas garantir

Vérifier qu'une plage est libre puis l'écrire ne garantit rien : deux requêtes simultanées
lisent chacune un agenda libre, puis écrivent chacune la leur. La base porte donc une
contrainte d'exclusion sur `(entreprise, intervalle)` — c'est elle qui rend la règle vraie,
le contrôle applicatif servant à **dire lequel** des rendez-vous gêne, ce qu'une violation de
contrainte ne dira jamais.

Les créneaux proposés en sont exclus, et c'est délibéré : leur validité dépend de l'heure
qu'il est, or `now()` n'est pas immuable et ne peut pas entrer dans un index. **La base
garantit ce qui est ferme ; le code arbitre ce qui dépend du temps.** Un test garde chacun des
deux côtés.

Première tentative refusée par PostgreSQL, d'ailleurs : `tstzrange` sur des colonnes sans
fuseau demande une conversion qui dépend du réglage de session. `tsrange` est le bon type, et
le refus était juste.

### Une liste par jour, pas une grille horaire

La grille aux lignes de demi-heures est la représentation attendue d'un agenda. C'est un piège
sur un téléphone de 390 px : sept colonnes y deviennent illisibles et un rendez-vous d'un
quart d'heure se réduit à quelques pixels.

Un artisan consulte son agenda debout, entre deux chantiers. Il veut savoir ce qu'il a
aujourd'hui, dans l'ordre. Les jours s'empilent donc sur téléphone et passent en sept colonnes
sur grand écran — la même liste relue autrement, sans second composant à maintenir.

La semaine affichée vit dans l'adresse, pas dans l'état du composant : un agenda se partage,
se met en favori et se recharge.

### Ce que la capture a attrapé

« Du 26 octobre au 1 novembre ». En français, le premier du mois s'écrit « 1er » — et une
semaine sur quatre tombe dessus. C'est le détail qui distingue une date écrite d'une date
recrachée par une machine.

### La vérification

903 tests verts. Les 19 tests de l'agenda portent surtout sur ce qui doit être refusé, et sur
une chose qui doit être **acceptée** : deux rendez-vous qui s'enchaînent bord à bord, 10 h – 11 h
puis 11 h – 12 h. Une règle de non-chevauchement trop zélée refuserait une journée normale.

Le trou le plus visible de cette phase est consigné en Q34 : un rendez-vous confirmé ne se
déplace pas, et l'annulation qui préviendrait le client n'existe pas encore. Rien ne part
encore au client — ni proposition, ni relance, ni rappel.

---

## Phase 5 quater · Le rendez-vous, des deux côtés

La phase précédente laissait un trou que j'avais consigné : un rendez-vous confirmé ne se
déplaçait pas, l'écran renvoyait vers une annulation — et cette annulation n'existait pas.
Le professionnel se retrouvait sans issue. C'est ce trou qui est comblé, avec tout le
parcours client qui allait avec.

### Proposer, répondre, annuler

Le professionnel propose un créneau à l'un de ses clients ; le client reçoit un courriel et un
SMS portant un lien à usage unique ; il accepte ou décline. Accepter rend la plage **ferme** —
elle passe sous la contrainte d'exclusion de la base — et décliner la libère. Dans les deux
cas, le professionnel est prévenu : une réponse qui dormirait en base reviendrait à ne pas
l'avoir demandée.

L'asymétrie de l'écran client est voulue : **accepter demande une confirmation, décliner non**.
Accepter engage le client à être chez lui ; décliner ne l'engage à rien et libère le créneau
pour quelqu'un d'autre. Mettre un garde-fou devant le geste sans conséquence ferait hésiter là
où il ne faut pas — et un client qui hésite à décliner ne répond pas du tout.

### Un conflit que mon propre commentaire a révélé

J'avais écrit, dans le code de l'annulation : « la plage est libérée ». Et un test affirmait
« annulé n'est pas effacé ». Les deux ne pouvaient pas être vrais : supprimer le créneau
emportait le rendez-vous en cascade.

C'est le commentaire qui avait raison. Un rendez-vous annulé est une trace — le client s'était
engagé, on lui a fait faux bond, et cela compte pour un litige comme pour les statistiques du
professionnel. La plage porte donc désormais sa propre annulation : elle cesse d'occuper son
horaire, la contrainte d'exclusion l'ignore, l'agenda ne la montre plus, et rien ne disparaît.

Le test qui a échoué ne disait pas « ce code est faux ». Il disait « ces deux affirmations se
contredisent, choisissez ».

### Ce que la capture a attrapé

« Sans réponse, ce créneau sera remis à disposition **le vendredi 30 octobre** » — pour un
rendez-vous du vendredi 30 octobre. Derrière la coïncidence, une vraie règle manquait : une
proposition ne peut pas survivre au créneau qu'elle propose. Promettre à un client qu'il a
jusqu'à samedi pour accepter un rendez-vous de vendredi n'a aucun sens.

L'échéance est maintenant bornée au début du créneau, et quand les deux coïncident la page
écrit « Répondez avant le début du rendez-vous » plutôt que de répéter une date.

### Un piège d'outillage

Le test d'intégration datait ses rendez-vous en mars 2026, en dur. Il passe par la route, qui
lit l'horloge réelle : toutes les propositions étaient expirées de plusieurs mois. **Un test
qui traverse une route ne peut pas figer le temps** — ses dates sont désormais relatives à
maintenant.

### La vérification

941 tests verts. Les 16 tests du parcours portent sur ce qui doit échouer : le lien qui ne
sert qu'une fois, celui qui porte une autre action, la proposition expirée, et le créneau pris
entretemps — où la contrainte d'exclusion fait son travail et où l'on préfère dire au client
que l'horaire n'est plus libre plutôt que de l'inscrire deux fois.

---

## Relancer une fois, rappeler deux

Le parcours du rendez-vous tenait debout mais restait muet dans le temps : une proposition
envoyée vivait quarante-huit heures sans que personne ne la rappelle, et un rendez-vous
confirmé arrivait sans prévenir. Deux travaux périodiques comblent les deux manques.

**La relance** part une fois, vingt-quatre heures après la proposition. Une fois, pas deux :
harceler quelqu'un qui ne répond pas ne le fait pas répondre, cela le fait bloquer
l'expéditeur. Elle ne part pas non plus sur une proposition déjà expirée — son créneau est
rendu, et réveiller le client pour un horaire perdu serait pire que le silence. La plage est
marquée relancée dès qu'**un seul** canal a servi : réessayer demain parce qu'un courriel
manquait reviendrait à relancer deux fois.

**Les rappels** partent la veille, puis deux heures avant. Leur objet n'est pas de convaincre
mais d'éviter le déplacement pour rien : un artisan qui sonne dans le vide a perdu sa matinée.
Ce travail tourne toutes les heures, et non la nuit comme les autres, parce qu'une fenêtre de
deux heures ne se rattrape pas d'une nuit sur l'autre ; il ne regarde que les trente heures à
venir, ce qui le rend bon marché.

Le lien de la relance est **neuf**. Le jeton d'origine n'a jamais été conservé en clair — c'est
tout l'intérêt de le hacher — donc on en crée un second. Les deux ouvrent la même page et le
premier expirera de lui-même.

### Un test qui dépendait de ses voisins

Les quatorze tests ont d'abord échoué sur un seul : le bilan annonçait deux rappels de veille
là où le test en attendait un. Le code était juste. La base de démonstration contient un
rendez-vous confirmé qui tombait dans la fenêtre des trente heures, et mes assertions
comptaient le bilan **global**.

D'où une règle : **un compteur global ne garde rien.** Un test qui lit un total mesure aussi
ses voisins — le semis, les autres fichiers, l'état laissé par la veille — et se brise le jour
où le voisinage change, sans que rien de ce qu'il protège ait bougé. Les assertions portent
désormais sur les effets observables des lignes du test lui-même : la plage est-elle marquée
relancée, ce rendez-vous a-t-il reçu son rappel, ces deux destinataires ont-ils leurs deux
messages. C'est plus étroit, et bien plus solide.

Le test avait laissé sa marque sur la donnée de démonstration — un `rappel_veille_le` posé sur
le rendez-vous de Plomberie Martin. Remis à zéro : une donnée de démonstration n'est pas un
bac à sable.

### La planification, vérifiée dans Redis

Le registre des travaux de nuit est énuméré en entier dans son test plutôt que compté : un
travail ajouté là sans planification dans le worker ne tournerait jamais, et personne ne le
verrait. Puis on a lu Redis après démarrage, parce que le câblage est exactement l'endroit où
le silence se cache :

```
bull:nuit:repeat:relances-rendez-vous:1793261700000   → 09:15 (Paris)
bull:nuit:repeat:rappels-rendez-vous:1793257500000    → 08:05 (Paris)
```

955 tests verts, porte de validation franchie. Aucun écran nouveau : ce travail n'a pas de
surface visible, les captures du parcours tiennent toujours.

---

## La facture, et ce que la loi exige d'elle

Le Renom calculait des factures depuis la phase 5 ; il n'en imprimait aucune. C'est la pièce
qui manquait, et elle n'est pas une mise en page : une facture incomplète n'est pas un document
mal présenté, c'est une infraction — jusqu'à 75 000 € pour une personne physique, 375 000 €
pour une société, plus 15 € par mention manquante et par facture au titre du CGI.

Trois partis pris ont décidé du reste.

**La page est le document.** Il n'y a pas une version à l'écran et une autre dans le PDF : le
PDF sera l'impression de cette page. C'est ce qui garantit qu'ils ne divergeront pas, et c'est
pourquoi la mise en page est en millimètres plutôt qu'en `rem`, et en noir sur blanc plutôt
qu'aux couleurs de la marque — le crème et l'or ne survivent pas à une photocopie.

**Rien de ce qui varie n'est écrit en dur.** Le taux des pénalités de retard suit le taux de
refinancement de la BCE et change chaque semestre. Faute de stipulation, le document imprime la
**formule légale** plutôt que le chiffre du jour : un taux périmé sur une facture est plus
dangereux qu'une formule, parce qu'il a l'air juste.

**Ce que nous ne savons pas, nous le réclamons.** La forme juridique, le numéro de TVA,
l'assurance, le médiateur : rien de cela n'est dans SIRENE. Plutôt que de le deviner ou de le
taire, `factureConforme` le déclare manquant, et un écran — « Mes documents » — existe pour le
remplir une fois pour toutes.

### Un contrôle qui réclamait l'impossible

La première version du contrôle rapportait neuf mentions manquantes sur une facture prête.
Quatre d'entre elles — le numéro, la date d'émission, celle de la prestation, l'échéance —
sont posées par l'**émission elle-même**. Les afficher en rouge revenait à demander au
professionnel de corriger ce qu'il ne pouvait pas corriger, et à noyer les cinq qui le
concernaient vraiment.

Le contrôle porte désormais sur la facture **telle qu'elle sera émise**. La question à laquelle
l'artisan a besoin d'une réponse n'est pas « cette facture est-elle complète maintenant ? »,
qui n'a pas de sens avant l'émission, mais « sera-t-elle en règle quand je l'émettrai ? ».

D'où une règle : **un contrôle ne doit signaler que ce que son lecteur peut changer.** Le reste
n'est pas de l'information, c'est du bruit — et le bruit fait fermer les avertissements sans
les lire, y compris les cinq qui comptaient.

Même raisonnement pour les marques « à compléter » sur le document : elles ne s'affichent
qu'avant l'émission. Après, elles demanderaient de modifier ce qui ne se modifie plus — et
surtout, elles s'imprimeraient en rouge sur l'exemplaire du client.

### Une règle juste qui devient un piège

Le design system interdit le défilement horizontal partout : `overflow-x: hidden` sur `html` et
sur `body`. C'est la bonne règle pour un site qui se lit au pouce, et elle a protégé cinquante
écrans.

Sur le document, elle rendait **la moitié droite de la facture inatteignable sur un
téléphone** : le titre, le numéro, les dates, tous les montants. Pas rognés avec une barre de
défilement pour le dire — simplement coupés, en silence. Le professionnel aurait consulté sa
propre facture sans jamais voir ce qu'il demandait à son client de payer.

Le défaut a failli passer. La première capture à 390 px montrait un document apparemment net,
et le script ne signalait aucun débordement : le conteneur intérieur défilait, donc la page,
elle, ne débordait pas. Un contrôle qui mesure la page ne voit pas ce qu'un `overflow`
intérieur cache.

Deux corrections. C'est la **page** qui défile désormais, de sorte qu'une capture pleine page
photographie tout le document. Et l'exception à la règle du design system est **nominative** :
elle se déclare page par page dans le script de captures, elle ne se devine pas — une règle de
vérification qu'on peut désactiver par inadvertance ne vérifie plus rien.

### Une facture d'acompte qui avait l'air fausse

La capture de la facture d'acompte annonçait « Total TTC 1 234,20 € » puis « Net à payer
370,26 € », sans un mot entre les deux. Un client lit cela comme une erreur, et il appelle. Le
document dit maintenant « Acompte à régler », et une ligne ajoute que le solde fera l'objet
d'une facture à l'achèvement.

Rien de tout cela n'apparaît dans un test. Il a fallu regarder.

### Ce qui reste

Le PDF n'est pas produit par le serveur : le bouton ouvre la boîte d'impression du navigateur.
Cela suffit au professionnel qui veut un fichier, pas à l'envoi d'une facture en pièce jointe.
Factur-X non plus — les colonnes existent, le XML manque. Les deux dépendent d'un Chromium dans
l'image de déploiement, et c'est un coût qu'on pose les yeux ouverts plutôt que de reconstruire
le document avec une bibliothèque de PDF, ce qui créerait la seconde mise en page qu'on vient
justement d'éviter.

La liste des mentions, enfin, **n'a pas été validée par un juriste**. Elle est établie d'après
les textes et probablement juste ; « probablement » n'est pas le mot qu'on veut ici. Voir
`QUESTIONS.md` §Q35, ouverte en rouge.

985 tests verts, porte de validation franchie, six captures à 390 et 1440 px.

---

## Le devis et l'avoir, et ce qu'on voit en regardant

La facture imprimable tenait. Le devis et l'avoir suivent, avec le même assemblage et le même
composant — un seul document, trois types. Le devis porte en plus ses mentions propres, celles
de l'arrêté du 24 janvier 2017 sur le dépannage à domicile : frais de déplacement **même nuls**,
durée de validité, caractère gratuit ou payant, sort des pièces remplacées. `devisConforme` les
vérifiait déjà avant l'envoi ; elles s'impriment enfin. Vérifier sans imprimer n'avait protégé
personne.

### Relire n'est pas agir

Le devis est le document que le **client** garde : il le compare, le montre, le ressort six
mois plus tard. Or son lien est à usage unique, et il se ferme à la signature. Un client ayant
signé n'aurait plus pu relire ce qu'il avait signé.

D'où `resoudLienPourLecture`, à côté de `resoudLien` : elle rend la cible d'un lien même
consommé, et **jamais** après expiration. _Ne plus pouvoir agir_ n'est pas _ne plus pouvoir
lire_ — et lui refuser l'accès au motif qu'il a signé aurait été la plus absurde des sécurités :
on l'aurait protégé de son propre document. Cela répond au passage à une question laissée
ouverte en Q31 : non, il n'y a pas besoin d'un second lien en lecture seule après l'acceptation.

Le paquet `@lerenom/liens` n'avait **aucun test**, alors qu'il tient toute l'action sans mot de
passe : signer un devis, accepter un rendez-vous, déposer un avis. Il en a neuf maintenant, à
commencer par celui qui garde la règle la plus facile à casser par inadvertance — un lien à
usage unique ne sert qu'une fois — et par celui qui garde la seule borne que la lecture
conserve : l'expiration.

### Un avoir qui héritait d'une facture

La capture de l'avoir montrait ceci : un tableau de lignes vide avec « Aucune ligne chiffrée »,
un « Total HT 0 € » posé au-dessus d'un « Total TTC 45 € », une échéance à blanc, et un
paragraphe réclamant **des pénalités de retard et quarante euros de frais de recouvrement** —
sur un document où c'est l'artisan qui doit de l'argent à son client.

Rien de cela n'était un bogue. Chaque ligne faisait ce qu'on lui demandait ; c'est l'héritage
silencieux de la mise en page de la facture qui produisait l'absurdité. Un avoir ne détaille
rien — le détail est sur la facture qu'il corrige, et le recopier créerait deux versions d'un
même décompte —, ne vient pas à échéance, et ne réclame rien.

D'où une règle : **réutiliser une mise en page, ce n'est pas réutiliser un document.** Trois
documents qui partagent un composant partagent une apparence, pas une signification ; et la
signification, elle, se vérifie en regardant, pas en compilant.

Trois autres détails sont sortis de la même façon : « Facturé à » sur un devis, qui n'est pas
facturé mais établi ; « Net à payer » sur un devis, qui n'appelle aucun paiement ; et
« Émise le » là où un devis est établi. Aucun n'aurait jamais fait échouer un test.

### La vérification

994 tests verts, porte de validation franchie, douze captures à 390 et 1440 px — devis du
professionnel, devis reçu par le client, facture prête, facture émise, avoir, et l'écran de
réglages qui les alimente tous.

---

## Factur-X, et ce que la donnée réelle a révélé

Une facture électronique au sens de la réforme n'est pas un PDF envoyé par courriel : c'est un
PDF **qui porte en pièce jointe** un XML structuré, de sorte que le même fichier se lise à
l'œil et se traite sans intervention humaine. Le XML existe maintenant ; son incorporation au
PDF reste liée à la génération serveur.

**Le profil est BASIC WL**, et le choix s'explique en une phrase : MINIMUM ne porte ni
ventilation de TVA ni échéance — c'est un profil d'export comptable, pas une facture —, BASIC
et EN 16931 exigent le détail ligne à ligne, que nos factures possèdent mais dont la mise en
correspondance ouvre une surface d'erreur sans contrepartie immédiate. BASIC WL est **le
profil le plus riche que nous puissions remplir sans rien inventer**.

**La structure n'a pas été écrite de mémoire.** Les sources secondaires se contredisaient — six
champs obligatoires pour l'une, sept pour une autre, dix pour une troisième. Un exemplaire de
référence du profil a tranché. L'ordre des éléments est imposé par le schéma : un élément
correct au mauvais endroit rend le document invalide, et rien dans le code ne le signale — deux
tests le gardent, qui lisent l'ordre réel des enfants plutôt que le texte.

### Deux défauts que les tests ne pouvaient pas voir

Les deux sont sortis en **regardant le XML produit**, le premier sur une facture fabriquée, le
second sur une vraie.

**La remise était rattachée en bloc au premier taux.** Dans le modèle CII, une réduction
appartient à une catégorie et à un taux ; l'attacher entière au premier contredisait les bases
de TVA déclarées trois lignes plus haut, que `calculeTotaux` avait déjà réduites chacune de sa
part. Un destinataire qui recalcule aurait vu la contradiction sans pouvoir dire laquelle des
deux déclarations croire. Elle est désormais ventilée, la dernière part absorbant l'arrondi.

**La facture d'acompte ne bouclait pas.** Le XML annonçait un total général de 1 234,20 € et un
total dû de 370,26 €, sans rien entre les deux. La norme exige
`GrandTotal − Prepaid = DuePayable` — c'est la règle BR-CO-16 d'EN 16931 — et tout destinataire
qui vérifie aurait rejeté la facture.

La tentation était de déclarer la différence comme déjà payée : l'égalité se serait fermée, et
le document aurait menti, puisque rien n'avait été versé. Le XML est donc **ramené à ce que la
facture réclame vraiment**, avec sa propre base et sa propre TVA au prorata de chaque taux. Le
PDF continue de montrer le chantier entier : c'est ce que le client doit voir.

D'où une règle : **un document pour machine et un document pour humain peuvent montrer des
choses différentes, jamais des choses contradictoires.** Le PDF explique, le XML calcule ; ce
qu'ils affirment tous les deux doit concorder au centime.

### Ce que la vérification a coûté, et rapporté

Les tests **analysent** le XML au lieu d'y chercher des morceaux de chaîne. La différence n'est
pas cosmétique : un test qui cherche `<ram:GrandTotalAmount` passe encore quand la balise s'est
retrouvée au mauvais niveau, ou quand le document n'est plus bien formé. Un analyseur a donc
été ajouté aux dépendances de développement — c'est le prix d'un test qui vérifie ce que le
destinataire vérifiera.

Le fichier produit pour une vraie facture a ensuite été téléchargé par la route, analysé, et
relu. C'est là que le défaut de l'acompte est apparu : aucun test unitaire ne l'aurait montré,
parce qu'aucun ne fabriquait une facture d'acompte à partir de vraies données.

1 026 tests verts, porte de validation franchie.

---

## L'intégration continue a enfin tourné, et elle a trouvé quelque chose

Cinquante-trois exécutions depuis le premier commit, cinquante-trois échecs, chacun en deux à
trois secondes. Le journal notait « l'intégration continue n'a jamais tourné » sans en avoir
cherché la cause ; `scripts/verifie.sh` avait été écrit pour s'en passer.

La cause n'était pas dans le fichier de workflow. L'interface de GitHub ne la disait pas non
plus. C'est l'API qui l'a montrée : `runner_id: 0`, `runner_name: ""`, aucune étape, aucun
journal téléchargeable. **Aucune machine n'avait jamais été attribuée.** Le dépôt était privé
sur un compte gratuit, où les minutes d'Actions sont comptées ; le dépôt rendu public, les deux
travaux ont démarré à la première poussée.

### Ce qu'elle a trouvé en tournant une fois

Le travail « base » est passé entièrement, du premier coup : schéma, extensions PostGIS,
garde-fous SQL, semis, les comptes 1 285 / 18 / 69 / 479, les tests d'intégration de la cascade,
et le contrôle « les tests ne laissent aucune trace ». Sur une base neuve, et sans que rien n'y
ait jamais été éprouvé.

Le travail de lint, lui, a échoué sur un défaut vieux de cinquante-trois commits :
**`@lerenom/db:lint` tournait avant `@lerenom/db:build`.**

`dependsOn: ["^build"]` construit les **dépendances** d'un paquet. `@lerenom/db` n'en a aucune :
son propre `prisma generate` ne tournait donc jamais avant son lint ni son typecheck, alors que
ses sources importent le client généré. Soixante-seize erreurs « type qui ne peut être
résolu », sur une copie fraîche.

Pourquoi personne ne l'avait vu : en local, `packages/db/src/genere` traîne toujours d'une
construction précédente. `pnpm run lint` passait, la porte de validation était verte, et elle
avait raison sur la machine où elle tournait. Reproduit en effaçant le dossier généré et les
caches de Turbo — soixante-seize erreurs, à l'identique. Corrigé par deux surcharges nommées,
puis revérifié sur un arbre entièrement propre.

D'où une règle : **une porte de validation qui tourne toujours au même endroit ne vérifie que
cet endroit.** Elle avait raison sur ma machine et se taisait sur une copie fraîche — et une
copie fraîche, c'est exactement ce qu'est un déploiement.

Et une leçon sur le diagnostic : « l'intégration continue ne marche pas » a été consigné
pendant onze jours sans qu'on demande _pourquoi_. La réponse tenait dans un appel d'API, et
elle cachait un vrai défaut du dépôt.

---

## Rien ne partait

En préparant la génération du PDF côté serveur, une vérification de routine a donné ceci :

```
SELECT statut, count(*) FROM messages_sortants GROUP BY statut;
 en_attente | 286
```

Deux cent quatre-vingt-six messages, aucun envoyé, jamais. Le produit repose entièrement sur
eux — une demande distribuée prévient trois professionnels, un devis s'ouvre par un lien reçu,
un rendez-vous se propose et se rappelle par SMS — et tout cela s'écrivait en base sans jamais
en sortir. Le manque était consigné en trois endroits de `QUESTIONS.md`, chaque fois en passant,
jamais comme le trou qu'il est.

Le PDF a attendu. Une facture bien faite qu'aucun client ne reçoit vaut moins qu'un message qui
part.

### Ce qu'on ne peut pas faire, et ce qu'on peut

Raccorder un opérateur demande un compte et des clés : cela ne se fait pas depuis ce dépôt. Ce
qui manquait vraiment, en revanche, c'est la **pièce qui draine la file** — et elle, rien
n'empêchait de l'écrire.

Un expéditeur tourne maintenant toutes les minutes. C'est le seul travail dont le rythme se
mesure en minutes, et pour cause : une demande distribuée à 9 h 02 qui prévient les
professionnels la nuit suivante n'a prévenu personne.

Il remet chaque message à un `Fournisseur` — un nom, des canaux, une fonction qui envoie. Toute
la particularité d'un opérateur, ses clés, ses quotas, ses formats d'erreur, tient dans son
adaptateur. Le jour du choix, on écrit l'adaptateur et rien d'autre ne bouge.

**Sans fournisseur, l'expéditeur ne marque rien comme envoyé.** C'était la tentation : poser un
adaptateur « journal » qui écrit une ligne et passe le message à `envoye`. Cela aurait donné une
file vide, des compteurs verts, et aucun client prévenu. Un message marqué parti alors que
personne ne l'a reçu fait disparaître la seule preuve que rien ne fonctionne.

### Le garde-fou qui comptait plus que le reste

La file dort depuis des semaines. Le jour où un opérateur est raccordé, sans précaution, les
deux cent quatre-vingt-six partent **d'un coup** : des rappels pour des rendez-vous de la
semaine dernière, des créneaux rendus depuis longtemps, des propositions caduques. Un client ne
lit pas dix SMS périmés — il bloque l'expéditeur, et le canal est perdu.

Un message plus vieux que son délai est donc **abandonné, avec sa raison écrite**, et jamais
effacé. On peut lire en base exactement ce qui n'est pas parti et pourquoi.

D'où une règle : **une file qui attend n'est pas une file en retard.** Reprendre le travail là
où il s'est arrêté n'a de sens que si ce qu'on reprend a encore un objet ; sinon ce n'est pas
du rattrapage, c'est une avalanche.

### Le compteur global, une seconde fois

Les premiers tests attendaient `envoyes === 1` et en ont trouvé **cent quatre-vingt-dix** : le
fournisseur d'essai avait drainé toute la file de démonstration. Le code avait raison, le test
mesurait ses voisins — exactement l'erreur dont une règle avait déjà été tirée pour les rappels
de rendez-vous.

Qu'elle se reproduise dit quelque chose : une règle écrite dans le journal ne se transporte pas
toute seule au fichier suivant. Les assertions portent désormais sur les lignes du test, filtrées
par leur modèle. Et les deux cent quatre-vingt-six messages de démonstration, que le test avait
marqués envoyés, ont été remis en attente : une donnée de démonstration n'est pas un bac à sable.

### Ce que cela coûtera

Les deux canaux ne se ressemblent pas, et c'est une information économique, pas technique. Le
courriel a de vraies offres gratuites et permanentes, suffisantes pour démarrer. Le SMS n'a que
des crédits d'essai, puis un paiement au message — une charge variable proportionnelle au nombre
de demandes distribuées. Le cahier des charges fait pourtant du SMS le canal principal.

Consigné en `QUESTIONS.md` §Q36, en rouge : la durée de péremption, le choix du fournisseur, et
la question qu'il ouvre — peut-on ouvrir en courriel seul ?

---

## Le back-office s'ouvre, et il dit la vérité

Dix-sept modules en neuf univers sont prévus. Le premier existe : l'accueil, avec sa coquille,
sa connexion et son journal d'audit. C'est la phase 7, et elle ne dépend d'aucun service
extérieur — c'est précisément pourquoi elle passe devant le reste : toutes les décisions qui
s'accumulent dans `QUESTIONS.md` attendent quelqu'un qui puisse les prendre sans ouvrir `psql`.

**Les quatre indicateurs disent ce qui ne va pas.** La règle de mise en page du cahier des
charges en autorise quatre au maximum, et la contrainte a été utile : elle a forcé à choisir.
Le nombre d'entreprises inscrites est flatteur et n'appelle aucune décision ; les messages
bloqués, les demandes sans preneur, les contestations ouvertes et le catalogue non validé en
appellent une. C'est le seul critère qui a servi.

L'écran annonce donc, en rouge, que **trois cent onze messages attendent et que la plateforme
est muette**. Un back-office qui cacherait cela mentirait à celui qui le consulte chaque matin.

### La double authentification, et ce qu'elle coûte vraiment

Le cahier des charges l'impose sur le back-office, et il a raison : un compte y voit les
coordonnées de tous les clients. TOTP est implémenté ici plutôt qu'emprunté — non par goût de
réécrire, mais parce que ce n'est pas de la cryptographie : un compteur de trente secondes, un
HMAC-SHA1 que Node fournit, et une troncature décrite en six lignes dans la RFC 4226. Aucune
primitive n'est inventée.

La preuve que l'implémentation est juste ne vient pas de tests écrits contre elle — ils
passeraient aussi bien si elle parlait une langue à elle. Elle vient des **six vecteurs
officiels de la RFC 6238**, qui sont la seule façon de vérifier qu'on s'entendra avec le
téléphone de celui qui s'en servira.

**Le coût réel s'est manifesté tout de suite.** Le script de captures photographie chaque
écran à deux largeurs, donc se connecte deux fois, à quelques secondes d'intervalle — avec le
même code. Le second a été refusé. C'était la règle anti-rejeu, qui faisait exactement son
travail : un code ne sert qu'une fois, et tout pas antérieur est refusé ensuite. Le script
attend désormais la tranche suivante, comme le ferait quelqu'un devant son téléphone.

### Une copie d'une fonction de sécurité, et sa divergence immédiate

Le script de démonstration du back-office recopiait le hachage du mot de passe « pour ne pas
dépendre du paquet de sécurité ». Quatre segments au lieu de six, du base64 au lieu de
base64url, soixante-quatre octets au lieu de trente-deux : aucun mot de passe ne passait.

La copie n'a pas eu le temps de diverger — elle est née divergente. Elle a été remplacée par
un import, et celle que portait déjà le script de démonstration professionnel aussi : elle
était juste, et elle attendait son tour.

### Deux choses qui n'ont pas été attrapées par la porte de validation

**Un mauvais nom de colonne a passé le typecheck.** La page comptait les demandes sur `creeLe`,
qui n'existe pas sur ce modèle — c'est `deposeeLe`. TypeScript n'a rien dit ; la page a rendu
500 à la première ouverture. Compter depuis le dépôt est d'ailleurs le bon choix : un brouillon
jamais déposé n'a laissé personne en plan.

**Un test dépendait encore de son voisinage.** Celui de l'expéditeur créait un message et
attendait qu'il parte. Les trois cents messages de démonstration, plus anciens, remplissaient
le lot de deux cents avant lui : il n'y entrait jamais. Et le fournisseur d'essai, lui, les
envoyait tous.

Les tests mettent maintenant la file ambiante de côté et la remettent — en notant les
identifiants avant, pour restaurer ceux-là et pas d'autres. Une restauration qui dirait « tout
remettre en attente » écraserait l'état de lignes qu'on n'a pas touchées, et c'est le piège qui
avait déjà coûté les coordonnées de quatre arrondissements. Vérifié : trois cent cinq avant,
trois cent cinq après.

D'où une règle de plus : **tester un traitement global demande de lui donner un monde à lui.**
Un videur de file ne se teste pas dans la file des autres.

### Les huit autres univers

Leurs onglets sont **grisés, pas cliquables**. Les laisser actifs vers des pages absentes
donnerait huit impasses sur neuf, et une erreur 404 en anglais pour tout message. Un onglet
visiblement à venir se comprend ; un lien qui tombe fait douter du reste.

Le prochain est le Catalogue : c'est lui qui lève les cinq cent soixante-six validations en
attente.

---

## Le Catalogue, ou cinq cent soixante-six lignes que personne n'a confirmées

Dix-huit univers, soixante-neuf métiers, quatre cent soixante-dix-neuf prestations. Tous
**reconstruits** à partir du cahier des charges, faute des fichiers annoncés et jamais fournis
(§Q1). Tous marqués `aValider` depuis le premier jour. Et pendant ce temps, le site les
propose : un visiteur cherche « plaquiste » dans une liste que personne n'a relue.

C'est le deuxième module du back-office, et il vient tout de suite après l'accueil parce que
c'est lui qui lève le plus de décisions en attente.

### Trois refus, et ce qu'ils protègent

**Pas de bouton « tout valider ».** Il viderait le compteur sans que rien n'ait été lu — or ce
compteur est la seule trace de ce qui reste à faire. Le seul raccourci offert est par univers,
parce qu'on vient d'en parcourir le contenu : dix-huit gestes pour tout relire, ce qui est le
bon ordre de grandeur pour une décision qui engage le contenu du site. La validation d'un
univers passe par une transaction : le valider sans ses métiers laisserait un état que personne
n'a voulu, et qui se lirait comme « relu » alors qu'il ne l'est qu'à moitié.

**Pas de renommage de slug.** Il vit dans des adresses déjà indexées ; le changer casse des
liens sans prévenir. Il s'affiche — il sert à reconnaître une ligne — mais ne se modifie pas.

**Masquer n'est pas supprimer.** Un métier masqué quitte le site et garde ses prestations, ses
demandes passées et ses professionnels rattachés. Supprimer casserait des lignes qui font foi.

### Un commentaire qui mentait

Le fichier de route affirmait que le schéma de validation « n'accepte pas le slug du tout,
plutôt que de l'ignorer en silence ». C'était faux : **Zod retire les clés inconnues sans rien
dire**. Une requête portant un slug aurait été acceptée, le slug ignoré, et l'appelant aurait
cru l'avoir changé.

Le défaut n'est apparu qu'en essayant pour de vrai. Le refus que j'avais observé
— `{"erreur":"Rien à modifier."}` — ne venait pas d'un contrôle mais du hasard : le slug était
le seul champ envoyé, donc il ne restait rien à modifier. Glissé à côté d'un renommage
légitime, il serait passé.

Corrigé par `.strict()`, et vérifié dans l'autre sens : un renommage portant un slug est
maintenant refusé **en bloc**, et le nom ne change pas non plus. C'est la bonne forme du refus
— « je ne peux pas » plutôt que « j'ai fait semblant ».

D'où une règle : **un commentaire qui décrit une protection doit être éprouvé comme elle.** Le
mien décrivait une intention, pas un comportement, et il l'aurait décrite pendant des années.

### La vérification

Les écritures ont été exercées contre la vraie base : un renommage, une validation d'univers
— vingt-six lignes, un univers, trois métiers, vingt-deux prestations —, un slug refusé, un nom
vide refusé. Chaque écriture laisse sa trace au journal d'audit, avec l'état **avant** et après :
sans l'avant, on saurait qu'une valeur a changé sans plus savoir laquelle elle était, et c'est
exactement ce qu'on cherche six mois plus tard.

Le catalogue a ensuite été remis dans son état d'origine — dix-huit, soixante-neuf,
quatre cent soixante-dix-neuf à valider. Une donnée de référence n'est pas un bac à sable.

---

## Le centre de distribution, ou l'écran qui dit si le produit sert

Troisième module du back-office, et celui qui compte le plus : une demande déposée doit trouver
un professionnel, et tout le reste — les fiches, les avis, les devis, les factures — n'existe
que pour cela.

Trois files, une seule visible à la fois. **En cours** montre la cascade telle qu'elle est :
chaque professionnel sollicité, son tour, son rang, ce qu'il a fait, le temps qui lui reste.
**Sans preneur** montre les échecs — la seule liste qu'on espère vide. **À classer** montre les
demandes dont le classement automatique doute, en dessous de 0,70 de confiance.

Le détail se déplie **sur place**. Celui qui surveille la distribution passe d'une demande à
l'autre ; lui faire perdre sa liste à chaque coup d'œil le ferait renoncer à regarder.

Savoir qu'une demande est « en distribution » n'apprend rien. Savoir que trois plombiers l'ont
reçue il y a vingt-neuf heures, que le premier a ouvert puis refusé, et que les deux autres ont
laissé expirer, apprend tout — et c'est ce que la capture montre.

### Ce que le module ne fait pas, et pourquoi

Classer une demande ne la **redistribue pas**. Relancer automatiquement vers trois nouveaux
professionnels doublerait le dérangement — six pros pour un client — et la facture, puisque
chaque envoi se paie. L'écran le dit en toutes lettres plutôt que de le taire.

Le back-office **observe** donc la distribution sans pouvoir encore la corriger. C'est une
limite réelle, consignée en §Q37 avec les trois décisions qu'elle demande. Une action de
redistribution posée au jugé coûterait de l'argent à des professionnels qui n'ont rien demandé.

### Deux erreurs que le typecheck a laissées passer

C'est la deuxième fois dans la journée, et cette fois j'avais été prévenu.

**Un `orderBy` figé.** `as const` sur l'objet de sélection rend ses tableaux en lecture seule,
et Prisma les refuse. J'ai « corrigé » en remplaçant le tableau par un objet unique — le
typecheck est passé, et l'exécution a répondu : « Expected DistributionOrderByWithRelationInput[],
provided Object ». La bonne réponse était `satisfies Prisma.DemandeSelect`, qui garde les
littéraux sans figer les tableaux.

Deux fois de suite, donc, un code qui compile et qui tombe à la première ouverture. La leçon
n'est pas que TypeScript est faible : c'est que **le typage d'une requête n'est pas sa
validation**, et que la seule preuve qu'une requête marche est de la lancer.

### Trois défauts sortis de la capture

La donnée de démonstration en a révélé deux. La demande « sans preneur » apparaissait aussi
dans « à classer », faute de métier — or une demande sans preneur a forcément été classée,
c'est ce qui a permis de la distribuer. Et elle n'avait aucune distribution, donc l'écran
montrait une file vide là où il devait montrer une cascade entière. Les deux sont corrigées
dans le script de démonstration, pas à la main dans la base.

Le troisième était réel : à 390 px, le tableau de la cascade **poussait la page** — 416 px pour
une fenêtre de 390. Six colonnes ne tiennent pas sur un téléphone ; elles défilent maintenant
dans leur cadre, sans décaler le reste de l'écran.

### La vérification

Le classement a été exercé contre la vraie base : une demande classée, `classeeParAdmin` posé,
une clé inconnue refusée par le schéma strict, et le journal d'audit qui retient le métier
avant et après. La démonstration a ensuite été remise en état.

---

## Back-office · les professionnels

### La règle était écrite partout, et appliquée nulle part

Avant d'écrire l'écran, j'ai regardé ce que `verifiee` commandait réellement. Rien.

La règle existait en trois endroits : `inscription.ts` crée toute entreprise avec
`verifiee: false`, `QUESTIONS.md` §Q23 pose que la revendication est libre **parce que** la
vérification la rattrape, et l'inscription le dit au professionnel. Mais la cascade ne filtrait
que sur `suspendue`, `retireeLe`, le métier et la zone. Autrement dit : **n'importe qui pouvait
réclamer une fiche et recevoir, dans la minute, les coordonnées d'un vrai client.** La seule
chose qui empêchait l'incident, c'est que personne ne s'était inscrit.

Le trou est bouché avant l'écran, parce qu'il est plus grave que l'écran qui va le piloter.
`ProCandidat` porte maintenant `verifiee`, `RaisonExclusion` a gagné `non-verifiee`, et le
contrôle est placé **avant la note et avant la zone** — une fiche non vérifiée n'est pas un
mauvais candidat, c'est un candidat dont on ne sait rien, et l'écarter pour « note
insuffisante » dirait une chose fausse à qui lit le journal de la cascade.

> **Règle retenue** — _une règle écrite dans trois commentaires et zéro condition n'est pas une
> règle, c'est une intention._ Celle-ci a survécu à une revue, à des tests et à une page
> d'inscription qui la promettait au professionnel.

### L'écran

Trois files, une seule visible : à vérifier (la file de travail, les plus anciennes d'abord),
actives, écartées. La file d'attente ne couvre que les fiches **revendiquées** : l'annuaire
compte des milliers d'entreprises importées de SIRENE que personne n'a réclamées, et les y
mêler rendrait la file inutilisable. Une fiche non revendiquée n'attend rien de nous.

Quatre refus, tous pour la même raison — ce sont des gestes qui engagent quelqu'un d'autre :

- **Aucune suppression.** Une entreprise porte des demandes, des avis et des factures émises.
- **Aucune vérification en masse.** Vérifier, c'est regarder ; un bouton qui valide trente
  fiches ne vérifie rien. C'est la même règle que pour le catalogue, et elle coûte autant.
- **La suspension exige un motif d'au moins une phrase**, et le bouton reste inerte sans lui.
  Elle coupe les revenus de quelqu'un ; le motif part au journal d'audit, et c'est la seule
  chose qui expliquera la décision dans six mois — y compris à celui qui l'a prise.
- **La vérification est réservée au rôle `administrateur`.** Le support classe des demandes,
  c'est du tri ; il ne décide pas qui reçoit les coordonnées des clients.

« Retirer la vérification » existe à côté de « suspendre », et ce n'est pas un doublon : un
SIRET qu'on découvre radié doit pouvoir redescendre hors distribution sans qu'on ferme le
compte. Les deux gestes ne disent pas la même chose.

L'écran dit aussi ce que la vérification **ne** fera pas : une fiche sans métier déclaré porte
« même vérifiée, elle ne recevra rien », parce que la cascade ne peut la rapprocher d'aucune
demande. Le dire avant le clic évite de chercher ensuite pourquoi rien ne part.

### Ce que la capture a montré, et ce que j'ai laissé

Mes propres fiches de démonstration étaient revendiquées **sans aucun compte rattaché** — un
état que le produit ne peut pas produire, puisque c'est la revendication qui crée le compte.
L'étiquette « aucun compte » s'allumait donc sur une invention. Corrigé dans le script.

Elle s'allume encore sur six des sept entreprises du semis de base, et là je n'ai rien touché.
Le semis les crée `revendiquee: true` sans utilisateur ; leur en donner un ferait partir plus
de messages à chaque distribution et déplacerait les attentes de plusieurs tests. Le gain
serait cosmétique, le risque réel. L'étiquette ne ment pas : elle décrit exactement ce que
contient la base. C'est le semis qui est incohérent, et il le restera jusqu'à ce qu'on le
reprenne pour lui-même.

> **Règle retenue** — _corriger une donnée de démonstration pour faire taire un contrôle juste
> est le bon geste ; corriger le contrôle l'est rarement._

### Les captures

Trois captures ont échoué à la première série — confirmation d'intervention, dépôt d'avis,
annulation de suivi. Aucune ne tenait à l'écran du jour : ce sont des parcours à jeton à usage
unique, consommés par la série précédente. Resemés, les 114 clichés passent sans une erreur de
console ni un débordement. Le piège méritait d'être noté : **une capture qui échoue ne pointe
pas forcément l'écran qu'on vient d'écrire**, et conclure trop vite aurait fait chercher un
défaut là où il n'y en avait pas.

---

## Back-office · la confiance

### Deux trous, et ils se tenaient par la main

Même méthode qu'au module précédent : regarder ce que la règle commande vraiment avant
d'écrire l'écran. Deux choses manquaient.

**Aucun avis n'était jamais publié.** Le dépôt crée bien l'avis en `en_attente` et pose une
tâche `avis_a_moderer`. Rien, nulle part, ne lisait cette file. Un client pouvait écrire, son
avis était enregistré, et il n'apparaissait jamais. Du point de vue du client comme du
professionnel, la fonctionnalité n'existait pas — et elle était pourtant annoncée sur le site.

**La note moyenne n'était jamais recalculée.** `noteMoyenne` et `nombreAvis` ne valaient que
ce que le semis y avait mis. Or ce sont les deux chiffres affichés sur la fiche **et** ceux
que la cascade utilise pour classer : une note figée, c'est un classement fondé sur une
fiction. La publication les recalcule maintenant à partir des seuls avis publiés, dans la même
transaction que la publication — un recalcul qui peut échouer après coup laisserait une note
fausse sur une fiche vraie.

### Caviarder plutôt que refuser

`packages/core` portait déjà la règle, elle n'avait jamais servi : un avis contenant un numéro
de téléphone ne se refuse pas, il se publie **sans** le numéro, et le retrait est visible —
« [numéro retiré] ». L'auteur a pris la peine d'écrire, son avis compte, et il n'a
généralement pas voulu mal faire. Mais réécrire le propos de quelqu'un sans le dire serait
pire que ne rien publier.

L'écran en tire sa disposition : quand un retrait s'applique, le texte d'origine et l'aperçu
publié s'affichent **côte à côte**. Le relecteur doit voir ce qu'on lui a confié _et_ ce qui
sortira ; ne montrer que l'un reviendrait à lui faire signer sans lire. Quand rien n'est
retiré — le cas général — un seul texte s'affiche, parce qu'un doublon identique ferait croire
à une intervention qui n'a pas eu lieu.

Les signaux automatiques sont nommés comme des alertes, jamais comme des verdicts.
« Accusation grave » ne dit pas que l'avis est faux ; il dit qu'un humain doit le lire avant
qu'il engage la plateforme. Un écran de modération qui pré-juge fabrique des refus.

### Ce que l'écran refuse de faire

Deux files sont affichées et **pas** actionnables, et c'est écrit dessus.

Trancher une contestation engage un recrédit, donc une ligne de facturation : tant que la
facturation n'est pas branchée, accepter ici promettrait un remboursement que rien ne
verserait. L'écran les liste, signale celles qui ont dépassé les 48 heures promises — il y en
a — et s'arrête là. Un signalement DSA, lui, demande une décision motivée et un recours ouvert
à son auteur ; recueillir cela demande un écran à soi.

> **Règle retenue** — _afficher un problème qu'on ne sait pas encore résoudre vaut mieux que
> de le cacher, à condition de dire pourquoi on s'arrête._ Un bouton « accepter » qui ne
> rembourse rien serait pire que pas de bouton du tout.

### Éprouvé contre la base, pas contre le typeur

Après deux épisodes de code qui compile et tombe à la première ouverture, la publication a été
exercée par HTTP, avec une vraie session et le code TOTP : clé inconnue refusée en bloc, motif
de refus trop court refusé, publication, republication refusée, refus motivé accepté. Puis
vérification en base : note recalculée à 4,5 sur deux avis publiés — l'avis refusé exclu —,
texte d'origine intact, version caviardée à côté, et trois lignes au journal d'audit portant
l'avant, l'après et jusqu'à la nature du retrait.

Une erreur du test lui-même mérite d'être notée : le motif « trop court » que j'utilisais pour
éprouver la limite fait exactement dix caractères, soit la limite. Le contrôle passait, et
j'ai failli conclure qu'il ne fonctionnait pas. **Un test qui tombe pile sur la borne ne
teste pas la borne.**

### Une fuite trouvée en chemin

Cinquante-quatre tâches `avis_a_moderer` pointaient vers des avis supprimés : le script de
démonstration du suivi efface les avis à chaque passage, jamais leurs tâches. Bouché dans le
script, et les orphelines nettoyées. Elles ne se voyaient pas, parce que l'écran lit la table
des avis et non celle des tâches — mais une file de travail qui accumule des objets disparus
finit par n'être plus consultée du tout.

---

## Back-office · les réglages

### Une chaîne construite aux deux bouts, coupée au milieu

J'ai cru tenir un troisième trou de la même famille que les deux précédents, et j'avais à
moitié tort — ce qui vaut d'être écrit, parce que la moitié fausse aurait fini dans un message
de commit.

Ce que je pensais : « la table `parametres` n'est jamais écrite, le lecteur retombe toujours
sur les valeurs du code, la promesse est fausse ». Ce que la base a montré quand je l'ai
interrogée : une ligne existait déjà pour la clé que je venais de modifier, datée du 28
octobre, motif « Valeur initiale du 27 octobre 2026 ». **Le semis pose bien les vingt et une
clés.** La lecture existait, l'écriture initiale aussi.

Ce qui manquait vraiment est plus étroit, et suffit : **rien ne permettait de changer une
valeur** autrement qu'en SQL, à la main, sur la base de production. La promesse « un délai
changé par Arcel s'applique à la prochaine demande » tenait en théorie et demandait, en
pratique, une requête écrite par quelqu'un qui sait ce qu'il fait.

> **Règle retenue** — _une prémisse vérifiée à moitié se raconte en entier, et faux._ Deux
> minutes de requête ont séparé « rien n'écrit jamais » de « rien ne permet de changer ».

### Huit réglages, pas quarante

`Parametres` compte une quarantaine de champs. La table en contient vingt et un. La
distribution en relit **huit**. L'écran n'affiche que ces huit-là.

C'est le choix qui structure le module. Montrer les treize autres donnerait un écran où l'on
change une valeur et où rien ne bouge — le pire des écrans de réglages, parce qu'on n'en
découvre l'inutilité qu'après avoir compté dessus. L'écart est consigné en Q39 : la table
contient aujourd'hui deux choses de nature différente sous la même forme, et c'est cela qui
finira par tromper quelqu'un.

### Ce que chaque réglage porte

Des bornes, qui refusent au lieu de conseiller. Un nombre de professionnels par demande à
10 000 n'est pas une faute de frappe qu'on rattrape ensuite : c'est une facture envoyée à des
entreprises qui n'ont rien demandé. Éprouvé : 9 000 refusé, 2,5 refusé sur un réglage entier,
clé inventée refusée, clé en trop refusée en bloc, motif court refusé, et valeur déjà en
vigueur refusée aussi — réécrire une ligne identique salirait l'historique sans rien changer.

Un motif obligatoire, parce qu'un délai de cascade modifie les revenus de toutes les
entreprises inscrites.

Et la valeur par défaut du code, affichée **à côté** de la valeur en vigueur. Sans elle, on ne
sait pas si 120 minutes est un choix ou un héritage, et on hésite à y toucher pour la mauvaise
raison.

### Rien n'est écrasé

Changer un réglage **ferme** la ligne en vigueur et en ouvre une nouvelle, dans une
transaction : deux lignes ouvertes sur la même clé rendraient le réglage indéterminé, aucune
le ferait retomber en silence sur le défaut du code. Deux façons différentes de ne plus savoir
ce qui s'applique.

Vérifié de bout en bout : réglage posé par HTTP, puis `parametresEnVigueur()` appelé depuis
`packages/distribution` — 90 au lieu de 120. La chaîne tient. La valeur d'essai a ensuite été
remise à 120, par le même chemin, et l'historique garde les deux passages.

### Le journal, et un détail de rédaction

Le troisième onglet montre les cinquante dernières écritures du back-office avec leur avant et
leur après. Il n'a aucun bouton, et c'est tout son intérêt : un journal qu'on peut corriger ne
prouve rien.

Les lignes posées par le semis n'ont pas d'auteur. L'écran affichait « réglé le 28/10/2026 par
inconnu » — ce qui laisse croire à une trace perdue, alors que personne n'a jamais touché à la
valeur. Elles disent maintenant « valeur initiale, jamais modifiée depuis ». La différence
entre « on ne sait plus qui » et « personne » n'est pas un détail sur un écran d'audit.

---

## Phase 5 · la facture en un seul fichier

### Deux moitiés ne font pas une facture électronique

Le professionnel disposait d'une page imprimable qu'il devait imprimer lui-même, et d'un XML à
télécharger à part. C'est exactement ce que Factur-X existe pour éviter : **une facture
électronique est un seul fichier**, lisible par un humain et exploitable par une machine. Deux
fichiers séparés demandent au destinataire de les rapprocher, et il ne le fera pas.

Trois choses sont nécessaires pour qu'un logiciel comptable reconnaisse le fichier, et aucune
ne suffit seule : le XML joint sous le nom `factur-x.xml`, imposé par la norme ; la relation
`/Alternative`, qui dit que la pièce jointe n'est pas un supplément mais une autre expression
du même document ; et les métadonnées XMP, que le logiciel interroge _avant_ d'ouvrir quoi que
ce soit. `pdf-lib` écrit `/Unspecified` par défaut — ce qui vide l'opération de son sens.

### Un seul gabarit, et ce qu'il coûte

Le PDF est rendu à partir de la page que le professionnel voit déjà. L'autre voie — redessiner
la facture avec une bibliothèque PDF — donnerait un fichier plus léger à produire et **deux
mises en page à maintenir**. Elles divergeraient, et la divergence se verrait le jour où un
client comparerait le document reçu à celui qu'il avait à l'écran. Une facture est une pièce
qui fait foi ; elle n'a pas deux versions.

Le prix est un navigateur sur le serveur, et il n'y en a pas en production. La route renvoie
alors un 503 avec une phrase en français et la marche à suivre, plutôt qu'une erreur
technique. Éprouvé dans les deux sens : avec un Chromium, un PDF de 192 ko ; avec un chemin
inexistant, le message et rien d'autre. Installer Chromium dans l'image d'un site en ligne
n'est pas une décision que je prends seul — consignée en Q40.

### Le contrôle qui ne pouvait pas échouer

Le moment utile de ce module. J'avais écrit un contrôle qui cherchait `factur-x.xml` dans les
octets du PDF et le trouvait. Il passait. Deux tests sur six échouaient pourtant — la
relation `/Alternative` et le contenu du XML, introuvables en recherche de texte.

En inspectant la structure réelle, l'explication : le nom d'une pièce jointe est écrit en
UTF-16 gros-boutiste, `<FEFF006600610063...>`, et son contenu vit dans un flux compressé.
Rien de tout cela n'apparaît en clair. **Mon contrôle « nom présent » ne trouvait pas la pièce
jointe : il trouvait le nom cité dans les métadonnées XMP.** Il aurait donc passé sur un PDF
sans aucune pièce jointe — c'est-à-dire exactement sur le défaut qu'il existait pour attraper.

Le contrôle lit maintenant la structure : table `EmbeddedFiles`, nom décodé, relation,
contenu décompressé. Et un test de plus, qui vérifie qu'il **échoue** sur un PDF sans pièce
jointe.

> **Règle retenue** — _un contrôle qui ne peut pas échouer ne vérifie rien._ Celui-ci passait
> pour une coïncidence de chaîne de caractères, et deux autres tests l'ont démasqué.

### Vérifié sur une vraie facture

Pas sur un PDF de test : la facture d'acompte FA-2026-0001 de la démonstration, demandée par
HTTP avec une vraie session. Pièce jointe `factur-x.xml`, relation `Alternative`, XMP
déclarant l'extension, 4 631 caractères de XML portant le bon numéro — et, rendue en image,
une facture A4 complète avec ses mentions légales, son acompte expliqué et son IBAN figé.

Une facture sans numéro est refusée net : la règle BR-02 d'EN 16931 l'exige, et l'article
L441-9 du code de commerce avant elle. Produire le fichier quand même donnerait une pièce que
le destinataire ne pourra pas comptabiliser.

---

## Back-office · Premium et Exclusif

### On distribuait gratuitement ce qu'on vend à l'unité

Avant l'écran, la même question qu'aux modules précédents : qu'est-ce qui commande réellement
quoi ? Et la même réponse gênante.

Ce que Le Renom vend n'est pas un abonnement, c'est **une place, sur un métier, dans une
ville** : un Exclusif et six Premium par zone. La table `Emplacement` existe pour cela, elle
est semée, et la requête de la page de résultats la **charge déjà**. Elle ne s'en sert pas.
Le classement lisait la formule de l'**abonnement** — c'est-à-dire que tout Premium occupait
une place sponsorisée dans toutes les villes et tous les métiers où il était référencé.

La rareté est le produit. Sans elle l'abonnement ne vaut rien, et le plafond de six par
métier × ville ne tenait plus — il n'était contrôlé nulle part puisque rien ne lisait la
table. Un seul abonnement achetait la visibilité partout.

Corrigé dans `donnees.ts` : la formule de classement vient de l'emplacement détenu **sur cette
page**, et l'abonnement reste la condition — un emplacement dont l'abonnement est résilié ne
place plus personne. Les deux doivent être vrais, et chacun pour sa raison.

Vérifié sur deux pages réelles, avant d'écrire l'écran. Plombier × Paris 11, où les trois
payants ont acheté : ordre inchangé, trois sponsorisés. Plombier × Montreuil, où deux d'entre
eux sont référencés sans avoir rien acheté : plus aucun sponsorisé, classement naturel pour
tous. C'est exactement la différence que la correction devait produire, et elle ne se voyait
sur aucune page tant qu'on regardait la seule zone cohérente du semis.

> **Règle retenue** — _une donnée chargée par une requête et jamais lue dans le résultat est
> le signe d'une règle qu'on a eu l'intention d'appliquer._ Le `include` était là ; c'est le
> `map` qui l'oubliait.

### Vendre et afficher ne sont pas le même nombre

Le schéma dit « jamais plus de 3 par page : 1 Exclusif et 2 Premium » ; les règles validées
disent six Premium par métier × ville. Les deux sont vrais et ne parlent pas de la même chose :
**six se vendent, deux s'affichent**, et les six tournent sur les deux places. Chacun obtient
alors un tiers des affichages, ce qui est exactement ce qui lui est annoncé.

L'écran sépare les deux chiffres, parce qu'on les confond et que la confusion a un coût
commercial : vendre une septième place ne diluerait pas « un peu » la valeur des six autres,
elle la réduirait d'un septième pour chacun, sans que personne l'ait accepté.

Un détail de rédaction corrigé sur la capture : la phrase sur la rotation s'affichait même
quand il n'y en avait pas — « deux s'affichent à la fois, soit 100 % des affichages » se lit
comme une contradiction et fait douter du chiffre au lieu de l'expliquer. Elle n'apparaît plus
qu'au-delà de deux vendus.

Et j'ai recopié `2` en dur dans le composant avant de me reprendre : c'est le paramètre
`emplacementsPremium`, il descend maintenant du serveur. Écrire la veille qu'une valeur
recopiée est une divergence à retardement n'empêche pas de la recopier le lendemain.

### Ce que l'écran refuse de faire

Il ne vend pas. Attribuer une place engage une facture, un prélèvement et douze mois
d'engagement pour l'Exclusif ; tant que rien n'encaisse, le bouton donnerait une place sans
contrepartie et un abonné qui se croit facturé. Même règle qu'aux contestations, et pour la
même raison.

Deux tables restent entièrement mortes, consignées en Q41 : `FactureLeRenom` — Le Renom ne
facture personne, pas même en brouillon — et `ListeAttente`, que rien ne lit ni n'écrit. Cette
seconde absence est la plus coûteuse : quand une zone est complète, rien ne recueille la
demande qui se présente, et c'est précisément le moment où la rareté vaut quelque chose.

---

## Monétisation · la liste d'attente

### La seule brique de la vente qui ne demande ni clé ni décision

`ListeAttente` était en base depuis le premier jour, lue et écrite par rien. C'est pourtant la
pièce qui manquait le plus : quand une zone est complète, le professionnel qui veut y entrer
n'avait aucun moyen de le dire, et Le Renom aucun moyen de le savoir. Or c'est exactement le
moment où la rareté qu'on vend devient mesurable — quatre plombiers qui attendent une place à
Montreuil en disent plus long qu'un tableau de recettes.

Et c'est la seule brique de la monétisation qui ne demande ni clé Stripe ni arbitrage : une
inscription ne facture rien et n'engage personne.

### Quatre refus, et celui qui coûte un client

Les règles vivent dans `packages/core`, testées sans base — seize tests. Quatre refus, et
chacun protège d'une promesse creuse : place libre, déjà détenteur, déjà inscrit, formule sans
emplacement.

Le plus important est **place libre**, et un test vérifie qu'il passe _avant_ « déjà
inscrit ». À quelqu'un qui est sur une liste devenue inutile, on dit que la place est libre —
c'est l'information qui lui sert — et non qu'il est déjà inscrit. L'ordre des contrôles est
ici une décision de rédaction autant que de logique : se tromper d'ordre ferait patienter
quelqu'un qui pouvait entrer tout de suite, et c'est le seul de ces refus qui coûte un client.

Un cas qui ressemble à un refus et n'en est pas : un Premium en place peut s'inscrire pour
l'Exclusif de la même zone. Ce n'est pas la même place.

### Ce qui n'est pas automatique, et pourquoi

La place qui se libère n'est pas attribuée d'office : le premier de la liste est prévenu, et
il décide. Attribuer automatiquement créerait un abonnement que personne n'a confirmé — pour
l'Exclusif, douze mois d'engagement signés par un silence. Et on ne prévient que le premier :
prévenir tout le monde transformerait la liste en course, où le plus rapide gagne et où
l'ordre d'arrivée ne vaut plus rien.

Les rangs se resserrent à chaque départ. Sans cela, une liste de six finit par afficher 1, 4,
5 et 9 : exact dans l'ordre, absurde à lire, et impossible à annoncer à qui demande sa
position. Vérifié en base : trois inscrits, le premier part, il reste 1 et 2.

### Le périmètre se vérifie, il ne se propose pas

L'écran ne montre que les zones du périmètre du professionnel. La route le **revérifie** :
une requête forgée inscrirait sinon une entreprise sur une zone où elle n'intervient pas, et
la liste cesserait de mesurer ce qu'elle prétend mesurer. Éprouvé par HTTP — et la première
tentative a échoué pour une mauvaise raison, la commune que j'avais choisie comme « extérieure
au périmètre » en faisait partie. Reprise avec Paris 1er, le refus est bien celui attendu.

### Un semis qui n'ajoutait que

La zone saturée de démonstration a été posée deux fois, et la seconde a laissé sept détenteurs
sur six places : le script ajoutait sans jamais retirer. Il efface maintenant ce qui ne doit
plus être là. **Un semis doit converger vers l'état voulu, pas seulement l'approcher** — sinon
il finit par afficher un état que le produit ne peut pas produire, avec l'autorité d'une
donnée réelle.

Autre correction venue de la capture : le compte de démonstration détenait une place dans la
seule zone complète, et son écran n'affichait donc jamais le bouton d'inscription — tout
l'objet de la page. Il en est maintenant exclu à dessein, et le commentaire le dit pour que
personne ne « corrige » l'anomalie apparente.

### La base perdue, et retrouvée

Au milieu de ce module, Postgres s'est arrêté. Je l'ai relancé par le service système, et
l'application est repartie — sur une **autre** base : sept entreprises au lieu de dix, aucun
avis, aucun journal d'audit. Deux répertoires de données coexistent sur la machine, et le
service système n'ouvre pas celui du projet.

Le signe qui a mis la puce à l'oreille n'était pas l'absence de données, qu'on peut toujours
mettre sur le compte d'un semis à refaire : c'est `prisma db push` réclamant une contrainte
d'unicité déjà posée la veille. **Une base qui a oublié une migration n'a pas perdu des
données : ce n'est pas la même base.** L'instance du projet a été relancée sur son propre
répertoire, et tout était intact.

---

## Croissance · mesurer avant d'afficher

### Trois tables vides, et pourquoi l'écran venait en second

`Affichage`, `Clic`, `Appel` : trois tables posées au premier jour, **écrites par rien**.
Poser l'écran « Croissance » dessus aurait donné trois zéros — pire que pas d'écran, parce
qu'on en déduit que personne ne vient alors que personne ne compte.

Et l'enjeu n'est pas la curiosité statistique. Un Premium paie 79 € par mois une place en
haut de page ; si rien ne compte combien de fois elle lui a été montrée, on ne peut ni lui
en rendre compte, ni justifier le prix, ni voir qu'une zone ne rapporte rien à celui qui
l'achète. La mesure a donc été écrite avant l'écran.

### Compter sans suivre les gens

Le modèle agrège sur `entreprise × métier × commune × jour`. Pas d'identifiant de visiteur,
pas d'adresse, pas d'horodatage à la seconde : on ne peut pas reconstituer un parcours à
partir de ces lignes, et c'est délibéré. Mesurer l'audience d'une fiche ne demande pas de
suivre quelqu'un.

Deux décisions de comptage valent d'être dites. **Les pages filtrées ne comptent pas** : un
filtre est une vue personnelle du visiteur, et additionner ses affichages à ceux de la page
publiée gonflerait les chiffres qu'on présente à l'abonné d'un trafic qu'il n'a pas eu. Et
**la mesure part après la réponse**, par `after()` : compter ne doit pas ralentir la page de
celui qui cherche un plombier, et un comptage qui échoue ne casse pas l'affichage.

Une seule requête pour toute la page, en `INSERT ... ON CONFLICT DO UPDATE`. Dix professionnels
affichés feraient dix allers-retours sur le chemin le plus fréquenté du site ; et l'incrément
SQL est atomique, là où un lire-puis-écrire perd un affichage sur deux visiteurs simultanés.
Les identifiants interpolés sont **refusés** s'ils ne ressemblent pas à des identifiants,
plutôt qu'échappés : un échappement qu'on croit correct est une supposition, un refus n'en
est pas une.

### Un contrôle qui ne pouvait rien signaler

Depuis plusieurs modules, je vérifiais les captures avec un petit script lisant
`rapport.json`. Il cherchait les clés `debordement` et `nom`. Elles s'appellent
`debordements`, `defilementHorizontal` et `page`. **Le contrôle ne lisait rien et annonçait
zéro défaut**, exactement comme le contrôle Factur-X qui trouvait un nom de fichier dans les
métadonnées au lieu de la pièce jointe.

Il n'a rien laissé passer — le script de captures imprime ses propres `✗`, et c'est lui qui a
signalé le défaut réel. Mais pendant plusieurs modules, j'ai lu « en défaut 0 » d'une source
qui n'aurait pas su dire autre chose.

> **Règle retenue** — _deux contrôles qui disent la même chose ne se valident pas l'un
> l'autre : il faut vérifier que chacun sait échouer._ Le script corrigé a immédiatement
> trouvé le débordement de quatre pixels du graphique jour par jour.

### Deux chiffres du même écran qui se contredisaient

La capture a montré la carte « Fiches ouvertes : 1 » au-dessus d'une ligne « 2 ouvertures ».
La carte filtrait les clics de type `fiche` ; la ligne du jour additionnait tous les types,
ouverture et téléphone confondus. Deux comptes portant le même nom, différents, sur le même
écran.

Corrigé en alignant la ligne du jour sur le même filtre. Ce n'est pas un détail d'affichage :
sur un tableau de bord, deux nombres qui devraient coïncider et ne coïncident pas ne font pas
douter de l'un des deux, ils font douter de tous les autres.

---

## Back-office · les finances, et le dernier onglet

### Un prévisionnel assumé, pas un chiffre d'affaires déguisé

`FactureLeRenom` est vide et le restera tant que rien n'encaisse. La tentation était de
titrer « chiffre d'affaires » sur la somme des abonnements : le chiffre aurait été juste et
le mot faux.

Ce que l'écran additionne est pourtant réel, et personne ne le regardait : les abonnements en
cours, dont le prix est une règle validée, et surtout **`QuotaMensuel.depenseHT`** — la
dépense hors forfait que la distribution accumule à chaque fois qu'un professionnel accepte
une demande au-delà de son forfait. C'est de la consommation vraie, enregistrée depuis le
début, jamais totalisée nulle part.

L'avertissement passe donc **avant** les chiffres, pas en note de bas de page. Un prévisionnel
lu comme une recette est un mensonge comptable, et celui qui le lit prendra des décisions
dessus.

Vérifié à la main contre la base avant de regarder la capture : 229 + 79 + 79 + 29 + 29 = 445
d'abonnements, 24 € de hors forfait, 469 € HT, 562,80 € TTC. L'écran affiche exactement cela.

Deux pièges évités en chemin. L'annuel se paie **dix mois pour douze** : le compter douze mois
pleins aurait gonflé le prévisionnel de 20 % sur chaque abonné annuel, et l'erreur ne se
serait vue qu'au moment de rapprocher les encaissements. Et les `Decimal` de Prisma
s'additionnent avec un `number` en produisant une **chaîne**, silencieusement : la conversion
est explicite.

### Neuf univers sur neuf

Le back-office est complet : Accueil, Demandes, Premium et Exclusif, Professionnels,
Catalogue, Finances, Croissance, Confiance, Réglages. Plus un seul onglet grisé.

Ce qui vaut d'être noté, ce n'est pas le compte : c'est que **sept de ces neuf écrans ont
commencé par révéler une règle écrite et jamais appliquée.** Une entreprise non vérifiée
recevait des demandes. Aucun avis n'était jamais publié. La note moyenne ne se recalculait
pas. Un Premium occupait une place sponsorisée partout au lieu de là où il l'avait achetée.
Aucun réglage ne pouvait changer sans déploiement. Rien ne comptait les affichages. Aucune
liste d'attente ne recueillait la demande sur les zones saturées.

Dans chaque cas, le modèle de données prévoyait la règle, un commentaire la décrivait, et
rien ne l'exécutait. Le back-office n'a pas seulement donné des écrans : il a obligé à
demander, pour chaque table, **qui la lit** — et c'est cette question-là qui a trouvé les
défauts, pas les écrans eux-mêmes.

> **Règle retenue** — _avant d'écrire l'écran qui pilote une donnée, chercher ce qu'elle
> commande déjà._ Sept fois sur neuf, la réponse était « rien », et l'écran aurait piloté un
> levier débranché.

### Note d'environnement

Postgres s'est arrêté trois fois pendant cette session, Redis une fois. Les deux sont des
incidents de la machine, pas du projet — mais le premier arrêt a coûté une fausse piste
entière, parce que le service système a relancé **une autre base** que celle du projet. Le
signe n'était pas l'absence de données : c'était une migration oubliée. Les relances sont
désormais scriptées.

---

## Phase 10 · le référencement technique

### Le défaut le plus coûteux : aucune adresse canonique

Audit avant travaux, comme pour les modules précédents. `robots.txt` et le plan du site
étaient soignés — adresse tirée de l'environnement, préproduction refusée, jeton de suivi
exclu. En revanche, **aucune page n'annonçait d'adresse canonique.**

C'est le manque le plus coûteux, et il vient de la nature du produit : un annuaire filtrable.
`?urgence=1`, `?tri=note`, `?dispo=1` servent la même page à quelques lignes près. Sans
canonique, un moteur découvre une dizaine d'adresses pour un seul contenu, répartit entre
elles le crédit de la page, et n'en indexe correctement aucune.

La canonique d'une page filtrée est donc la page **non** filtrée, et le helper retire les
paramètres de requête par construction — pas par convention d'appel.

### Une règle qui vivait dans le corps du document

Deux pages portaient leur `noindex` par une balise `<meta>` écrite dans le corps : la page de
résultats quand elle est filtrée ou trop maigre, la fiche quand elle ne contient que les
données SIRENE. Hors spécification ; ce qui le fait fonctionner aujourd'hui est la tolérance
des moteurs, pas une garantie.

En le déplaçant vers l'API de métadonnées, j'ai failli **perdre la moitié de la règle**. La
page de résultats a deux motifs de ne pas être indexée — filtrée, ou moins de trois
professionnels — et ma première version ne reprenait que le premier. Toutes les pages maigres
seraient redevenues indexables, sans que rien ne le signale : le balisage aurait disparu avec
la balise qui le portait.

> **Règle retenue** — _déplacer une règle, c'est d'abord l'énumérer._ Une condition écrite en
> un seul endroit se déplace entière ou pas du tout, et le nombre de ses motifs ne se devine
> pas à la lecture de la ligne qu'on déplace.

Les deux seuils vivent maintenant dans une constante partagée entre les métadonnées et le
corps de page : deux valeurs égales par hasard finissent par diverger, et la page annoncerait
alors l'inverse d'elle-même.

### Ce que le balisage refuse de dire

`LocalBusiness` sur les fiches, `ItemList` sur les résultats. Deux refus, de nature
différente.

**Une entreprise non diffusible n'est pas balisée du tout.** Le statut de diffusion SIRENE est
une obligation ; publier l'adresse d'une entreprise qui l'a refusée serait une faute, et la
publier en données structurées la rendrait en plus réutilisable par des tiers. On rend `null`
plutôt que de baliser à moitié.

**La note n'est publiée que s'il y a de vrais avis.** Un `aggregateRating` sans avis, ou avec
une note de repli, est une déclaration fausse adressée à un moteur de recherche. C'est
sanctionné, et ce serait mérité.

Et le balisage n'est publié que si la page l'est : décrire en données structurées une fiche
qu'on refuse d'indexer serait contradictoire.

### Le domaine en dur, revenu par la petite porte

Le site a une fonction `baseDuSite()` et un commentaire qui explique pourquoi l'adresse ne
doit jamais être écrite en dur — une préproduction qui annonce les adresses de la production
présente deux sites réclamant les mêmes pages. En vérifiant le HTML servi, le fil d'Ariane
publiait pourtant un `BreadcrumbList` pointant sur `https://lerenom.fr`, pendant que tout le
reste de la page suivait `LERENOM_URL`.

La centralisation avait été faite, le composant y avait échappé, et rien ne le voyait. Un
test parcourt désormais `app`, `composants` et `lib` à la recherche du domaine écrit en dur —
et **j'ai vérifié qu'il sait échouer** en réintroduisant le défaut un instant avant de le
retirer. Un garde-fou qu'on n'a pas vu refuser n'est pas un garde-fou.

Vérifié sur le site servi, avec `LERENOM_URL` pointant ailleurs : vingt-huit occurrences du
domaine, toutes celles de l'environnement, aucune de la production.

---

## Phase 10 · les images de partage

### Un rectangle gris là où passe le bouche-à-oreille

Le balisage désignait `/opengraph.png` ; le fichier n'existait pas. Une fiche collée dans une
conversation n'affichait donc ni titre, ni image — un rectangle gris et une adresse. C'est
pourtant par là que passent les recommandations entre voisins, qui sont le bouche-à-oreille
de ce métier.

Les images sont maintenant **générées par page** : la racine, la page métier × ville, la
fiche d'entreprise. Un seul gabarit les produit toutes. Trois images dessinées séparément
divergeraient à la première retouche de l'identité, et l'une d'elles resterait à l'ancienne
charte pendant des mois — on ne regarde jamais ses propres aperçus de partage.

L'image désignée dans les métadonnées a dû disparaître en même temps : elle l'aurait emporté
sur les fichiers générés, et la plus précise des deux aurait été ignorée.

### Ce que l'aperçu refuse de dire

La note n'apparaît sur une fiche **que si elle repose sur de vrais avis**. Le classement, lui,
retombe sur une note de repli quand une entreprise n'a pas d'historique — c'est légitime pour
ordonner une liste, et ce serait un mensonge sur une image de partage : on prêterait à une
entreprise une réputation qu'elle n'a pas encore, dans le format le plus recopié qui soit.

### Trois corrections, dont une de méthode

**Les `fontFamily` ne faisaient rien.** Le gabarit déclarait `serif` sur le titre et
`sans-serif` ailleurs ; le moteur n'a qu'une police intégrée et rendait tout à l'identique.
Les laisser aurait donné à lire un choix typographique qui n'existait pas.

**Le point doré était séparé du nom** par un écart de quatorze pixels : « Le Renom . » au lieu
de « Le Renom. ». Le point est la marque, pas une ponctuation qui suit le mot.

**Et mes deux premières corrections n'ont pas été appliquées.** Le fichier avait été reformaté
entre-temps, mes remplacements de texte ne correspondaient plus à rien, et ils ont échoué
**en silence** — faute d'assertion. J'ai rebâti, relancé, regardé l'image : identique, au
hachage près. C'est le même travers que les contrôles qui ne savent pas échouer, appliqué
cette fois à l'outil qui modifie le code.

> **Règle retenue** — _un remplacement de texte sans vérification que le motif existe n'est
> pas une modification, c'est un vœu._ Deux images rendues identiques l'ont prouvé mieux
> qu'une relecture.

Un dernier détail mérite d'être noté pour ce qu'il dit de la méthode : une espace trop large
suivait « professionnels » sur l'image. J'ai cru à une interpolation coupée en morceaux par
le moteur de rendu, corrigé en ce sens, et **l'image est revenue identique**. L'explication
était fausse. Le code garde la version plus lisible, et le commentaire dit ce qu'on sait —
que la cause est ailleurs — plutôt que ce qu'on avait supposé.

---

## Relecture · outiller la question qui a tout trouvé

### Sept défauts, une seule question

Le chantier du back-office a révélé sept règles écrites et jamais appliquées. À chaque fois,
le même motif : le modèle prévoyait la règle, un commentaire la décrivait, **et rien ne
l'exécutait**. Et à chaque fois, c'est la même question qui l'a trouvée, posée à la main :
_qui lit cette donnée ?_

Posée à la main, elle ne tient pas sur la durée — on cherche là où l'on travaille, pas là où
l'on a oublié. Elle est maintenant outillée : `node outils/tables-orphelines.mjs` parcourt le
schéma et dit, pour chaque table, qui la lit et qui l'écrit.

### Un outil qui s'est trompé trois fois avant de servir

Sa première version était inutilisable, et chaque correction mérite d'être notée parce qu'elle
dit comment on lit réellement une base avec Prisma.

**Les lectures par relation.** `include: { commune: true }` est une lecture, et l'outil ne
voyait que `prisma.commune.findMany`. Il déclarait donc `Commune` et `Departement` jamais
lues, alors que chaque page de résultats les lit.

**Les écritures en SQL brut.** `Affichage` est écrite par un `INSERT … ON CONFLICT` groupé, et
passait pour une table que rien n'alimente.

**Les écritures imbriquées.** `lignes: { create: … }` à l'intérieur d'un `facture.create` est
la façon idiomatique d'écrire des lignes filles. L'outil déclarait `FactureLigne` jamais
écrite — sur un produit de facturation. Le genre de conclusion qui fait perdre une heure,
puis la confiance qu'on accorde à l'outil.

Il a fallu y ajouter une quatrième distinction : le **référentiel** — communes, catalogue,
prix — est écrit par le semis et par lui seul, à dessein. Le confondre avec une table que le
produit devrait écrire noyait les vrais défauts sous une douzaine de faux.

> **Règle retenue** — _un outil d'audit se juge à son bruit autant qu'à ses trouvailles._
> Vingt-deux alertes dont dix-neuf fausses ne se lisent pas ; on les ignore, puis on ignore
> l'outil.

### Le refus que personne n'écoutait

La trouvaille, après ce dégrossissage : quand un professionnel refuse une demande en indiquant
**« ce n'est pas mon métier »**, la distribution crée une tâche de reclassement. Rien ne la
lisait.

C'est pourtant le meilleur signal de mauvais classement qui existe. La file « à classer » du
back-office montrait les demandes dont la machine doute — confiance sous 0,70, ou aucun métier
— mais pas celles qu'un artisan avait explicitement récusées. Or c'est exactement le cas où la
machine s'est trompée **avec assurance** : classement sûr de lui, et faux. La demande restait
mal classée et repartait à d'autres mauvais professionnels, qui la refusaient à leur tour.

Elle entre désormais dans la file, le signalement s'affiche avant le score de confiance — elle
doute, lui sait — et la tâche se referme au reclassement, sans quoi la demande resterait dans
la file après avoir été traitée.

### Deux scories

`dump.rdb`, un instantané Redis que le serveur local réécrit sans cesse, s'était glissé dans
un commit. Un binaire qui change à chaque sauvegarde pollue tous les diffs suivants. Retiré du
suivi et ignoré.

Et six tables ne sont ni lues ni écrites par quoi que ce soit — `Verification`, `Garantie`,
`Publication`, `Paiement`, `AlerteOuverture`, `Quartier`. Elles ne gênent personne, mais elles
donnent à lire un produit plus complet qu'il n'est. La question est posée en Q46 plutôt que
tranchée : les garder documente l'intention, les retirer dit la vérité.

---

## Le carnet de clients, et la facture sans destinataire

### Quatre maillons, chacun invisible seul

L'audit des tables orphelines avait laissé une piste : `ClientPro`, jamais créée par le
produit. En la tirant, une chaîne entière est venue.

Le code **vérifiait** qu'un client appartient bien à l'entreprise. Il en **listait** pour un
menu déroulant. Et rien, nulle part, n'en créait jamais. Pour un vrai professionnel, le menu
était donc toujours vide — un devis partait sans client, et la facture qui en naît aussi.

`factureConforme` repérait pourtant le manque : « Nom du client » figurait dans ses mentions
obligatoires. Mais la fonction ne servait qu'à afficher un avertissement sur le document
imprimable. **Rien ne l'appelait avant l'émission.** La facture recevait son numéro définitif,
devenait immuable, et n'était pas une facture au sens de l'article L441-9.

Chaque maillon, pris seul, se défend. Le menu vide passe pour un carnet neuf. L'avertissement
sur le document passe pour un rappel. Le contrôle existe et il est juste. C'est l'absence de
liaison entre eux qui fait le défaut, et c'est pourquoi aucun des quatre ne se voyait en
regardant le fichier où il vit.

> **Règle retenue** — _un contrôle qui n'est pas branché sur la décision qu'il protège n'est
> pas un contrôle, c'est un commentaire exécutable._

### Le refus, posé là où il engage

Le contrôle est appelé dans `emetFacture`, pas dans la route : c'est l'émission qui engage,
quel que soit le chemin par lequel on l'appelle. Et il nomme ce qui manque plutôt que de
refuser sèchement — « il manque nom du client, adresse de facturation du client » — parce
qu'une facture bloquée sans explication envoie chercher dans l'écran précédent.

Éprouvé dans les deux sens, contre la vraie base. Une facture fabriquée sans client : refusée,
avec la liste. Une facture complète : émise, numéro FA-2026-0002.

### Ce que la réparation m'a appris sur ma propre protection

L'épreuve a émis une facture de démonstration pour de bon. Pour remettre l'état d'avant, j'ai
voulu la supprimer — et **le déclencheur d'immuabilité l'a refusé**, suppression comprise :
« Une facture émise ne peut être ni modifiée ni supprimée : corrigez-la par un avoir. »

Il a fallu le lever le temps de la réparation, puis le reposer depuis son fichier SQL, qui en
est la référence. C'est le genre de vérification qu'on ne pense jamais à écrire : la
protection a été éprouvée par accident, sur une base de développement, et elle a tenu — y
compris contre celui qui l'avait écrite.

### Les tests émettaient des factures vides, et passaient

Le contrôle posé, dix-huit tests de facturation et dix-neuf tests d'avoirs sont tombés d'un
coup. Leur fixture ne créait qu'une entreprise nue : pas d'adresse, pas de forme juridique,
pas de client. Ils émettaient donc des factures **sans aucune mention obligatoire**, et
passaient — puisque rien ne vérifiait la conformité avant l'émission.

C'est la démonstration involontaire du défaut, et elle vaut mieux que mon raisonnement : une
suite verte prouvait qu'on pouvait émettre une facture à personne. Les fixtures décrivent
maintenant une entreprise réellement en état d'émettre, ce qui rend les tests plus proches de
ce qui se passe en production — et c'est tout le bénéfice.

La tentation était d'assouplir le contrôle pour que les tests repassent. Elle méritait d'être
nommée pour être écartée : des tests qui passent parce qu'on a baissé l'exigence ne testent
plus que l'exigence baissée.

### Ce que la saisie exige, et ce qu'elle laisse

Seul le nom est obligatoire. Un artisan qui prépare un devis dans sa camionnette n'a pas
toujours l'adresse ; la lui réclamer tout de suite le ferait renoncer au devis, pas chercher
l'adresse. L'écran signale les fiches incomplètes, et l'adresse redevient obligatoire à
l'émission — là où elle l'est vraiment.

Le SIREN est exigé des clients professionnels, et de ceux-là seulement : c'est une mention
obligatoire de la facture entre professionnels. Le contrôle est volontairement faible — neuf
chiffres, sans clé de Luhn. Refuser un SIREN valide à cause d'un contrôle trop zélé bloquerait
une facture légitime, ce qui coûte plus cher qu'un chiffre erroné.

Et le SIREN d'un client repassé en particulier est **effacé** plutôt que gardé : un numéro qui
ne le concerne plus n'a pas à traîner dans une base que la facture irait republier.

---

## Relecture · les routes, et deux audits devenus des portes

### Le silence qui valait une réponse

Même exercice qu'avec les tables, appliqué à l'autre bout de la chaîne : quelles routes
personne n'appelle, et quels appels ne mènent nulle part ? Le second cas est le plus grave
et le moins visible — un bouton qui échoue chez le visiteur pendant que tout compile.

Résultat, après dégrossissage : **zéro orpheline, zéro appel dans le vide.** Toute route
déclarée est appelée, tout appel atteint une route. C'est un résultat silencieux, et il vaut
d'être noté : la surface d'interface n'a ni code mort ni bouton cassé.

### Quatre faux positifs avant le premier vrai résultat

L'outil a d'abord annoncé seize routes mortes sur une quarantaine. Chaque correction dit
comment on appelle réellement une route depuis du code :

**Les gabarits.** Mon extraction s'arrêtait à l'accolade fermante de `${id}` — donc aucune
adresse construite dynamiquement n'était vue. Or une adresse d'interface sans partie variable
est l'exception, pas la règle.

**La chaîne de requête.** `/api/recherche?genre=…&q=…` ne correspondait à aucune route, et la
barre de recherche de l'accueil passait pour du code mort.

**Les parenthèses dans un gabarit.** `encodeURIComponent(texte)` tronquait l'adresse avant sa
fin. Corrigé en capturant jusqu'au guillemet de même nature, au lieu d'exclure une liste de
caractères — une exclusion devine ce qu'elle va rencontrer, une capture délimitée ne devine
rien.

**Et `'/api/'` tout court**, qui n'est pas un appel mais le préfixe interdit aux moteurs dans
le fichier robots.

> **Règle retenue** — _chaque outil d'audit que j'écris commence par sous-détecter, et la
> sous-détection se présente comme une trouvaille._ Il n'y a pas d'exception jusqu'ici : la
> discipline est de vérifier chaque alerte à la main avant d'y croire, et surtout avant de
> la rapporter.

### De rapport à porte

Les deux audits renvoient désormais un code de sortie non nul sur une orpheline **inattendue**,
et la porte de validation les joue. La dette connue est inscrite dans une liste d'attendus,
chaque entrée avec sa raison et le numéro de la question qui en dépend : neuf tables, chacune
correspondant à une fonctionnalité annoncée et non construite.

Inscrire cette dette n'est pas l'absoudre. C'est la différence entre « on sait, c'est écrit »
et « personne n'a remarqué » — et cela libère le contrôle pour ce qu'il sait faire : attraper
la **prochaine**.

Les deux portes ont été éprouvées à l'envers, comme il se doit. En retirant la raison d'une
table : code 1, la porte s'arrête. En détournant un `fetch` vers une adresse inventée : code
1 également, avec le nom de l'appel fautif. Une porte qu'on n'a pas vue refuser n'est pas une
porte.

Un dernier signe que l'outil suit la réalité : `TacheAValider`, orpheline hier, a disparu de
la liste — c'est la correction du refus « pas mon métier » qui l'a branchée.

---

## Phases 5 à 11 · à venir

Agenda et documents du pro, monétisation Stripe, back-office, personnalisation, avis et
modération, référencement technique. `packages/core` porte déjà l'essentiel de leurs règles,
testées : ces phases les branchent sur des écrans, sur la base et sur le worker.
