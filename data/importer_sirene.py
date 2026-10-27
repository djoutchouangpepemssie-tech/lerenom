#!/usr/bin/env python3
"""Importe les établissements d'Île-de-France depuis la base SIRENE de l'Insee.

Règle stratégique : **tout importer, ne pas tout indexer.** Publier des millions de fiches qui
ne contiennent que les données SIRENE serait du contenu reproduit à grande échelle, exactement
ce que les règles anti-spam de Google sanctionnent — et une sanction porte sur le domaine entier.
Une fiche devient indexable quand elle est enrichie : revendiquée, avec des avis, des photos,
des horaires ou des services. Cette règle-là vit dans le rendu de la page, pas ici.

**Statut de diffusion.** Environ 11 % des entrepreneurs individuels refusent la diffusion de
leurs données. Pour eux, le nom, l'adresse précise et la géolocalisation sont masqués. Ce n'est
pas une préférence d'affichage : c'est une obligation, et elle est appliquée **à l'import**, de
sorte qu'une donnée non diffusible n'entre jamais en base en clair.

**Licence.** SIRENE est publiée sous Licence Ouverte 2.0. La mention de la source *et de la date
de mise à jour* est obligatoire sur les pages qui en affichent les données.

**Ce script a besoin d'un accès à `data.gouv.fr` (fichier Stock) ou à `api.insee.fr`.**
Sans cet accès, il s'arrête en le disant : il n'invente pas d'entreprises.

Usage :
    python3 -I data/importer_sirene.py --fichier StockEtablissement_utf8.zip
    python3 -I data/importer_sirene.py --essai
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import zipfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

DEPARTEMENTS_IDF = {"75", "77", "78", "91", "92", "93", "94", "95"}

# Colonnes du fichier Stock Établissement de l'Insee.
COLONNES = {
    "siret": "siret",
    "siren": "siren",
    "diffusion": "statutDiffusionEtablissement",
    "actif": "etatAdministratifEtablissement",
    "naf": "activitePrincipaleEtablissement",
    "enseigne": "enseigne1Etablissement",
    "denomination": "denominationUsuelleEtablissement",
    "numero_voie": "numeroVoieEtablissement",
    "type_voie": "typeVoieEtablissement",
    "libelle_voie": "libelleVoieEtablissement",
    "code_postal": "codePostalEtablissement",
    "commune": "codeCommuneEtablissement",
    "libelle_commune": "libelleCommuneEtablissement",
}


def est_diffusible(ligne: dict[str, str]) -> bool:
    """« O » = diffusible. Toute autre valeur impose de masquer nom, adresse et position."""
    return ligne.get(COLONNES["diffusion"], "").strip().upper() == "O"


def est_actif(ligne: dict[str, str]) -> bool:
    return ligne.get(COLONNES["actif"], "").strip().upper() == "A"


def en_ile_de_france(ligne: dict[str, str]) -> bool:
    commune = ligne.get(COLONNES["commune"], "")
    return len(commune) >= 2 and commune[:2] in DEPARTEMENTS_IDF


def nom_affichable(ligne: dict[str, str]) -> str | None:
    """Le nom public de l'établissement, ou None s'il n'est pas diffusible."""
    if not est_diffusible(ligne):
        return None
    for cle in ("enseigne", "denomination"):
        valeur = (ligne.get(COLONNES[cle]) or "").strip()
        if valeur:
            return valeur
    return None


def adresse_affichable(ligne: dict[str, str]) -> str | None:
    """L'adresse précise, masquée pour un établissement non diffusible."""
    if not est_diffusible(ligne):
        return None
    morceaux = [
        (ligne.get(COLONNES["numero_voie"]) or "").strip(),
        (ligne.get(COLONNES["type_voie"]) or "").strip(),
        (ligne.get(COLONNES["libelle_voie"]) or "").strip(),
    ]
    adresse = " ".join(m for m in morceaux if m)
    return adresse or None


def parcourt(chemin: Path):
    """Lit le fichier Stock, compressé ou non, ligne par ligne sans tout charger en mémoire."""
    if chemin.suffix == ".zip":
        with zipfile.ZipFile(chemin) as archive:
            nom = next(n for n in archive.namelist() if n.endswith(".csv"))
            with archive.open(nom) as brut:
                yield from csv.DictReader(io.TextIOWrapper(brut, encoding="utf-8"))
    else:
        with chemin.open(encoding="utf-8") as fichier:
            yield from csv.DictReader(fichier)


def main() -> None:
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--fichier", type=Path, help="StockEtablissement_utf8.zip ou .csv")
    analyseur.add_argument("--sortie", type=Path, default=RACINE / "data" / "brut" / "sirene-idf.jsonl")
    analyseur.add_argument("--essai", action="store_true", help="n'écrit rien, compte seulement")
    arguments = analyseur.parse_args()

    if arguments.fichier is None:
        raise SystemExit(
            "Aucun fichier fourni.\n"
            "Le fichier Stock Établissement se télécharge sur data.gouv.fr "
            "(« Base SIRENE des entreprises et de leurs établissements »).\n"
            "Si data.gouv.fr est refusé par la politique réseau de cet environnement, "
            "lancez ce script là où cet hôte est joignable : les entreprises ne s'inventent pas."
        )
    if not arguments.fichier.exists():
        raise SystemExit(f"Fichier introuvable : {arguments.fichier}")

    arguments.sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie = None if arguments.essai else arguments.sortie.open("w", encoding="utf-8")

    lus = retenus = masques = 0
    try:
        for ligne in parcourt(arguments.fichier):
            lus += 1
            if not est_actif(ligne) or not en_ile_de_france(ligne):
                continue

            diffusible = est_diffusible(ligne)
            if not diffusible:
                masques += 1

            retenus += 1
            if sortie is not None:
                enregistrement = {
                    "siret": ligne[COLONNES["siret"]],
                    "siren": ligne[COLONNES["siren"]],
                    "nom": nom_affichable(ligne),
                    "codeNaf": ligne.get(COLONNES["naf"]),
                    "adresse": adresse_affichable(ligne),
                    "codePostal": ligne.get(COLONNES["code_postal"]),
                    "communeCode": ligne.get(COLONNES["commune"]),
                    "diffusible": diffusible,
                }
                sortie.write(json.dumps(enregistrement, ensure_ascii=False) + "\n")

            if lus % 500_000 == 0:
                print(f"  {lus:>10} lignes lues, {retenus:>8} retenues", file=sys.stderr)
    finally:
        if sortie is not None:
            sortie.close()

    part = (masques / retenus * 100) if retenus else 0
    print(f"{lus} lignes lues")
    print(f"{retenus} établissements actifs d'Île-de-France retenus")
    print(f"{masques} non diffusibles ({part:.1f} %) : nom, adresse et position masqués")
    if not arguments.essai:
        print(f"Écrit dans {arguments.sortie}")


if __name__ == "__main__":
    main()
