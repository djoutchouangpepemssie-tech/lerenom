#!/usr/bin/env python3
"""Construit `donnees/communes-ile-de-france.json` depuis la source officielle.

La source est le découpage administratif de l'Insee, distribué par Etalab dans le paquet npm
`@etalab/decoupage-administratif`. Le script télécharge l'archive depuis le registre npm, en
extrait le seul fichier de données dont il a besoin, et ne l'exécute jamais.

Résultat attendu, conforme au cahier des charges : 1 285 entrées, soit 1 265 communes et les
20 arrondissements de Paris. Paris en tant que commune (code 75056) est volontairement remplacé
par ses 20 arrondissements : sur Le Renom, une page est un métier dans une ville, et à Paris
l'échelle utile est l'arrondissement.

Les coordonnées ne sont pas renseignées ici. Elles viennent de la Base Adresse Nationale, par
`data/geocoder_communes.py`, qui a besoin d'un accès à `geo.api.gouv.fr`.

Usage :
    python3 data/construire_communes.py
"""

from __future__ import annotations

import io
import json
import re
import tarfile
import unicodedata
import urllib.request
from pathlib import Path

PAQUET = "@etalab/decoupage-administratif"
VERSION = "6.0.0"
RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "donnees" / "communes-ile-de-france.json"

DEPARTEMENTS = {
    "75": "Paris",
    "77": "Seine-et-Marne",
    "78": "Yvelines",
    "91": "Essonne",
    "92": "Hauts-de-Seine",
    "93": "Seine-Saint-Denis",
    "94": "Val-de-Marne",
    "95": "Val-d'Oise",
}

# Statuts d'ouverture initiaux (cahier des charges §3). Modifiables ensuite dans le back-office.
OUVERTES = {"75109", "75111", "75120", "93048", "94080"}
BIENTOT = {"75112", "94067", "93006"}


def slugifie(texte: str) -> str:
    """Un segment d'URL stable : sans accent, sans apostrophe, en minuscules."""
    sans_accent = unicodedata.normalize("NFKD", texte)
    sans_accent = "".join(c for c in sans_accent if not unicodedata.combining(c))
    sans_accent = sans_accent.replace("'", "-").replace("’", "-")
    sans_accent = re.sub(r"[^A-Za-z0-9]+", "-", sans_accent)
    return sans_accent.strip("-").lower()


def telecharge_donnees() -> list[dict]:
    """Récupère `data/communes.json` depuis l'archive npm, sans jamais exécuter le paquet."""
    nom_archive = f"{PAQUET.split('/')[1]}-{VERSION}.tgz"
    url = f"https://registry.npmjs.org/{PAQUET}/-/{nom_archive}"
    print(f"Téléchargement de {url}")

    with urllib.request.urlopen(url, timeout=120) as reponse:  # noqa: S310 — URL fixe du registre
        archive = io.BytesIO(reponse.read())

    with tarfile.open(fileobj=archive, mode="r:gz") as tar:
        membre = tar.extractfile("package/data/communes.json")
        if membre is None:
            raise SystemExit("Le fichier package/data/communes.json est absent de l'archive.")
        return json.load(membre)


def construit() -> dict:
    toutes = telecharge_donnees()

    retenues: list[dict] = []
    for entree in toutes:
        departement = entree.get("departement")
        if departement not in DEPARTEMENTS:
            continue

        type_entree = entree["type"]
        # Les communes déléguées et associées ne sont pas des entités d'adressage autonomes :
        # elles sont rattachées à leur commune de rattachement, qui est déjà dans la liste.
        if type_entree not in {"commune-actuelle", "arrondissement-municipal"}:
            continue
        # Paris en tant que commune est remplacée par ses 20 arrondissements.
        if entree["code"] == "75056":
            continue

        codes_postaux = entree.get("codesPostaux", [])
        est_arrondissement = type_entree == "arrondissement-municipal"

        if est_arrondissement:
            numero = int(entree["code"][-2:])
            slug = f"paris-{numero}"
        else:
            principal = codes_postaux[0] if codes_postaux else entree["code"]
            slug = f"{slugifie(entree['nom'])}-{principal}"

        code = entree["code"]
        retenues.append(
            {
                "code": code,
                "nom": entree["nom"],
                "slug": slug,
                "departement": departement,
                "nomDepartement": DEPARTEMENTS[departement],
                "codesPostaux": codes_postaux,
                "population": entree.get("population"),
                "arrondissementDeParis": est_arrondissement,
                "statut": "ouvert" if code in OUVERTES else "bientot" if code in BIENTOT else "annuaire",
                # Renseignées par data/geocoder_communes.py, depuis la Base Adresse Nationale.
                "latitude": None,
                "longitude": None,
                "sourceCoordonnees": None,
            }
        )

    retenues.sort(key=lambda c: (c["departement"], c["code"]))

    par_departement: dict[str, int] = {}
    for commune in retenues:
        par_departement[commune["departement"]] = par_departement.get(commune["departement"], 0) + 1

    slugs = [c["slug"] for c in retenues]
    doublons = sorted({s for s in slugs if slugs.count(s) > 1})
    if doublons:
        raise SystemExit(f"Slugs en double, les URL ne seraient pas uniques : {doublons}")

    return {
        "source": {
            "nom": "Insee — découpage administratif, distribué par Etalab",
            "paquet": f"{PAQUET}@{VERSION}",
            "licence": "Licence Ouverte 2.0",
            "mention": "Source : Insee, découpage administratif distribué par Etalab (Licence Ouverte 2.0).",
        },
        "departements": [
            {"code": code, "nom": nom, "entrees": par_departement.get(code, 0)}
            for code, nom in sorted(DEPARTEMENTS.items())
        ],
        "statuts": {
            "ouvert": "Les demandes de devis sont actives.",
            "bientot": "La ville ouvre prochainement ; le visiteur peut demander à être prévenu.",
            "annuaire": "Les fiches sont consultables ; une demande déposée ne part pas chez les pros.",
        },
        "communes": retenues,
    }


def main() -> None:
    donnees = construit()
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    total = len(donnees["communes"])
    arrondissements = sum(1 for c in donnees["communes"] if c["arrondissementDeParis"])
    print(f"{SORTIE.relative_to(RACINE)} : {total} entrées")
    print(f"  dont {arrondissements} arrondissements de Paris et {total - arrondissements} communes")
    for departement in donnees["departements"]:
        print(f"  {departement['code']} {departement['nom']:<20} {departement['entrees']:>4}")

    ouvertes = [c["nom"] for c in donnees["communes"] if c["statut"] == "ouvert"]
    bientot = [c["nom"] for c in donnees["communes"] if c["statut"] == "bientot"]
    print(f"  ouvertes : {', '.join(ouvertes)}")
    print(f"  bientôt  : {', '.join(bientot)}")


if __name__ == "__main__":
    main()
