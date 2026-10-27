#!/usr/bin/env python3
"""Construit `donnees/prix-indicatifs.json` à partir du catalogue et de `data/prix_source.py`.

Chaque prestation reçoit une fourchette TTC, héritée de la bande de son métier pour son unité.
Le fichier dit explicitement d'où vient chaque fourchette : tant qu'Arcel n'a pas validé, elles
sont marquées `estimation` et le guide des prix l'écrit au visiteur.

Le script échoue si une prestation n'a pas de fourchette : une prestation affichée sans prix dans
le guide des prix serait un trou visible, et un estimateur qui ne sait pas répondre vaut moins
qu'un estimateur qui n'existe pas.

Usage :
    python3 data/construire_prix.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "data"))

from prix_source import PRIX_PAR_METIER  # noqa: E402

CATALOGUE = RACINE / "donnees" / "catalogue.json"
SORTIE = RACINE / "donnees" / "prix-indicatifs.json"

LIBELLES_UNITE = {
    "forfait": "le forfait",
    "heure": "de l'heure",
    "unite": "l'unité",
    "m2": "le mètre carré",
    "ml": "le mètre linéaire",
    "jour": "la journée",
}


def main() -> None:
    if not CATALOGUE.exists():
        raise SystemExit(
            "donnees/catalogue.json est absent. Lancez d'abord data/construire_catalogue.py."
        )

    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))

    metiers_sortie = []
    manquants: list[str] = []
    total_prestations = 0

    for univers in catalogue["univers"]:
        for metier in univers["metiers"]:
            source = PRIX_PAR_METIER.get(metier["slug"])
            if source is None:
                manquants.append(f"métier sans fourchette : {metier['slug']}")
                continue

            prestations_sortie = []
            for prestation in metier["prestations"]:
                bande = source["bandes"].get(prestation["unite"])
                if bande is None:
                    manquants.append(
                        f"{metier['slug']} → {prestation['slug']} : pas de bande pour "
                        f"l'unité « {prestation['unite']} »"
                    )
                    continue

                minimum, maximum = bande
                total_prestations += 1
                prestations_sortie.append(
                    {
                        "slug": prestation["slug"],
                        "nom": prestation["nom"],
                        "unite": prestation["unite"],
                        "libelleUnite": LIBELLES_UNITE[prestation["unite"]],
                        "minTTC": minimum,
                        "maxTTC": maximum,
                        "source": "estimation",
                        "aValider": True,
                    }
                )

            metiers_sortie.append(
                {
                    "slug": metier["slug"],
                    "nom": metier["nom"],
                    "univers": univers["slug"],
                    "tauxTva": source["tva"],
                    "bandes": {
                        unite: {"minTTC": bande[0], "maxTTC": bande[1]}
                        for unite, bande in source["bandes"].items()
                    },
                    "prestations": prestations_sortie,
                }
            )

    if manquants:
        for ligne in manquants:
            print(f"  ✗ {ligne}")
        raise SystemExit(
            f"{len(manquants)} prestation(s) sans fourchette de prix. "
            "Complétez data/prix_source.py : le guide des prix ne doit pas avoir de trou."
        )

    sortie = {
        "source": {
            "nature": "estimation",
            "zone": "Île-de-France",
            "devise": "EUR",
            "mention": (
                "Fourchettes indicatives TTC, données à titre de repère et non validées. "
                "Seul un devis détaillé engage le professionnel. "
                "À faire valider par Arcel (docs/QUESTIONS.md, Q1 et Q8)."
            ),
            "tva": {
                "5.5": "Travaux d'amélioration de la performance énergétique et travaux induits.",
                "10": "Travaux d'entretien et d'amélioration d'un logement de plus de deux ans.",
                "20": "Prestations de services, véhicules, événementiel, logement de moins de deux ans.",
            },
        },
        "metiers": metiers_sortie,
    }

    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"{SORTIE.relative_to(RACINE)}")
    print(f"  {len(metiers_sortie)} métiers · {total_prestations} prestations avec fourchette")
    repartition: dict[float, int] = {}
    for metier in metiers_sortie:
        repartition[metier["tauxTva"]] = repartition.get(metier["tauxTva"], 0) + 1
    for taux in sorted(repartition):
        print(f"  TVA {taux} % : {repartition[taux]} métiers")


if __name__ == "__main__":
    main()
