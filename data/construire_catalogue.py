#!/usr/bin/env python3
"""Construit `donnees/catalogue.json` à partir de `data/catalogue_source.py`.

Le catalogue est l'arborescence unique de toute la plateforme : fiches, inscription pro,
demandes de devis, pages publiques, statistiques et classement automatique s'y réfèrent.

Les compteurs affichés sur le site (« 18 univers · 69 métiers · 479 prestations ») sont
**calculés à partir de ce fichier**, jamais écrits en dur : si Arcel ajoute un métier, le site
affiche 70 sans qu'une ligne de code change.

Usage :
    python3 data/construire_catalogue.py
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "data"))

from catalogue_source import UNIVERS  # noqa: E402

SORTIE = RACINE / "donnees" / "catalogue.json"

# Les comptes annoncés par la règle validée n° 13. Le script échoue s'ils ne tombent pas juste :
# un écart signifie que l'arborescence a bougé sans décision.
ATTENDU = {"univers": 18, "metiers": 69, "prestations": 479}

UNITES_VALIDES = {"forfait", "heure", "unite", "m2", "ml", "jour"}


def slugifie(texte: str) -> str:
    sans_accent = unicodedata.normalize("NFKD", texte)
    sans_accent = "".join(c for c in sans_accent if not unicodedata.combining(c))
    sans_accent = sans_accent.replace("'", "-").replace("’", "-")
    sans_accent = re.sub(r"[^A-Za-z0-9]+", "-", sans_accent)
    return sans_accent.strip("-").lower()


def construit() -> dict:
    univers_sortie = []
    slugs_metier: dict[str, str] = {}
    slugs_prestation: set[str] = set()

    for rang_univers, univers in enumerate(UNIVERS, start=1):
        slug_univers = slugifie(univers["nom"])
        metiers_sortie = []

        for rang_metier, (nom, codes_naf, mots_cles, prestations) in enumerate(
            univers["metiers"], start=1
        ):
            slug_metier = slugifie(nom)
            if slug_metier in slugs_metier:
                raise SystemExit(
                    f"Deux métiers portent le slug « {slug_metier} » : « {nom} » et "
                    f"« {slugs_metier[slug_metier]} ». Les URL /{slug_metier} ne seraient pas uniques."
                )
            slugs_metier[slug_metier] = nom

            prestations_sortie = []
            # Le badge « Très demandé » n'a de valeur que s'il reste rare : on le plafonne à
            # deux prestations par métier. Au-delà, il décorerait la moitié du catalogue et ne
            # dirait plus rien au visiteur.
            restant_tres_demande = 2
            for rang_prestation, (nom_prestation, unite, tres_demande) in enumerate(
                prestations, start=1
            ):
                if tres_demande and restant_tres_demande > 0:
                    restant_tres_demande -= 1
                else:
                    tres_demande = False
                if unite not in UNITES_VALIDES:
                    raise SystemExit(f"Unité inconnue « {unite} » sur « {nom_prestation} ».")

                slug_prestation = f"{slug_metier}--{slugifie(nom_prestation)}"
                if slug_prestation in slugs_prestation:
                    raise SystemExit(f"Prestation en double : « {slug_prestation} ».")
                slugs_prestation.add(slug_prestation)

                prestations_sortie.append(
                    {
                        "slug": slug_prestation,
                        "nom": nom_prestation,
                        "unite": unite,
                        "tresDemande": tres_demande,
                        "rang": rang_prestation,
                        "aValider": True,
                    }
                )

            metiers_sortie.append(
                {
                    "slug": slug_metier,
                    "nom": nom,
                    "codesNaf2008": codes_naf,
                    "motsCles": mots_cles,
                    "rang": rang_metier,
                    "aValider": True,
                    "prestations": prestations_sortie,
                }
            )

        univers_sortie.append(
            {
                "slug": slug_univers,
                "nom": univers["nom"],
                "couleur": univers["couleur"],
                "icone": univers["icone"],
                "rang": rang_univers,
                "aValider": True,
                "metiers": metiers_sortie,
            }
        )

    return {
        "source": {
            "nature": "reconstruction",
            "mention": (
                "Arborescence reconstruite à partir du cahier des charges et de l'étude de "
                "faisabilité : le fichier annoncé comme fourni était absent du dépôt. "
                "À faire valider par Arcel (docs/QUESTIONS.md, Q1)."
            ),
            "nomenclature": "Codes NAF 2008, en vigueur jusqu'au 31 décembre 2026.",
        },
        "univers": univers_sortie,
    }


def main() -> None:
    catalogue = construit()

    comptes = {
        "univers": len(catalogue["univers"]),
        "metiers": sum(len(u["metiers"]) for u in catalogue["univers"]),
        "prestations": sum(
            len(m["prestations"]) for u in catalogue["univers"] for m in u["metiers"]
        ),
    }

    if comptes != ATTENDU:
        raise SystemExit(
            f"Les comptes ne correspondent pas à la règle validée n° 13.\n"
            f"  attendu : {ATTENDU}\n  obtenu  : {comptes}"
        )

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(catalogue, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"{SORTIE.relative_to(RACINE)}")
    print(
        f"  {comptes['univers']} univers · {comptes['metiers']} métiers · "
        f"{comptes['prestations']} prestations"
    )
    tres_demandees = sum(
        1
        for u in catalogue["univers"]
        for m in u["metiers"]
        for p in m["prestations"]
        if p["tresDemande"]
    )
    print(f"  dont {tres_demandees} prestations marquées « très demandé »")


if __name__ == "__main__":
    main()
