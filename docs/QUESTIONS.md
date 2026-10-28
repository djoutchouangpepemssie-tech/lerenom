# Questions ouvertes à soumettre à Arcel

Règle de travail : **aucune question ne bloque le projet.** Chaque question porte un choix par
défaut — le plus prudent pour l'utilisateur — qui est appliqué immédiatement dans le code. Quand
Arcel tranche, la décision remplace le défaut, et l'entrée passe en « Tranchée » avec la date.

Légende : 🔴 bloquant commercialement ou juridiquement avant l'ouverture des paiements ·
🟠 à trancher avant la phase concernée · 🟢 réglé par défaut sans conséquence lourde.

---

## Q1 🔴 — Les fichiers de données annoncés sont absents du dépôt

**Le fait.** Le cahier des charges décrit trois fichiers « fournis » dans `donnees/`
(`catalogue.json` : 18 univers, 69 métiers, 479 prestations avec couleur, icône SVG et codes NAF ;
`communes-ile-de-france.json` : 1 285 entrées ; `prix-indicatifs.json` : fourchettes TTC par
prestation) et 23 maquettes interactives dans `maquettes-reference/`. Le dépôt reçu est vide : ni
`donnees/`, ni `maquettes-reference/`. Seule l'étude de faisabilité a été transmise.

**Choix par défaut appliqué.**

- **Communes** : reconstruites depuis la source officielle citée par le cahier des charges,
  le paquet npm `@etalab/decoupage-administratif` (v6), filtrées sur les 8 départements
  d'Île-de-France, avec code postal et population. C'est une donnée **exacte**, pas une
  approximation : aucune validation d'Arcel n'est nécessaire au-delà du décompte.
- **Catalogue** : reconstruit à partir des 18 univers nommés dans le cahier des charges (§6) et
  des métiers et prestations cités dans le cahier des charges et l'étude, complété pour atteindre
  la structure annoncée. Chaque entrée porte un champ `aValider: true` tant qu'Arcel ne l'a pas
  confirmée, et le back-office (module Catalogue) permet de renommer, fusionner ou masquer sans
  toucher au code. **Les compteurs affichés sur le site sont calculés**, jamais écrits en dur :
  si le catalogue validé compte 71 métiers au lieu de 69, le site affiche 71.
- **Prix indicatifs** : fourchettes de départ, marquées `source: "estimation"` et `aValider: true`.
  Seuls les prix parisiens issus de l'étude sont marqués `source: "etude"`. Le guide des prix
  affiche la mention « fourchettes indicatives, hors devis personnalisé » tant que les prix ne
  sont pas validés.
- **Maquettes** : absentes, et non bloquantes. Le cahier des charges décrit le contenu, le
  parcours et les règles de chaque écran, et la consigne §2.14 est explicitement de **faire
  nettement mieux** que ces maquettes, pas de les recopier.

**Blocage constaté à l'exécution.** La politique réseau de l'environnement de développement
refuse `geo.api.gouv.fr` et `data.gouv.fr`. Les coordonnées des communes (Base Adresse Nationale)
et l'import SIRENE ne peuvent donc pas être produits ici. Les deux scripts sont écrits et
s'arrêtent avec un message explicite plutôt que d'inventer des données. Pour les faire tourner,
il faut autoriser ces deux hôtes dans l'accès réseau de l'environnement, ou les lancer depuis un
poste qui les joint.

**Ce qu'il faut d'Arcel.** Soit les fichiers d'origine (ils remplacent alors les reconstructions
sans autre changement, le schéma étant identique), soit la validation du catalogue et des prix
reconstruits, métier par métier. **Les prix ne doivent pas être présentés comme des références
tant qu'ils ne sont pas validés** : c'est une exigence du code de la consommation autant qu'une
question de confiance.

---

## Q2 🟠 — Sans Exclusif sur une zone, deux Premium prennent-ils les places 1 et 2 ?

_(§22.1 du cahier des charges)_

**Choix par défaut appliqué : oui.** En l'absence de titulaire d'exclusivité sur le couple
métier × zone, les deux emplacements Premium occupent les places 1 et 2, toujours étiquetés
« Sponsorisé », et la place 3 reste disponible pour la mise en avant au clic (1 € le clic) quand
elle est libre. Le plafond absolu de **3 emplacements payés par page** reste tenu dans tous les
cas, et le séparateur « Classement naturel » apparaît sous le dernier emplacement payé.

**Conséquence si Arcel décide l'inverse** (laisser la place 1 vide) : un seul paramètre à changer
dans `packages/core`, aucune migration.

---

## Q3 🟠 — Le périmètre exact d'une exclusivité

_(§22.2 : commune entière, arrondissement à Paris, ou quartier dans les grandes villes ?)_

**Divergence relevée entre les documents.** L'étude de faisabilité parle systématiquement de
« métier × quartier » (« Place n° 1 unique pour son métier dans son quartier », « un seul Exclusif
par couple métier × quartier »). Le cahier des charges, plus récent, parle de « métier × zone » et
propose en défaut « commune, et arrondissement à Paris ».

**Choix par défaut appliqué : la commune**, et l'**arrondissement** pour Paris (les 20
arrondissements sont des entrées de premier niveau dans les données géographiques, au même rang
que les communes). Le modèle de données prévoit dès maintenant une table `quartiers` rattachée aux
communes, de sorte qu'un passage ultérieur à une exclusivité au quartier dans les grandes villes
soit un changement de granularité, pas une refonte.

**Pourquoi ce défaut est le plus prudent.** Vendre une exclusivité « Paris 11e » est tenable et
compréhensible ; vendre « quartier Sainte-Marguerite » suppose un découpage que Le Renom n'a pas
encore, et expose à un litige sur le périmètre vendu. Le texte des CGV pro doit nommer le
périmètre exactement comme il est vendu.

---

## Q4 🟠 — Quand un client signe le devis d'un pro, les autres pros perdent-ils l'accès à ses coordonnées ?

_(§22.3)_

**Choix par défaut appliqué : oui, l'accès est fermé.** Dès qu'une demande est déclarée gagnée par
un pro, les autres pros qui l'avaient acceptée sont prévenus (« cette demande a trouvé son
professionnel »), et les coordonnées du client ne sont **plus affichées** dans leur espace. Leur
facturation reste due : ils ont bien reçu la demande et y ont eu accès.

**Pourquoi.** C'est le choix le plus protecteur pour le client, et le RGPD le soutient : les
coordonnées ont été transmises pour répondre à une demande, cette finalité est éteinte. Les CGV
pro disent déjà que les coordonnées ne servent qu'à répondre à la demande.

**Nuance appliquée.** Les coordonnées disparaissent de l'écran, mais la demande et son historique
restent dans l'espace du pro (il doit pouvoir contester, et justifier sa facture). Le pro garde ce
qu'il a déjà exporté : Le Renom ne peut pas l'en empêcher, seulement le lui interdire par contrat.

---

## Q5 🟢 — Recrédit et demandes non payées · **tranchée et implémentée**

_(§22.4)_

**Règle appliquée et codée** dans `packages/core/src/contestation.ts`, à faire confirmer mot
pour mot par l'avocat pour la rédaction des CGV.

- Une demande **refusée** n'est jamais facturée, et le refus est gratuit (motif obligatoire).
- Une demande **laissée expirer** (30 min pour l'Exclusif, 2 h pour les autres) n'est ni facturée
  ni décomptée du forfait.
- Une demande **acceptée** est facturée et décomptée, définitivement : l'acceptation débloque les
  coordonnées, elle ne s'annule pas. **Une demande acceptée mais restée sans suite reste
  décomptée.**
- Le **recrédit** est réservé à trois cas vérifiés par Le Renom : client injoignable après 3 appels
  tracés sur 48 h, client absent à un rendez-vous confirmé, fausses informations confirmées sous
  48 h.
- Un **écart d'informations** (surface, accès, budget irréaliste) n'ouvre **pas** de recrédit : le
  devis passe en nouvelle version et le client re-signe. C'est une vraie demande.

**Ce que le code fait désormais de cette règle.** Les motifs se répartissent en deux familles,
et la frontière est nette : **on recrédite ce que Le Renom peut vérifier dans sa propre base**,
et rien d'autre.

| Motif                                                            | Décision    | Sur quelle preuve                     |
| ---------------------------------------------------------------- | ----------- | ------------------------------------- |
| Client injoignable                                               | automatique | 3 appels tracés sans réponse en 48 h  |
| Demande en double                                                | automatique | doublon constaté en base              |
| Annulée juste après acceptation                                  | automatique | moins de 60 min, aucun contact établi |
| Coordonnées fausses, hors zone, hors métier, demande fantaisiste | **humain**  | la base ne sait pas trancher          |

Deux refus sont également automatiques, et ils comptent autant que les accords : une
intervention **confirmée par le client** ferme le débat quel que soit le motif invoqué — le
professionnel a eu ce qu'il a payé — et « client injoignable » est refusé si un appel a abouti.

Un recrédit rend **exactement ce qui a été pris** : l'unité de forfait si la demande y était
incluse, l'argent si elle a été facturée, jamais les deux. Tout passe par une contestation
tracée, même accordée d'office : un recrédit sans trace serait un recrédit invérifiable.

---

## Q6 🟢 — Délai de contestation : 7 jours ou 48 heures ?

_(§22.5 — divergence entre deux passages de l'étude)_

**Choix par défaut appliqué, conforme au défaut proposé : 7 jours pour contester, 48 heures pour
trancher.** Les deux délais sont des paramètres de la table `parametres`, historisés, modifiables
depuis le back-office sans déploiement. L'écran de contestation affiche le délai restant au pro,
et la file du back-office affiche le délai restant à Arcel.

---

## Q7 🟠 — Faut-il remonter le prix de la demande hors forfait Premium de 12 € à 15 € ?

_(§22.7)_

**Choix par défaut appliqué : non, on garde 12 €**, parce que c'est une valeur **[VALIDÉ]** (règle
n° 2) et qu'une valeur validée ne se change pas sans l'accord d'Arcel.

**Mais le problème est réel et chiffré.** Une demande obtenue par publicité coûte environ 15 €.
Un Premium à 79 € qui consomme ses 5 demandes incluses laisse donc environ 4 € de marge si toutes
ses demandes viennent de la publicité ; au-delà du forfait, Le Renom revend à 12 € une demande qui
lui a coûté 15 €, soit **3 € de perte par demande**. L'Exclusif à 229 € avec 15 demandes incluses
puis 9 € l'unité présente la même structure, en plus marquée.

**Ce que le produit fait en attendant la décision.** Le tableau de bord du back-office affiche la
marge réelle par couple métier × ville, l'origine de chaque demande (organique ou payante) et le
revenu des demandes hors quota, de façon que la question se tranche sur des données réelles et non
sur une hypothèse. Le prix hors forfait est un paramètre : le changer est une saisie, pas un
déploiement.

---

## Q8 🟠 — Prix indicatifs des 479 prestations

_(§22.6)_ Voir Q1. Les prix sont marqués `aValider` et le guide des prix le dit honnêtement.
Seuls les prix parisiens issus de l'étude sont présentés comme des références.

---

## Q9 🟠 — Quels métiers et quelles villes ouvrir en premier aux demandes ?

_(§22.8)_

**Choix par défaut appliqué : exactement les statuts donnés par le cahier des charges**, et rien
de plus. Ouvertes : Paris 9e, Paris 11e, Paris 20e, Montreuil, Vincennes. Bientôt : Paris 12e,
Saint-Mandé, Bagnolet. Annuaire : les 1 277 autres. Tous les métiers du catalogue sont ouverts
dans les villes ouvertes.

**Recommandation pour la décision.** L'étude suggère de commencer par 10 à 20 métiers, pas 69 :
une demande de « conciergerie d'événement » à Vincennes sans aucun pro éligible produit une
demande sans preneur, c'est-à-dire un client déçu et une alerte pour rien. Le back-office permet
d'ouvrir les métiers **ville par ville** (module Zones et villes) : le défaut prudent serait
d'ouvrir d'abord les univers où l'annuaire SIRENE fournit déjà assez de pros par ville, et de
mesurer le taux de demandes sans preneur par métier avant d'élargir.

---

## Q10 🟢 — Branches et portes de validation

**Le fait.** Le cahier des charges demande une branche par phase (`phase/01-donnees`…) fusionnée
dans `main` après chaque porte. L'environnement d'exécution impose de développer et de pousser sur
une seule branche désignée, `claude/upbeat-meitner-ptpjnx`, et interdit de pousser ailleurs.

**Choix par défaut appliqué.** Développement et poussées sur la branche désignée, en commits
conventionnels. Les phases restent lisibles : chaque phase se termine par une entrée datée dans
`docs/JOURNAL.md` qui coche sa porte de validation et liste les captures produites. Si Arcel
préfère l'historique en branches par phase, il suffira de le dire : rien dans le code n'en dépend.

---

## Q11 🟠 — « Pas d'espace client » et le suivi des devis côte à côte

**Divergence relevée.** La règle **[VALIDÉ]** n° 9 est sans ambiguïté : le client n'a **ni compte
ni tableau de bord**, tout passe par SMS, e-mail et pages d'une seule action qui expirent après
usage. L'étude de faisabilité, plus ancienne, décrit pourtant au §9 « L'expérience du demandeur »
un « espace de suivi sans mot de passe (lien sécurisé par e-mail) » avec « comparaison des devis
côte à côte » et une « messagerie avec chaque pro ».

**Choix par défaut appliqué : la règle validée gagne.** Aucun espace client, aucune messagerie
client ↔ pro dans la plateforme, aucun bouton « Se connecter » côté client. Les 8 moments du
parcours client (§10 du cahier des charges) sont couverts par des pages d'une seule action, chacune
portant un jeton à usage unique qui expire après usage.

**La question qui reste.** Quand un client reçoit 3 devis, il reçoit aujourd'hui 3 e-mails avec 3
PDF et 3 pages de signature distinctes. Comparer trois devis dans trois e-mails est inconfortable.
Une page « vos 3 devis » en lecture seule, atteinte par un lien signé et expirant, respecterait la
lettre de la règle (pas de compte, pas de tableau de bord, un lien par usage) tout en rendant la
comparaison lisible. **À trancher par Arcel** : je ne l'ai pas construite, parce qu'elle ressemble
à un tableau de bord et que la règle est validée.

---

## Q12 🟢 — Nombre de pages du back-office : 16 ou 17 ?

L'étude décrit 16 pages en 9 univers ; le cahier des charges parle d'« environ 17 pages » en 9
univers et en énumère 17. **Choix par défaut appliqué : les 17 modules énumérés au §13 du cahier
des charges**, rangés dans les 9 univers nommés (Accueil, Demandes, Premium et Exclusif,
Professionnels, Catalogue, Finances, Croissance, Confiance, Réglages), avec la règle de mise en
page imposée : 4 indicateurs au maximum par page, puis des onglets, un seul tableau visible à la
fois.

---

## Q13 🟠 — Numéros de suivi des appels : quel opérateur ?

Le cahier des charges prévoit la table `appels_suivis`, le badge « Répond en moins d'1 h » nourri
par les appels, le numéro de suivi dédié à partir de l'Essentiel et l'interdiction d'enregistrer
les conversations. Aucun opérateur de téléphonie n'est nommé dans la stack validée.

**Choix par défaut appliqué.** Le suivi d'appel est modélisé et affiché dès maintenant, derrière
une interface `FournisseurTelephonie` dans `packages/core`. L'implémentation réelle (attribution
d'un numéro par agence, renvoi vers le vrai numéro, journalisation sans enregistrement) attend le
choix d'un opérateur européen. Jusque-là, les fiches affichent le numéro réel du pro et le
compteur d'appels se nourrit des clics sur le bouton « Appeler », ce que l'interface indique
honnêtement dans les statistiques du pro (« clics sur Appeler », pas « appels reçus »).

---

## Q14 🔴 — Avocat, marque, et textes légaux

_(§22.9)_

**État appliqué.** Les pages `/cgu`, `/cgv-pro`, `/confidentialite`, `/cookies`,
`/mentions-legales`, `/charte-avis` et `/comment-nous-classons` sont rédigées et en ligne, mais
elles portent, **dans le dépôt et non sur le site**, la mention explicite de brouillon :
`docs/legal/ÉTAT.md` liste ce qui doit être relu.

**Rien de tout cela ne peut être mis en production avant deux choses** : la relecture par un
avocat spécialisé en droit du numérique (DSA, avis en ligne L111-7-2, RGPD, CGV marketplace) et
le dépôt de la marque « Le Renom » à l'INPI. **Les paiements ne doivent pas être ouverts avant.**
C'est la question la plus urgente de cette liste, et la seule que le code ne peut pas trancher.

---

## Q15 🟡 — Durée de validité et nombre de tentatives du code SMS

_(non couvert par le cahier des charges)_

Le cahier des charges impose la vérification du mobile par code à six chiffres, mais ne fixe ni
sa durée de validité, ni le nombre d'essais autorisés.

**Défaut appliqué : 15 minutes et 5 tentatives.** Six chiffres, c'est un million de
combinaisons : sans limite, un robot les épuise en quelques minutes, et le numéro d'un tiers
pourrait être utilisé pour déposer des demandes. Cinq essais laissent au client de bonne foi la
marge de se tromper deux fois ; « je n'ai rien reçu » remet le compteur à zéro, pour qu'une
erreur de frappe ne soit jamais une impasse.

Les deux valeurs sont des constantes de `@lerenom/core` (`VALIDITE_CODE_MINUTES`,
`TENTATIVES_MAX`), pas des nombres écrits dans le code des routes : les déplacer est une ligne.
**Si un volume réel montre que 15 minutes sont trop courtes** — un SMS peut mettre plusieurs
minutes à arriver selon l'opérateur — il faudra les porter à 30.

---

## Q16 🟢 — Le secret de hachage des codes · **traitée, voir Q21**

_(non couvert par le cahier des charges)_

Le contrôle du secret a été unifié et durci : voir **Q21**, qui remplace cette entrée. Il n'y a
plus de valeur par défaut nulle part, une seule définition dans `@lerenom/securite`, et le
worker refuse de démarrer sans elle.

---

## Q17 🟡 — Durée de vie des liens à action unique

_(§ non chiffré par le cahier des charges)_

Le cahier des charges impose des pages client « à action unique, expirantes », sans dire combien
de temps elles vivent.

**Défauts appliqués**, dans `DUREE_LIEN_JOURS` (`packages/core/src/liens.ts`) : 90 jours pour
consulter ses devis et déposer un avis, 60 pour régler une facture, 30 pour signer un devis,
14 pour choisir un créneau ou envoyer des photos, 7 pour annuler, 3 pour modifier, 180 pour
confirmer l'ouverture d'une ville.

Le raisonnement est le même partout : **aussi longtemps que l'usage l'exige, pas un jour de
plus.** On revient sur les coordonnées d'un artisan des semaines après l'intervention ; on
n'annule pas une demande trois semaines après l'avoir déposée, puisqu'elle est périmée au bout
de 72 heures.

**À confirmer avec Arcel** : 90 jours pour le dépôt d'avis est-il suffisant pour des travaux
longs (une rénovation peut durer six mois) ? Si non, c'est une constante à changer, pas du code.

---

## Q18 🟢 — Demande annulée et pros ayant déjà accepté · **tranchée et implémentée**

_(non tranché par le cahier des charges)_

Le cahier des charges dit que l'acceptation est définitive et facturée. Il ne disait pas ce qui
se passe si le client annule **après** qu'un professionnel a accepté.

**Décision appliquée, en deux temps.**

1. **Le client n'est jamais empêché d'annuler**, et rien ne lui est repris. Les propositions
   encore en attente passent à « retirée » — le pro n'a rien refusé, rien ne lui est compté.
   Les professionnels qui ont déjà accepté gardent les coordonnées : ils ont payé pour elles,
   et ils ont peut-être déjà appelé. La page le dit au client avant qu'il confirme.

2. **Le professionnel lésé est recrédité d'office.** Quand l'annulation tombe dans l'heure
   suivant l'acceptation et qu'aucun contact n'a été établi — pas d'appel abouti, pas de
   rendez-vous, pas de devis — Le Renom ouvre la contestation lui-même et la tranche dans la
   foulée. Le pro n'a rien à réclamer.

**Pourquoi d'office, et pas sur réclamation.** C'était la vraie question. Attendre que le
professionnel réclame aurait été plus simple et moins coûteux — mais la plupart ne
réclameraient jamais, et c'est précisément ce silence qui rendrait la pratique rentable pour la
plateforme. Facturer des coordonnées qu'un pro n'a pas eu le temps d'utiliser, en comptant sur
le fait qu'il ne dira rien, n'est pas défendable.

Le délai de 60 minutes est un paramètre (`minutesAnnulationRecreditee`), pas un nombre écrit
dans le code : si l'usage montre qu'il est trop court ou trop long, il se change depuis le
back-office.

---

## Q19 🟢 — Qui déclare que les travaux sont réalisés ? · **tranchée et implémentée**

_(§ avis — le cahier des charges dit « quinze jours après les travaux », sans dire qui le dit)_

C'était le trou le plus grave de la chaîne : l'étape « travaux réalisés » ne pouvait venir que
du professionnel, et un professionnel qui ne déclare jamais rien n'aurait jamais eu de mauvais
avis. L'intérêt du pro et celui de la plateforme divergeaient exactement là où il ne faut pas.

**Décision appliquée : c'est le client qui tranche, et on le lui demande.**

Sept jours après l'acceptation, si le professionnel n'a rien déclaré, le client reçoit une
question unique — « votre intervention avec X a-t-elle eu lieu ? » — et trois réponses :

- **oui** → l'étape est enregistrée **au nom du client** (`declarePar: client`, l'origine est
  tracée, c'est elle qui fait foi dans un litige) et le formulaire d'avis s'ouvre dans la
  foulée, sur la même page. Le client est là, il se souvient : un second message serait un
  message de trop ;
- **pas encore** → rien n'est déclaré, la question est reposée plus tard ;
- **non** → l'étape « perdue » est enregistrée et une alerte part au back-office. Un
  professionnel qui accepte une demande et ne va pas au bout, cela se regarde.

**On interroge, on ne harcèle pas** : une question, deux relances espacées d'une semaine, puis
on laisse tomber. Les trois nombres sont des paramètres.

**Ce que cela change.** La chaîne des avis n'a plus besoin de l'espace professionnel pour
fonctionner : elle tourne de bout en bout avec le seul client. L'espace pro, quand il existera,
ajoutera un second chemin — plus rapide — mais il ne sera plus le seul.

**Reste à surveiller** : si beaucoup de clients ne répondent pas, il faudra afficher le taux de
déclaration d'un professionnel et le faire entrer dans son score, pour que le silence devienne
coûteux. Ce n'est pas nécessaire tant que le volume est faible, et cela se décide sur des
chiffres réels, pas à l'avance.

---

## Q20 🟢 — Avis contenant des coordonnées · **tranchée et implémentée**

_(§ avis)_

**Décision appliquée : on caviarde, et le caviardage est visible.**

Plutôt que de refuser en bloc un avis contenant un numéro de téléphone, le relecteur publie
l'avis sans le numéro, remplacé par une mention explicite : « [numéro retiré] », « [adresse
retirée] », « [lien retiré] ». L'auteur a pris la peine d'écrire, son avis compte, et il n'a
généralement pas voulu mal faire.

Trois garde-fous rendent ce choix tenable :

- le texte d'origine **n'est jamais écrasé**. `commentaire` garde ce que l'auteur a écrit,
  `commentairePublic` porte la version publiée. Le relecteur a les deux sous les yeux ;
- le retrait est **toujours visible**. Modifier le propos de quelqu'un sans le dire serait pire
  que de ne rien publier ;
- seules les **données personnelles** sont caviardées. Une accusation — « arnaque », « vol » —
  n'est pas une donnée personnelle, c'est un propos : il se publie ou se refuse avec un motif,
  il ne se réécrit pas.

---

## Q21 🟡 — Rotation du secret de hachage en production

_(exploitation)_

`SECRET_VERIFICATION` hache les codes SMS et les jetons de lien. Deux améliorations ont été
apportées à son traitement :

- **le worker refuse de démarrer** si le secret est absent ou trop court, plutôt que de
  découvrir le problème au premier client qui valide son numéro. Le message nomme chaque
  variable manquante et dit quoi faire — toutes d'un coup, pour qu'un exploitant ne corrige pas
  une variable, relance, et en découvre une autre ;
- **une seule définition** pour tout le dépôt, dans `@lerenom/securite`. Il y en avait trois,
  écrites séparément : trois contrôles finissent toujours par diverger, et celui qui diverge est
  celui qu'on avait oublié de relire.

**Reste à trancher à l'exploitation** : où ce secret est conservé en production — gestionnaire
de secrets de l'hébergeur, jamais un fichier `.env` sur le disque — et qui y a accès. Changer
le secret invalide les codes et les liens en cours de validité : au pire, quelques visiteurs en
redemandent un. C'est sans gravité, mais personne ne doit le faire sans le savoir.

---

## Q22 🟡 — Remettre les pages publiques en cache, sans les rendre fausses

_(technique — décidé par défaut, à reprendre)_

Le site public est rendu à l'exécution (`dynamic = 'force-dynamic'` sur
`apps/web/app/(public)/layout.tsx`). La raison est détaillée dans `docs/DEPLOIEMENT.md` : elle
permet à la base de n'avoir **aucune porte publique**, ce qui valait mieux qu'un pré-rendu
payé par un mot de passe de base de données traversant Internet en clair.

**Le défaut appliqué** : chaque visiteur déclenche les lectures de sa page. Sur le réseau privé
de l'hébergeur, avec une seule instance, c'est quelques millisecondes — invisible aujourd'hui,
pas tenable à volume.

**Ce qui reste à faire, et pourquoi ce n'est pas qu'un réglage.** La reprise évidente serait
d'envelopper les lectures dans le cache de données de Next (`unstable_cache`). Elle est piégée :
ce cache sérialise ce qu'il garde, et les `Decimal` de Prisma — tous les prix, tous les taux de
TVA — n'y survivent pas comme des `Decimal`. Ils reviendraient en chaînes de caractères, avec
le type `Decimal` toujours affiché par TypeScript. Le code appellerait `Number(...)` dessus et
fonctionnerait la plupart du temps, ce qui est exactement ce qui rend une erreur de prix
difficile à voir.

La reprise propre est donc : des objets de transfert explicites entre la base et les pages, où
les montants sont des `number` et les dates des `string`, puis la mise en cache de ces objets.
C'est un travail de frontière, pas un réglage, et il mérite ses propres tests.

---

## Q23 🟡 — Les six décisions de l'inscription professionnelle

_(métier — décidées par défaut, à confirmer)_

« Valider mon inscription » n'écrivait rien. Le brancher a exigé six décisions que la
spécification ne tranche pas. Chacune est appliquée, chacune est réversible, et aucune n'est
cachée dans le code.

**1. Un SIRET déjà présent est revendiqué, pas dupliqué.** L'annuaire contient des entreprises
venues de la base SIRENE que personne n'a réclamées. Créer un doublon priverait l'entreprise de
son ancienneté, de ses avis et de son adresse déjà indexée. Le titre de la page le disait
déjà : « Créer ou revendiquer ma fiche ». Le slug existant est **conservé** — il est peut-être
partagé ou référencé.

**2. Une fiche déjà revendiquée est refusée, avec un lien vers la connexion.** Deux personnes ne
peuvent pas tenir la même fiche sans que l'une s'en aperçoive. Le message invite à écrire si
quelqu'un tient la fiche à tort — c'est une procédure humaine, et elle n'existe pas encore.

**3. Le mot de passe est demandé dans le formulaire, pas envoyé par lien.** Un lien « définissez
votre mot de passe » serait plus élégant et prouverait l'adresse. Il est impossible aujourd'hui :
aucun opérateur SMS ni service d'envoi d'e-mail n'est raccordé, donc **aucun professionnel ne
pourrait terminer**. Les deux champs sont dans l'étape « Vérification », avec l'identité.

**4. L'entreprise est créée `verifiee: false`.** La fiche existe dans l'annuaire ; elle ne reçoit
aucune demande. C'est exactement ce que l'écran annonce, et c'est la condition posée partout
ailleurs : pas de numéro vérifié, pas de distribution.

**5. Un abonnement payant est créé au statut `impaye`.** C'est son état exact tant que Stripe
n'est pas raccordé. Rien dans le classement ni dans la distribution ne regarde un abonnement
qui n'est pas `actif` : la formule est enregistrée sans offrir de visibilité non réglée. Le
jour où les paiements s'ouvrent, ces lignes sont la liste de ce qu'il faut encaisser.

**6. L'agence principale prend les coordonnées de la commune du siège.** L'adresse exacte n'est
pas demandée pendant l'inscription — huit étapes suffisent. Mais sans latitude ni longitude,
aucune distance ne se calcule et l'entreprise n'est éligible à **rien** : elle serait inscrite
et ne recevrait jamais une demande. Les coordonnées de la commune sont une approximation
honnête, remplacée dès que l'adresse est saisie depuis l'espace pro.

**Ce qui reste à faire, et qui ne dépend pas de ces décisions** : la recherche automatique dans
la base SIRENE (l'accès à l'API de l'Insee n'est pas ouvert sur cet environnement), l'envoi réel
du code SMS, et le paiement.

---

## Q24 🟢 — La complétude d'une fiche : ce qui compte, et combien

_(métier — tranché, consigné pour pouvoir être discuté)_

`completude` alimente la composante **pertinence** du score de qualité, donc le classement
naturel. Personne ne la calculait : le semis écrivait 0,45 pour une fiche gratuite et 0,92 pour
une Exclusif, au jugé. Une entrée du classement était donc une constante inventée.

Elle est désormais calculée par `completudeFiche` (`packages/core/src/fiche.ts`), avec les
poids suivants :

| Critère               | Poids | Pourquoi ce poids                                          |
| --------------------- | ----- | ---------------------------------------------------------- |
| Présentation          | 20 %  | Le seul texte que le visiteur lit avant d'appeler          |
| Photos de chantiers   | 18 %  | Ce qui prouve le travail mieux que n'importe quelle phrase |
| Assurance décennale   | 15 %  | Ce qui engage l'artisan, et protège le client              |
| Prestations déclarées | 12 %  | Un métier coché ne dit pas ce qu'on sait faire             |
| Horaires              | 10 %  | Savoir si l'on peut appeler maintenant                     |
| Téléphone             | 7 %   | Évident, donc peu discriminant                             |
| Logo                  | 6 %   | Reconnaissance, pas information                            |
| Atouts                | 5 %   | Trois lignes sur la carte de résultats                     |
| Image de couverture   | 3 %   | Agrément                                                   |
| Slogan                | 2 %   | Agrément                                                   |
| Site internet         | 1 %   | Beaucoup d'artisans n'en ont pas, et n'ont pas à en avoir  |
| Adresse électronique  | 1 %   | Peu utilisée par les clients de ce secteur                 |

**Le principe appliqué** : le poids mesure l'utilité pour la personne qui cherche, pas l'effort
du professionnel. Il ne récompense pas la bonne volonté, il classe l'information utile.

**Deux règles qui en découlent et qui méritent d'être dites** :

- une **attestation décennale expirée ne compte pas**. L'afficher comme acquise reviendrait à
  mieux classer une entreprise qui n'est plus couverte ;
- **rien n'est exigé**. Une fiche gratuite incomplète existe, s'affiche et reçoit des demandes.
  La complétude la classe, elle ne la conditionne pas. C'est la différence entre un annuaire et
  un péage.

**À confirmer par Arcel** : ces douze poids. Ils sont défendables et ils sont tous au même
endroit, en clair — un seul fichier à relire pour les discuter. Le jeu de démonstration donne
désormais 72 % aux fiches soignées, 45 % aux intermédiaires et 40 % aux minimales, et chacun de
ces chiffres se vérifie champ par champ.

---

## Q25 🟢 — Modifier son périmètre : deux refus plutôt qu'une correction

_(métier — tranché, consigné pour pouvoir être discuté)_

L'inscription fixe un périmètre une fois ; la vie d'une entreprise le fait bouger. L'écran
« Mon périmètre » permet d'ouvrir une ville, d'ajouter un métier ou de se replier. Deux
situations ont demandé une décision.

**1. Dépasser le plafond de sa formule est refusé, pas corrigé.** À l'inscription, les villes
au-delà du plafond étaient retirées automatiquement — c'était acceptable, parce que l'écran
les nommait avant la validation et que le professionnel les voyait partir. Ici, personne ne
regarde par-dessus son épaule : retirer une ville à sa place reviendrait à lui faire perdre
une zone sans qu'il s'en aperçoive. Le refus donne le compte exact et laisse le choix entre
retirer ou changer de formule.

**2. Une ville qui porte un emplacement payé ne se retire pas.** Une exclusivité ou un
emplacement en cours y est rattaché ; supprimer la zone laisserait un emplacement vendu sans
ville où l'honorer. L'écran la montre verrouillée, le refus la nomme, et il invite à nous
écrire.

**Ce que ce second refus laisse ouvert** : il n'existe aujourd'hui aucune procédure pour
mettre fin à un emplacement ou à une exclusivité avant son terme. Le message renvoie donc vers
un contact humain qui n'a pas d'écran. C'est volontaire — résilier un emplacement payé engage
un remboursement au prorata, et cette règle-là n'est pas écrite. Elle le sera avec Stripe.

---

## Q26 🔴 — Aucune commune n'a de coordonnées : la proximité ne joue pas

_(donnée manquante — bloquant pour une ouverture au public)_

**Le constat.** Les 1 285 communes du jeu de données ont bien des colonnes `latitude`,
`longitude` et `sourceCoordonnees` — toutes à `null`. Le géocodage n'a jamais tourné. Aucune
agence n'a donc de position non plus, puisqu'elle recopie celle de sa commune.

**Ce que cela désactive, sans que rien ne le signale :**

- **le rayon d'intervention d'une agence n'a aucun effet.** L'éligibilité se décide
  entièrement sur la liste des villes du périmètre. Un professionnel qui règle son rayon à
  3 km recevra les mêmes demandes qu'à 50 km ;
- **la proximité ne compte pas dans le classement des non-abonnés.** `noteMixte` annonce
  « 60 % qualité, 40 % proximité » ; faute de distance, la proximité vaut 0,5 pour tout le
  monde — neutre, donc le classement est en réalité purement qualitatif ;
- **la page « Comment nous classons » promet au public** « la proximité entre l'adresse des
  travaux et l'agence la plus proche ». C'est aujourd'hui inexact.

**Ce qui sauve le système en attendant**, et qui était prévu : `packages/core` accepte une
zone déclarée **par liste de communes** autant que par rayon, et traite une distance inconnue
comme neutre plutôt que comme nulle. Rien ne casse, rien ne ment dans le code — mais une
fonctionnalité annoncée est inerte.

**Ce qu'il faut pour la combler.** Les centroïdes des communes sont une donnée publique et
gratuite (`geo.api.gouv.fr`, champ `centre`). Un script de quelques lignes remplirait le
fichier `donnees/communes-ile-de-france.json`. **Cet environnement ne peut pas y accéder** : sa
politique réseau refuse le domaine. Deux voies :

1. autoriser `geo.api.gouv.fr` dans les réglages réseau de l'environnement, et le script se
   fait en une passe ;
2. fournir le fichier de centroïdes par un autre moyen.

Tant que ce point n'est pas réglé, **la phrase de « Comment nous classons » doit être corrigée
ou la fonctionnalité livrée** : promettre publiquement un critère de classement qui ne
s'applique pas est le genre d'inexactitude qu'un annuaire ne peut pas se permettre.

---

## Q27 🟢 — Un devis envoyé ne se modifie plus

_(métier — tranché, consigné pour pouvoir être discuté)_

Le schéma porte un champ `version` sur les devis, sans dire ce qui le fait avancer. Deux
lectures étaient possibles : un devis envoyé reste modifiable et sa version s'incrémente à
chaque changement, ou bien il devient immuable et toute correction passe par une copie.

**La seconde est appliquée.** Un devis envoyé est un engagement remis à quelqu'un : le client
en détient un exemplaire. Le modifier sous ses yeux, sans qu'il le sache, n'est pas une
correction mais une substitution — et si le prix change entre ce qu'il a lu et ce qui est en
base, personne ne peut dire lequel fait foi. L'écran propose donc « Dupliquer en nouveau
brouillon » : la copie porte la version suivante, recevra son propre numéro à l'envoi, et
l'original reste tel qu'il a été remis.

**Le numéro n'est attribué qu'à l'envoi**, pour une raison voisine : un brouillon abandonné ne
doit pas consommer un numéro. Un trou dans une série de numéros est un défaut comptable, et la
numérotation à la création en produirait à chaque devis commencé puis laissé.

**Ce qui reste à décider**, et qui dépend d'un conseil juridique plus que d'un choix
technique : combien de temps conserver les devis envoyés, et si un devis expiré doit basculer
tout seul au statut `expire` à l'échéance de sa validité. Le champ existe, le travail de nuit
pourrait le faire ; nous ne l'avons pas branché faute de savoir si l'expiration automatique a
des conséquences contractuelles.

---

## Q28 🟢 — L'espace des milliers : la règle typographique contre la lisibilité

_(présentation — tranchée, consignée parce qu'elle s'écarte d'une norme)_

La typographie française prescrit une **espace fine insécable** (U+202F) entre les groupes de
chiffres et devant le symbole monétaire. C'est ce que `formatEuros` posait, et un test
l'exigeait explicitement.

Sur la capture de la facture, le total s'affichait « 1122 € ». Mesure faite dans la police du
site : U+202F rend **1,6 px** là où U+00A0 en rend 3,2. Manrope ne dessine pas la fine ; le
navigateur la réduit à presque rien. Le séparateur était dans la chaîne, absent de l'écran.

**Décision appliquée : espace insécable ordinaire (U+00A0) partout dans les montants.** Elle
se voit, elle ne coupe pas en fin de ligne, et aucune police n'a d'excuse pour ne pas la
dessiner. Sur une facture, « 1122 » et « 1 122 » ne se lisent pas à la même vitesse : la règle
typographique sert la lecture, et quand son application la dessert, c'est la lecture qui doit
gagner.

**Ce qui rouvrirait la question** : un changement de police de texte. Si la future police
dessine correctement la fine, revenir à U+202F serait le choix juste — la décision tient à
Manrope, pas au principe. Le commentaire dans `quotas.ts` le dit à l'endroit où quelqu'un
serait tenté de « corriger » en sens inverse.

**Ce qui n'est pas tranché** : le même arbitrage se posera pour les autres nombres du site
(populations, surfaces, nombres de pages), qui passent aujourd'hui par
`toLocaleString('fr-FR')` — donc par le séparateur que choisit le navigateur, sans que
personne l'ait décidé. Une seule fonction de formatage des nombres, comme il n'y a qu'un
`formatEuros`, serait plus cohérente ; nous ne l'avons pas faite faute d'avoir recensé tous
les usages.

---

## Q29 🟡 — Combien de caractères fait une explication ?

_(métier — défaut prudent appliqué, à trancher avec un comptable)_

Un avoir porte un motif, qui figure sur le document et sert à expliquer, parfois un an plus
tard, pourquoi la somme due a changé. « Erreur » n'explique rien. Mais aucune règle ne dit
combien de caractères fait une explication.

**Défaut appliqué : vingt caractères minimum**, de quoi écrire « Erreur de quantité » et pas
seulement « erreur. » C'est un garde-fou contre le remplissage machinal, pas une mesure de la
qualité : personne ne peut vérifier qu'un motif dit vrai, et vingt caractères de charabia
passeraient tout aussi bien. Le seuil ne prétend qu'à décourager le geste réflexe.

**Ce qui reste à trancher** : un comptable saura dire si l'administration attend une mention
d'une forme particulière — référence à la facture corrigée, nature de l'erreur, mention
« avoir » explicite — auquel cas ce n'est plus une longueur qu'il faut contrôler mais un
contenu. Si une telle exigence existe, le champ libre devrait devenir un choix de motif
normalisé plus un commentaire.

**Ce qui n'est pas non plus tranché** : faut-il un avoir _de régularisation_ distinct de
l'avoir _de remboursement_ ? Le premier solde une facture que le client n'a pas payée, le
second constate une somme à lui rendre. Comptablement les écritures diffèrent. Nous ne
distinguons pas, faute de savoir si la plateforme doit tenir cette comptabilité ou seulement
produire les documents.

---

## Q30 🟡 — Le changement de compte bancaire : ce qui est fait, ce qui manque

_(sécurité — défaut prudent appliqué, deux points à trancher)_

Détourner les encaissements d'un artisan est la fraude la plus banale sur ce genre de
plateforme : l'escroc n'a rien à voler dans l'espace professionnel, il veut seulement que les
virements des clients arrivent chez lui. Le schéma prévoyait `confirmeParSmsLe` sans dire ce
qui l'alimente.

**Appliqué** : un changement de compte n'est effectif qu'après saisie d'un code envoyé au
mobile **déjà enregistré**. Pas à un numéro fourni dans la même requête, ce qui ne prouverait
rien. Et l'ancien compte reste actif tant que le code n'est pas saisi — un attaquant qui
n'aboutit pas ne doit même pas pouvoir couper les encaissements de sa victime.

**Premier point à trancher : le professionnel sans mobile enregistré.** Le défaut appliqué est
de refuser, en expliquant pourquoi, plutôt que d'accepter sur la foi du seul mot de passe. Une
confirmation sans second canal n'est pas une confirmation. Mais cela bloque un artisan qui n'a
pas renseigné de numéro et veut être payé : faut-il un autre second canal (courrier postal,
pièce d'identité, appel d'Arcel) ou l'obligation de renseigner un mobile à l'inscription ?

**Second point : aucun SMS ne part réellement.** Les messages s'empilent dans
`messages_sortants` avec le statut `en_attente`, comme toutes les autres notifications de la
plateforme — aucun fournisseur n'est branché. Le jour où il le sera, ce code fonctionnera sans
modification ; d'ici là, le changement de compte est **inutilisable en production**, et c'est
volontaire : mieux vaut une porte verrouillée dont on n'a pas encore la clé qu'une porte
ouverte.

**Ce qui n'est pas non plus tranché** : faut-il prévenir par e-mail, en plus du SMS, qu'un
changement de compte a été demandé ? C'est l'usage des banques, et c'est utile précisément
quand le SMS est intercepté. Nous ne l'avons pas fait pour ne pas multiplier les messages
avant d'avoir un fournisseur ; la décision devrait être prise en même temps que le branchement.
