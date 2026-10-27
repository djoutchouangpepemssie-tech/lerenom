#!/usr/bin/env python3
"""Renseigne les coordonnées des communes depuis la Base Adresse Nationale.

`construire_communes.py` produit la liste exacte des 1 285 communes, mais sans coordonnées :
elles viennent de l'API géographique de l'État, qui expose le centre de chaque commune.

**Ce script a besoin d'un accès à `geo.api.gouv.fr`.** Dans un environnement où cet hôte est
refusé, il s'arrête en le disant clairement plutôt que d'inventer des coordonnées : une
distance fausse, c'est un professionnel éligible à tort ou écarté à tort.

Usage :
    python3 -I data/geocoder_communes.py          # écrit donnees/communes-ile-de-france.json
    python3 -I data/geocoder_communes.py --essai  # vérifie seulement l'accès à l'API
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
FICHIER = RACINE / "donnees" / "communes-ile-de-france.json"

API = "https://geo.api.gouv.fr/communes"
DEPARTEMENTS = ["75", "77", "78", "91", "92", "93", "94", "95"]


def interroge(url: str) -> list[dict]:
    requete = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(requete, timeout=60) as reponse:  # noqa: S310 — hôte fixe
        return json.load(reponse)


def centres_par_code() -> dict[str, tuple[float, float]]:
    """Le centre de chaque commune et de chaque arrondissement d'Île-de-France."""
    centres: dict[str, tuple[float, float]] = {}

    for departement in DEPARTEMENTS:
        url = f"{API}?codeDepartement={departement}&fields=code,centre&format=json"
        for commune in interroge(url):
            centre = commune.get("centre")
            if centre is None:
                continue
            longitude, latitude = centre["coordinates"]
            centres[commune["code"]] = (latitude, longitude)

    # Les arrondissements de Paris ont leur propre point d'entrée.
    for arrondissement in interroge(f"{API}/75056/arrondissements?fields=code,centre&format=json"):
        centre = arrondissement.get("centre")
        if centre is None:
            continue
        longitude, latitude = centre["coordinates"]
        centres[arrondissement["code"]] = (latitude, longitude)

    return centres


def main() -> None:
    essai = "--essai" in sys.argv

    try:
        centres = centres_par_code()
    except (urllib.error.URLError, OSError) as erreur:
        raise SystemExit(
            "Impossible de joindre geo.api.gouv.fr. Les coordonnées ne sont pas inventées : "
            "relancez ce script depuis un environnement qui autorise cet hôte.\n"
            f"Détail : {erreur}"
        ) from erreur

    print(f"{len(centres)} centres récupérés depuis geo.api.gouv.fr")
    if essai:
        return

    donnees = json.loads(FICHIER.read_text(encoding="utf-8"))
    renseignees = 0
    manquantes: list[str] = []

    for commune in donnees["communes"]:
        centre = centres.get(commune["code"])
        if centre is None:
            manquantes.append(f"{commune['code']} {commune['nom']}")
            continue
        commune["latitude"], commune["longitude"] = centre
        commune["sourceCoordonnees"] = "geo.api.gouv.fr"
        renseignees += 1

    donnees["source"]["coordonnees"] = (
        "Centres des communes, API géographique de l'État (Base Adresse Nationale), "
        "Licence Ouverte 2.0."
    )

    FICHIER.write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"{renseignees} communes renseignées sur {len(donnees['communes'])}")
    if manquantes:
        print(f"{len(manquantes)} sans coordonnées :")
        for ligne in manquantes[:20]:
            print(f"  - {ligne}")


if __name__ == "__main__":
    main()
