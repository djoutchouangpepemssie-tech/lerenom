# Déployer Le Renom

Ce document dit ce qu'il faut fournir à l'hébergement, et dans quel ordre. Il est court à
dessein : tout ce qui peut être automatisé l'est, le reste tient en quatre variables.

## Pourquoi Railway et pas Vercel

Le worker ne peut pas tourner sur Vercel. Vercel n'exécute que des fonctions éphémères,
déclenchées par une requête et arrêtées aussitôt après ; le worker, lui, est un processus qui
ne s'arrête pas — il tient des files BullMQ, attend des échéances à la seconde et exécute les
travaux de nuit. Sans lui, **une demande déposée n'est jamais distribuée** : le site
fonctionnerait, et ne servirait à rien.

Railway héberge les quatre pièces au même endroit : la base, Redis, le site et le worker. La
base reste sur le réseau privé à l'exécution, et le projet n'a qu'une facture.

---

## Ce que l'application exige, et pourquoi

Le Renom est un annuaire : **chaque page lit la base**. Il n'y a pas de version dégradée sans
base de données, pas plus qu'il n'y a d'annuaire sans annuaire. Trois services sont
nécessaires, et un seul est optionnel au démarrage.

| Service                         | Rôle                                              | Optionnel ?                                                                           |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **PostgreSQL 16 + PostGIS 3.4** | Tout : catalogue, communes, entreprises, demandes | Non                                                                                   |
| **Redis**                       | Files de la cascade, minuteurs, travaux de nuit   | Oui au lancement — sans lui, le site fonctionne, mais aucune demande n'est distribuée |
| **Opérateur SMS**               | Codes de vérification, liens clients              | Non pour construire, **oui pour qu'un client aille au bout**                          |

PostGIS n'est pas un confort : les zones d'intervention et les recherches par distance en
dépendent. Un PostgreSQL sans cette extension pose le schéma puis échoue sur les index.

---

## Les variables d'environnement

À déclarer dans le projet d'hébergement (sur Vercel : **Settings → Environment Variables**),
pour les trois environnements — production, préproduction, développement.

| Variable              | Exemple                                                   | Sans elle                                                                                 |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | `postgresql://user:mdp@hote:5432/lerenom?sslmode=require` | **La construction échoue** : les pages publiques sont pré-rendues et lisent la base       |
| `SECRET_VERIFICATION` | 32 caractères tirés au hasard : `openssl rand -hex 32`    | Les codes SMS, les liens clients et les sessions professionnelles refusent de fonctionner |
| `LERENOM_URL`         | `https://lerenom.fr`                                      | Les liens envoyés par SMS pointeraient vers `localhost`                                   |
| `REDIS_URL`           | `redis://…`                                               | Aucune demande n'est distribuée                                                           |

`SECRET_VERIFICATION` n'a **pas de valeur par défaut**, et c'est délibéré : hacher avec une
chaîne connue de tout le monde reviendrait à ne pas hacher. Le worker refuse de démarrer sans
elle, plutôt que de le découvrir au premier client qui valide son numéro.

---

## Préparer la base, en une commande

Une fois la base créée chez l'hébergeur et sa chaîne de connexion en main :

```bash
DATABASE_URL="postgresql://…" pnpm run base:initialise
```

Le script crée l'extension PostGIS, génère le client, pose le schéma, applique les index
géographiques et les garde-fous que Prisma ne sait pas déclarer — unicité partielle des
exclusivités, immuabilité des factures, journal d'audit en écriture seule — puis charge les
référentiels. Il vérifie enfin les comptes attendus : **1 285 communes, 18 univers, 69 métiers,
479 prestations**.

> Le semis charge aussi le jeu de démonstration : sept plombiers fictifs à Paris 11e, avec des
> numéros de la plage `01 99 00 00 xx` que l'Arcep réserve à la fiction. **Il faudra le retirer
> avant une vraie mise en production.**

---

## Vérifier avant de pousser

```bash
pnpm run verifie
```

Formatage, lint, types, tests, construction — dans l'ordre exact de l'intégration continue.
Le script dit quand il saute les tests d'intégration faute de base, plutôt que de laisser
croire qu'il les a passés.

---

## Ce qui reste à faire avant une ouverture au public

Ces points ne relèvent pas du code, et aucun déploiement ne doit avoir lieu sans eux :

1. **Relecture des textes légaux par un avocat** spécialisé en droit du numérique — DSA, avis
   en ligne (L111-7-2), RGPD, CGV marketplace. Les pages existent et sont marquées comme des
   brouillons dans le dépôt.
2. **Dépôt de la marque « Le Renom » à l'INPI.**
3. **Les paiements ne doivent pas être ouverts avant les deux points précédents.**
4. **Raccordement d'un opérateur SMS** : sans lui, les messages s'empilent dans
   `messages_sortants` et aucun client ne termine son parcours.
5. **Retrait du jeu de démonstration.**

Voir `docs/QUESTIONS.md` pour le détail de chacun.
