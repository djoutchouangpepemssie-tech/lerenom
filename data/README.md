# Scripts de données

Scripts Python qui construisent les fichiers de `donnees/` et alimenteront la base.
Ils s'exécutent avec `python3 -I` (sans répertoire courant dans le chemin d'import).

| Script                    | Produit                               | Réseau nécessaire              |
| ------------------------- | ------------------------------------- | ------------------------------ |
| `construire_communes.py`  | `donnees/communes-ile-de-france.json` | `registry.npmjs.org`           |
| `construire_catalogue.py` | `donnees/catalogue.json`              | aucun                          |
| `construire_prix.py`      | `donnees/prix-indicatifs.json`        | aucun                          |
| `geocoder_communes.py`    | ajoute les coordonnées aux communes   | `geo.api.gouv.fr`              |
| `importer_sirene.py`      | table `entreprises`                   | `data.gouv.fr`, `api.insee.fr` |

Les sources de données éditées à la main sont `catalogue_source.py` et `prix_source.py` :
ce sont elles qu'Arcel valide, les scripts ne font que les mettre en forme.

```bash
python3 -I data/construire_communes.py
python3 -I data/construire_catalogue.py
python3 -I data/construire_prix.py
```

## Licences et mentions obligatoires

- **Découpage administratif** : Insee, distribué par Etalab, Licence Ouverte 2.0.
  Mention à afficher : « Source : Insee, découpage administratif distribué par Etalab ».
- **SIRENE** : Insee, Licence Ouverte 2.0. Mention de la source **et de la date de mise à
  jour** obligatoire. Le **statut de diffusion** de chaque entrepreneur individuel doit être
  respecté : pour les quelque 11 % qui refusent la diffusion, le nom, l'adresse précise et la
  géolocalisation sont masqués.
- **Base Adresse Nationale** : Licence Ouverte 2.0.
