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

## Q5 🔴 — Recrédit et demandes non payées : à confirmer dans les CGV

_(§22.4)_

**Règle appliquée, à faire confirmer mot pour mot par l'avocat.**

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

## Q16 🟡 — Le secret de hachage des codes, et sa rotation

_(non couvert par le cahier des charges)_

Les codes sont hachés avec `SECRET_VERIFICATION`, une variable d'environnement sans valeur par
défaut : le serveur **refuse** de vérifier un code si elle est absente ou plus courte que 32
caractères, plutôt que de hacher avec une chaîne connue de tout le monde.

**Défaut appliqué : aucune rotation automatique.** Changer le secret invalide les codes en cours
de validité — au pire, quelques visiteurs redemandent un code. C'est sans conséquence, mais
personne ne doit le faire sans le savoir : c'est écrit dans `.env.exemple`.

**À trancher à l'exploitation** : où ce secret est conservé en production (gestionnaire de
secrets de l'hébergeur, pas un fichier `.env` sur le disque) et qui y a accès.
