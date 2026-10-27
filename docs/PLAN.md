# Le Renom — Plan de réalisation

> Rédigé en phase 0, avant toute ligne de code, après lecture intégrale du cahier des charges
> (prompt du 27 octobre 2026) et de l'étude de faisabilité « Le Renom, plateforme de
> référencement universelle ».
> Ce document est la référence d'architecture et de découpage. Il est mis à jour à chaque phase.

---

## 1. Ma compréhension du projet

**Le Renom** est un annuaire français universel doublé d'une place de marché de demandes de
devis et d'une régie de visibilité. Trois publics, trois produits, une seule base de données.

| Public | Ce qu'il fait | Ce qu'il paie |
|---|---|---|
| Particulier ou entreprise qui cherche | Trouve un pro par métier × ville, lit sa fiche et ses avis, demande jusqu'à 3 devis | Rien, et n'a **aucun compte** |
| Professionnel qui veut être trouvé | Revendique sa fiche, choisit ses métiers et ses villes, reçoit des demandes, édite devis et factures | Fiche gratuite ; formules Essentiel 29 € · Premium 79 € · Exclusif 229 € HT/mois, demandes à l'unité |
| Arcel (back-office) | Pilote la distribution, les emplacements, la modération, les finances, les règles | — |

**Le cœur de valeur** n'est ni l'annuaire ni le formulaire : c'est le **moteur de distribution**.
Une demande vérifiée par SMS est classée (univers › métier › prestation), rattachée à une commune
et à l'agence la plus proche, puis proposée en cascade — l'Exclusif seul 30 minutes, puis 1 à 2
Premium, puis les autres — à **3 professionnels au maximum, jamais plus, jamais après 72 heures**.
Chaque minuteur, chaque refus motivé, chaque acceptation définitive, chaque recrédit est une règle
métier écrite, testée et journalisée. Tout le reste du produit sert ce moteur ou en vit.

**Les deux lignes de séparation à ne jamais franchir**, parce que ce sont à la fois la loi et la
confiance :

1. **Argent et mérite ne se mélangent pas.** Les emplacements payés sont au maximum 3 par page,
   toujours étiquetés « Sponsorisé ». Tout le reste est classé par un score de qualité où le
   paiement ne compte pour rien. Les badges payants (PRO, Partenaire Premium, Partenaire Exclusif)
   disent qu'une offre est souscrite et rien d'autre ; les badges de mérite (vérifiée, très bien
   notée, répond en moins d'1 h) sont gratuits et calculés. Un badge payant présenté comme une
   garantie de qualité serait une pratique commerciale trompeuse.
2. **Le référencement ne se voit jamais.** Aucun bloc « pour Google », aucun JSON-LD exposé comme
   du contenu, aucune règle d'indexation visible sur le site public. Le module Référencement vit
   dans le back-office ; les données structurées sont des balises invisibles.

**Ce qui rend le projet difficile n'est pas la technique.** C'est la qualité réelle de chaque page
face aux règles anti-spam de Google (« tout importer, ne pas tout indexer »), la conformité
(DSA, avis en ligne L111-7-2, RGPD, facturation électronique), la marge mince sur une demande
achetée en publicité (environ 15 €, contre 12 € ou 9 € revendus hors forfait) et l'amorçage de la
place de marché. L'architecture doit rendre ces contraintes **mesurables dans le back-office**,
pas seulement respectées dans le code.

**Zone de lancement** : l'Île-de-France entière, 8 départements, 1 285 villes et arrondissements.
Les demandes de devis s'ouvrent ville par ville ; partout ailleurs l'annuaire est consultable et
le visiteur peut demander à être prévenu à l'ouverture.

---

## 2. Architecture retenue

### 2.1 Vue d'ensemble

```
                    ┌─────────────────────────────────────────┐
   SIRENE (Insee)   │  data/  scripts Python                  │
   BAN              │  import, statut de diffusion, géocodage │
   NAF 2025         │  correspondance NAF → métiers           │
   decoupage-admin  └──────────────────┬──────────────────────┘
                                       ▼
                         ┌──────────────────────────────┐
                         │  PostgreSQL 16 + PostGIS     │
                         │  (packages/db — Prisma)      │
                         └──────┬──────────────┬────────┘
                                │              │
             ┌──────────────────▼───┐   ┌──────▼──────────────────┐
             │ Meilisearch          │   │ Redis + BullMQ          │
             │ fiches, communes,    │   │ cascade, minuteurs,     │
             │ catalogue, scores    │   │ relances, imports       │
             └──────────────────┬───┘   └──────┬──────────────────┘
                                │              │
   ┌────────────────────────────▼──────────┐ ┌─▼──────────────────────────┐
   │ apps/web — Next.js (App Router)       │ │ apps/worker — Node/BullMQ  │
   │  lerenom.fr      site public          │ │  distribution, minuteurs,  │
   │  pro.lerenom.fr  espace pro           │ │  SMS/e-mails, scores,      │
   │  admin.lerenom.fr back-office         │ │  IndexNow, rapports        │
   └───────────────────┬───────────────────┘ └────────────────────────────┘
                       │
      packages/core  ──┤  règles métier pures, sans framework, testées
      packages/ui    ──┤  design system (tokens, composants, animations)
      packages/emails──┘  modèles SMS et e-mails
```

### 2.2 Choix techniques et leur justification

| Besoin | Choix | Pourquoi ce choix ici |
|---|---|---|
| Site public, espace pro, back-office | **Next.js 15, App Router, TypeScript** | Rendu serveur et ISR : chaque page arrive complète au robot. Un seul déploiement pour 3 sous-domaines via middleware |
| Hébergement web | **Vercel**, région `cdg1` (Paris) | Habitude d'Arcel, CDN mondial, ISR natif |
| Base de données | **PostgreSQL 16 + PostGIS** (Railway, Europe) | Facturation relationnelle fiable + recherche par distance et par zone sur 1 285 communes et des millions d'établissements |
| ORM | **Prisma** | Typage de bout en bout. Les colonnes `geography` et les requêtes de distance passent par `$queryRaw` typé, isolé dans `packages/db/src/geo.ts` |
| Recherche | **Meilisearch** | Tolérance aux fautes et aux accents indispensable (« plombie paris 11 », « canapé »), filtres géographiques, score de qualité pré-calculé stocké comme attribut de tri |
| Tâches de fond | **Redis + BullMQ**, worker Node | Chaque étape de la cascade est une tâche : envoi, minuteur 30 min / 2 h, passage au suivant, relance, expiration à 72 h |
| Traitements de données | **Python 3.13** (`data/`) | Import SIRENE (millions de lignes), nettoyage, géocodage BAN, baromètres |
| Fichiers | **S3-compatible** (Cloudflare R2) | Photos, logos, PDF. EXIF supprimé à l'envoi, sans exception |
| Paiements | **Stripe Billing** | Abonnements mensuels et annuels, prorata, demandes à l'unité, SEPA |
| SMS et e-mails | **Brevo** | Codes à 6 chiffres, notifications, messages au client |
| IA | API d'un modèle de langage | Classement des demandes (seuil de confiance 70 %), modération, aide à la rédaction |
| PDF | **Playwright** côté serveur | Le PDF est le rendu exact de l'aperçu à l'écran ; Factur-X pour les factures |
| Supervision | **Sentry** | Erreurs, performances, alertes |
| CDN et protection | **Cloudflare** | Robots abusifs, cache |

### 2.3 Organisation du dépôt

```
apps/
  web/            Next.js. Un seul projet, 3 sous-domaines via middleware :
                  (public) lerenom.fr · (pro) pro.lerenom.fr · (admin) admin.lerenom.fr
  worker/         Node + BullMQ : files de distribution, minuteurs, notifications,
                  imports, recalcul nocturne des scores, IndexNow, rapports
packages/
  db/             schéma Prisma, migrations, helpers géographiques, données de démo
  core/           RÈGLES MÉTIER PURES, zéro dépendance framework, couverture ≥ 90 % :
                  classement, rotation, score, cascade, quotas, facturation, zones,
                  garantie, devis/factures, IBAN, SIRET
  ui/             design system : tokens, composants, icônes, animations
  emails/         modèles d'e-mails et de SMS, variables, aperçus
data/             scripts Python : SIRENE, BAN, NAF 2025, baromètres
donnees/          catalogue.json · communes-ile-de-france.json · prix-indicatifs.json
docs/             PLAN.md · QUESTIONS.md · JOURNAL.md · captures/ · decisions/
```

### 2.4 Le principe d'architecture qui compte le plus

**Toute règle métier vit dans `packages/core`, sous forme de fonction pure, et nulle part
ailleurs.** Ni dans un composant React, ni dans une route Next.js, ni dans un worker, ni dans une
requête SQL. Les applications orchestrent (lire la base, appeler la règle, écrire le résultat,
journaliser) ; elles ne décident pas.

Conséquence directe : le classement d'une page de résultats, la rotation équitable des Premium,
la cascade de distribution, le décompte d'un forfait, le calcul d'un devis avec remise et acompte,
la numérotation continue des factures, la garantie Exclusif et le retrait des villes lors d'un
changement de formule sont **testables sans base de données, sans réseau et sans navigateur**.
C'est la seule façon de tenir une couverture de 90 % sur des règles de cette densité, et de
pouvoir les changer depuis le back-office sans toucher au code.

Corollaire : **aucun prix, aucun délai, aucun seuil n'est écrit en dur dans un composant.** Tout
vient d'une table de paramètres historisée (`parametres`), chargée au démarrage et exposée à
`packages/core` sous forme d'objet de configuration typé. Les valeurs validées du 27 octobre 2026
sont les valeurs par défaut de cette table, pas des constantes du code.

---

## 3. Découpage en phases

Le cahier des charges impose une branche par phase et une porte de validation. **Adaptation
documentée** : cette session développe et pousse sur la branche imposée par l'environnement,
`claude/upbeat-meitner-ptpjnx`. Les phases restent marquées par des commits conventionnels et une
entrée dans `docs/JOURNAL.md` ; les portes de validation sont cochées explicitement. Voir
`QUESTIONS.md` §Q10.

| Phase | Contenu | Porte de validation |
|---|---|---|
| **0. Cadrage** | Lecture intégrale, `PLAN.md`, `QUESTIONS.md`, monorepo, CI, design system de base, polices, tokens | Plan commité ; page de démonstration du design system capturée à 390 et 1440 px |
| **1. Données** | Schéma Prisma, catalogue, 1 285 communes avec géométries, prix indicatifs, import SIRENE Île-de-France avec statut de diffusion, géocodage, NAF → métiers | 100 % des établissements actifs d'Île-de-France importés ; tests d'import verts |
| **2. Site public** | En-tête et méga-menus, pied de page, accueil, Île-de-France, département, ville, métier, résultats, fiches (4 rendus), guide des prix, page pros, pages légales | Toutes les pages capturées et irréprochables à 390 et 1440 px ; Lighthouse mobile ≥ 90 |
| **3. Inscription et espace pro (socle)** | Inscription en 8 étapes, revendication, vérification, fiche, zones, agences, tableau de bord | Parcours de bout en bout vert ; limites de zones respectées |
| **4. Demandes et côté client** | Formulaire 5 étapes, classement automatique, cascade, minuteurs, urgences, quotas, refus et re-proposition, acceptation définitive, SMS/e-mails, pages d'action, suivi jusqu'à l'avis, contestations, anti-fraude | Tous les scénarios de la section 9 testés ; parcours complet démontré |
| **5. Agenda, devis et factures** | Agenda, éditeur, conformité du devis de dépannage, signature SMS, facture automatique, avoirs, PDF, Factur-X, RIB | Tests de calcul et de numérotation verts ; PDF identiques à l'écran |
| **6. Monétisation** | Stripe, formules, annuel, quotas, dépassements, urgences, emplacements, rotation, exclusivités, liste d'attente, garantie Exclusif, prorata | Scénarios de facturation testés en mode test Stripe |
| **7. Back-office** | 17 pages en 9 univers, centre de distribution en temps réel, compteurs, Espace Premium, paramètres historisés, rôles, audit | Arcel pilote une journée complète sans toucher à la base |
| **8. Personnalisation** | Thème de marque Premium, Studio Exclusif, site connecté, widget avis | Les 4 fiches et les variantes personnalisées capturées |
| **9. Avis, modération, conformité** | Avis vérifiés, modération, signalements DSA, RGPD, pages légales finalisées | Checklist de la section 17 cochée |
| **10. Référencement technique** | Règle d'indexation, données structurées, sitemaps, IndexNow, Core Web Vitals | Rapport interne vert dans le back-office |
| **11. Plus tard** | Publicité des marques, Visibilité partout, application mobile | — |

### Ce que la phase 0 livre exactement

- [x] Lecture intégrale du cahier des charges et de l'étude de faisabilité
- [x] `docs/PLAN.md` (ce document) et `docs/QUESTIONS.md`
- [ ] Monorepo Turborepo + pnpm, TypeScript strict, ESLint, Prettier
- [ ] CI GitHub Actions : lint, typecheck, tests unitaires, build
- [ ] Design system `packages/ui` : tokens de couleur, typographie auto-hébergée
      (DM Serif Display + Manrope), échelles d'espacement, animations, respect de
      `prefers-reduced-motion`
- [ ] Page de démonstration du design system, capturée à 390 et 1440 px dans `docs/captures/`
- [ ] `docs/JOURNAL.md` ouvert

### Ce qui conditionne la suite

La phase 1 dépend de trois fichiers de données annoncés comme fournis mais **absents du dépôt**
(`donnees/catalogue.json`, `donnees/communes-ile-de-france.json`, `donnees/prix-indicatifs.json`)
et de 23 maquettes de référence également absentes. Le choix par défaut appliqué est décrit en
`QUESTIONS.md` §Q1 : les trois fichiers sont **reconstruits** à partir du cahier des charges et de
l'étude, les communes depuis la source officielle `@etalab/decoupage-administratif`, et le
catalogue comme les prix sont marqués « à valider par Arcel » dans le back-office. Les maquettes
absentes ne bloquent rien : le cahier des charges décrit le contenu et les règles de chaque écran,
et la consigne est explicitement de faire mieux que ces maquettes.

---

## 4. Méthode de travail, écran par écran

Aucun écran n'est déclaré fini sans être regardé.

1. Relire la règle métier et, si elle existe, la maquette de référence.
2. Concevoir une version meilleure — pas une transcription.
3. Coder.
4. Capturer à **390 px** et **1440 px** avec Playwright, dans `docs/captures/`.
5. Regarder les captures : aucun débordement, aucun retour à la ligne disgracieux, aucun
   chevauchement, aucun texte coupé, aucun défilement horizontal de la page.
6. Corriger et recommencer jusqu'à un rendu qu'un directeur artistique exigeant validerait tel
   quel.

Chaque bouton fait quelque chose de réel : pas un seul bouton mort.

---

## 5. Ce qui est tenu pour acquis et ne se rediscute pas

Les 15 décisions **[VALIDÉ]** du cahier des charges (§2) sont des invariants. Elles sont recopiées
dans `packages/core/src/regles-validees.ts` avec un commentaire qui renvoie à leur numéro, et
couvertes par des tests qui échouent si une valeur change sans décision :

prix 0 / 29 / 79 / 229 € HT · annuel 2 mois offerts · engagement 12 mois pour l'Exclusif ·
forfaits 5 et 15 demandes, dépassements 12 € et 9 €, demande partagée 15 € sans abonnement ·
urgences 25 / 20 / 15 € facturées à part · zones 2 / 5 / 15 / illimitées · agences 1 / 1 / 3 /
illimitées · place 1 Exclusif, places 2-3 Premium en rotation équitable, « Sponsorisé » toujours ·
acceptation définitive, refus gratuit avec motif obligatoire · aucun espace client · devis et
factures dans l'espace pro avec RIB figé à l'émission · garantie Exclusif (moins de 5 demandes sur
3 mois, fiche complète, 80 % de réponse) · aucun contenu SEO visible · 18 univers / 69 métiers /
479 prestations · 3 pros au maximum par demande, jamais de revente après 72 h.

---

## 6. Risques techniques identifiés et parades

| Risque | Parade retenue |
|---|---|
| Des centaines de milliers de pages métier × ville de faible valeur déclenchent une sanction de domaine | Règle d'indexation appliquée **dans le code de la page** : `noindex, follow` tant qu'il n'y a pas 3 entreprises actives à fiche complète et des données réelles. Suivi du ratio indexées / publiées dans le back-office |
| Deux pros acceptent une demande urgente à la même seconde | Verrou applicatif en base (`SELECT ... FOR UPDATE` sur la demande) + test unitaire de concurrence. Le verrou est une règle, pas un détail d'implémentation |
| Le classement devient lent sur une page très demandée | Score recalculé chaque nuit et stocké comme attribut de tri dans Meilisearch ; les emplacements payés viennent d'une table dédiée mise à jour à chaque abonnement. Aucun calcul de score au moment de l'affichage |
| Une fiche d'entrepreneur individuel non diffusible apparaît | Statut de diffusion appliqué **à l'import** et re-vérifié à chaque rendu ; nom, adresse précise et géolocalisation masqués. Test d'import dédié |
| La marge d'une demande achetée en publicité devient négative | Le back-office montre la marge réelle par métier × ville, l'origine des demandes et le revenu hors quota. `QUESTIONS.md` §Q7 pose la question du prix hors forfait |
| Une facture émise est modifiée | Interdiction au niveau de la base (contrainte + journal), correction uniquement par avoir. Numéro attribué à l'émission, jamais à la création |
| PostGIS indisponible dans un environnement de développement | La distance est une fonction pure dans `packages/core` (haversine), testée ; les requêtes SQL utilisent une boîte englobante + distance, compatibles avec ou sans index PostGIS |

---

## 7. Questions ouvertes

Elles sont tenues dans `docs/QUESTIONS.md`, chacune avec le choix par défaut appliqué
immédiatement — le plus prudent pour l'utilisateur — afin qu'aucune question ne bloque le projet.
