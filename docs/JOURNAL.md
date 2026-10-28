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

## Phases 5 à 11 · à venir

Agenda et documents du pro, monétisation Stripe, back-office, personnalisation, avis et
modération, référencement technique. `packages/core` porte déjà l'essentiel de leurs règles,
testées : ces phases les branchent sur des écrans, sur la base et sur le worker.
