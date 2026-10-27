"""Fourchettes de prix indicatifs, par métier et par unité.

**Données d'exemple, à faire valider par Arcel** (`docs/QUESTIONS.md`, Q1 et Q8). Le fichier
annoncé comme fourni était absent du dépôt. Les fourchettes ci-dessous sont des ordres de
grandeur pour l'Île-de-France, en euros **TTC**, destinés à donner un repère au visiteur — jamais
à engager un professionnel. Le guide des prix l'écrit noir sur blanc, et chaque entrée porte
`aValider: true` tant qu'Arcel ne l'a pas confirmée.

Taux de TVA retenus :
  * **5,5 %** : travaux d'amélioration de la performance énergétique d'un logement de plus de
    deux ans, et travaux induits.
  * **10 %** : travaux d'amélioration, de transformation, d'aménagement et d'entretien d'un
    logement achevé depuis plus de deux ans.
  * **20 %** : prestations de services, entretien courant, véhicules, événementiel, et travaux
    sur un logement de moins de deux ans.

Le taux réel dépend du logement et du chantier : il est confirmé sur le devis du professionnel,
pas ici. `devisConforme` dans `packages/core` vérifie que le devis porte bien ses mentions.

Format : slug de métier → {"tva": taux, "bandes": {unité: (min TTC, max TTC)}}.
Une prestation sans bande propre hérite de celle de son métier pour son unité.
"""

from __future__ import annotations

# fmt: off

PRIX_PAR_METIER: dict[str, dict] = {
    # --- Plomberie et chauffage ---------------------------------------------
    "plombier": {"tva": 10, "bandes": {"forfait": (90, 350), "unite": (110, 420)}},
    "chauffagiste": {"tva": 10, "bandes": {"forfait": (110, 420), "unite": (180, 4500)}},
    "installateur-sanitaire": {"tva": 10, "bandes": {"forfait": (450, 6500), "unite": (250, 1800)}},
    "debouchage-et-assainissement": {"tva": 10, "bandes": {"forfait": (140, 650)}},

    # --- Électricité et domotique -------------------------------------------
    "electricien": {"tva": 10, "bandes": {"forfait": (110, 1900), "unite": (90, 1600)}},
    "domoticien": {"tva": 10, "bandes": {"forfait": (280, 2200), "heure": (55, 90), "unite": (320, 1400)}},
    "installateur-de-borne-de-recharge": {"tva": 10, "bandes": {"forfait": (180, 900), "unite": (900, 2200)}},
    "depannage-electrique-d-urgence": {"tva": 10, "bandes": {"forfait": (120, 480), "unite": (120, 320)}},

    # --- Serrurerie et sécurité ---------------------------------------------
    "serrurier": {"tva": 10, "bandes": {"forfait": (90, 420), "unite": (120, 650)}},
    "installateur-d-alarme": {"tva": 10, "bandes": {"forfait": (250, 2400), "unite": (120, 480)}},
    "vitrier": {"tva": 10, "bandes": {"forfait": (180, 700), "m2": (120, 420), "ml": (25, 70), "unite": (150, 600)}},
    "installateur-de-porte-blindee": {"tva": 10, "bandes": {"forfait": (450, 3500), "unite": (900, 4500)}},

    # --- Rénovation et second œuvre -----------------------------------------
    "peintre-en-batiment": {"tva": 10, "bandes": {"forfait": (350, 2200), "m2": (22, 48), "ml": (14, 32)}},
    "plaquiste": {"tva": 10, "bandes": {"forfait": (180, 900), "m2": (45, 95), "unite": (90, 260)}},
    "carreleur": {"tva": 10, "bandes": {"m2": (45, 110), "ml": (18, 45)}},
    "menuisier": {"tva": 10, "bandes": {"forfait": (450, 4500), "m2": (55, 140), "ml": (350, 1400), "unite": (280, 1600)}},
    "poseur-de-sols-souples": {"tva": 10, "bandes": {"m2": (28, 75), "unite": (12, 35)}},

    # --- Maçonnerie, toiture et façade --------------------------------------
    "macon": {"tva": 10, "bandes": {"forfait": (900, 6500), "m2": (85, 190), "ml": (70, 220), "unite": (280, 900)}},
    "couvreur": {"tva": 10, "bandes": {"forfait": (280, 1800), "m2": (35, 180), "ml": (45, 110), "unite": (420, 1400)}},
    "facadier": {"tva": 10, "bandes": {"m2": (35, 160), "ml": (45, 140)}},
    "charpentier": {"tva": 10, "bandes": {"forfait": (650, 5500), "m2": (28, 180), "unite": (350, 1600)}},
    "etancheur": {"tva": 10, "bandes": {"forfait": (350, 2400), "m2": (55, 160), "ml": (60, 180)}},

    # --- Énergie et confort (TVA réduite sur la rénovation énergétique) ------
    "installateur-de-pompe-a-chaleur": {"tva": 5.5, "bandes": {"forfait": (180, 1200), "unite": (8000, 18000)}},
    "installateur-de-panneaux-solaires": {"tva": 5.5, "bandes": {"forfait": (450, 14000), "m2": (12, 35), "unite": (3500, 9000)}},
    "climaticien": {"tva": 10, "bandes": {"forfait": (120, 650), "unite": (1400, 4500)}},
    "specialiste-de-l-isolation": {"tva": 5.5, "bandes": {"forfait": (550, 1400), "m2": (25, 110), "ml": (18, 55)}},

    # --- Ménage et entretien de la maison -----------------------------------
    "menage-a-domicile": {"tva": 20, "bandes": {"forfait": (120, 450), "heure": (24, 38), "m2": (4, 12)}},
    "repassage-et-linge": {"tva": 20, "bandes": {"forfait": (45, 180), "heure": (22, 35), "unite": (6, 28)}},
    "nettoyage-de-vitres": {"tva": 20, "bandes": {"forfait": (90, 320), "m2": (6, 18), "unite": (12, 45)}},
    "remise-en-etat-de-logement": {"tva": 20, "bandes": {"forfait": (180, 900), "m2": (8, 22)}},

    # --- Canapés, matelas, tapis et textiles --------------------------------
    "nettoyage-de-canape-et-fauteuil": {"tva": 20, "bandes": {"forfait": (45, 150), "unite": (70, 280)}},
    "nettoyage-de-matelas": {"tva": 20, "bandes": {"forfait": (45, 140), "unite": (60, 180)}},
    "nettoyage-de-tapis-moquettes-et-rideaux": {"tva": 20, "bandes": {"m2": (12, 45), "unite": (35, 120)}},

    # --- Nettoyage professionnel --------------------------------------------
    "nettoyage-de-bureaux": {"tva": 20, "bandes": {"forfait": (90, 450), "m2": (2, 7)}},
    "nettoyage-de-copropriete": {"tva": 20, "bandes": {"forfait": (150, 900), "m2": (2, 6)}},
    "nettoyage-de-fin-de-chantier": {"tva": 20, "bandes": {"forfait": (180, 750), "m2": (6, 18)}},
    "nettoyage-industriel-et-specialise": {"tva": 20, "bandes": {"forfait": (250, 1500), "m2": (3, 14)}},

    # --- Jardin et espaces verts --------------------------------------------
    "jardinier": {"tva": 20, "bandes": {"forfait": (90, 420), "heure": (28, 48), "m2": (1, 6), "ml": (5, 18)}},
    "elagueur": {"tva": 20, "bandes": {"forfait": (180, 900), "unite": (150, 1400)}},
    "paysagiste": {"tva": 20, "bandes": {"forfait": (900, 9000), "m2": (45, 180), "ml": (60, 220)}},
    "entretien-de-piscine": {"tva": 20, "bandes": {"forfait": (90, 650)}},

    # --- Bricolage et petits travaux ----------------------------------------
    "homme-ou-femme-toutes-mains": {"tva": 20, "bandes": {"heure": (38, 65), "ml": (15, 45), "unite": (25, 120)}},
    "montage-de-meubles": {"tva": 20, "bandes": {"ml": (90, 260), "unite": (45, 220)}},
    "petites-reparations": {"tva": 20, "bandes": {"forfait": (70, 280), "ml": (15, 45), "unite": (45, 180)}},

    # --- Déménagement et transport ------------------------------------------
    "demenageur": {"tva": 20, "bandes": {"forfait": (450, 3500), "unite": (250, 900)}},
    "garde-meuble-et-stockage": {"tva": 20, "bandes": {"forfait": (45, 350)}},
    "transport-et-livraison": {"tva": 20, "bandes": {"forfait": (60, 350), "heure": (45, 90), "unite": (45, 180)}},
    "debarras-et-evacuation": {"tva": 20, "bandes": {"forfait": (250, 1800), "m2": (18, 55)}},

    # --- Nuisibles et hygiène ------------------------------------------------
    "deratisation": {"tva": 10, "bandes": {"forfait": (120, 650), "m2": (2, 8)}},
    "desinsectisation": {"tva": 10, "bandes": {"forfait": (150, 1200), "m2": (8, 35), "unite": (90, 280)}},
    "desinfection-et-traitement-du-bois": {"tva": 10, "bandes": {"forfait": (180, 900), "m2": (12, 65)}},

    # --- Électroménager et multimédia ---------------------------------------
    "reparateur-d-electromenager": {"tva": 20, "bandes": {"forfait": (90, 320), "unite": (80, 280)}},
    "installateur-tv-son-et-antenne": {"tva": 10, "bandes": {"forfait": (120, 650), "ml": (8, 25), "unite": (70, 350)}},
    "depannage-informatique-et-reseau": {"tva": 20, "bandes": {"forfait": (70, 320), "heure": (45, 85), "ml": (8, 22), "unite": (60, 180)}},

    # --- Auto, moto et vélo ---------------------------------------------------
    "nettoyage-de-voiture-a-domicile": {"tva": 20, "bandes": {"unite": (45, 350)}},
    "mecanicien-a-domicile": {"tva": 20, "bandes": {"forfait": (90, 900), "unite": (90, 280)}},
    "carrosserie-et-pare-brise": {"tva": 20, "bandes": {"forfait": (180, 1200), "unite": (90, 900)}},
    "reparateur-de-velo-et-de-trottinette": {"tva": 20, "bandes": {"forfait": (35, 180), "unite": (15, 450)}},

    # --- Services à la personne ---------------------------------------------
    "garde-d-enfants": {"tva": 20, "bandes": {"heure": (14, 24), "jour": (90, 160)}},
    "aide-aux-seniors": {"tva": 20, "bandes": {"heure": (24, 38), "jour": (140, 260)}},
    "soutien-scolaire": {"tva": 20, "bandes": {"heure": (25, 55), "jour": (120, 280)}},
    "garde-d-animaux": {"tva": 20, "bandes": {"forfait": (35, 150), "heure": (15, 30), "jour": (20, 55), "unite": (12, 45)}},

    # --- Beauté et bien-être à domicile -------------------------------------
    "coiffeur-a-domicile": {"tva": 20, "bandes": {"forfait": (90, 350), "unite": (25, 140)}},
    "estheticienne-a-domicile": {"tva": 20, "bandes": {"forfait": (70, 280), "unite": (25, 110)}},
    "masseur-bien-etre": {"tva": 20, "bandes": {"forfait": (45, 120), "heure": (60, 130)}},
    "prothesiste-ongulaire": {"tva": 20, "bandes": {"unite": (25, 90)}},

    # --- Événements et réceptions -------------------------------------------
    "traiteur": {"tva": 20, "bandes": {"forfait": (250, 1800), "heure": (28, 55), "unite": (18, 110)}},
    "photographe-et-videaste": {"tva": 20, "bandes": {"forfait": (250, 2800)}},
    "animation-sonorisation-et-decoration": {"tva": 20, "bandes": {"forfait": (250, 2200), "heure": (45, 95)}},
}
# fmt: on
