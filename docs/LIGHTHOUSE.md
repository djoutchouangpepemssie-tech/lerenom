# Lighthouse mobile

La porte de validation de la phase 2 exige **≥ 90 sur mobile**. Elle n'avait jamais été
mesurée : une exigence qu'on ne mesure pas est un souhait.

```sh
LERENOM_ENV=production pnpm --filter @lerenom/web start   # dans un autre terminal
node scripts/lighthouse.mjs
```

## Dernière mesure

| Gabarit                  | Performance | Accessibilité | Bonnes pratiques | Référencement |
| ------------------------ | ----------: | ------------: | ---------------: | ------------: |
| Accueil                  |          93 |            96 |              100 |           100 |
| Île-de-France            |          91 |            96 |              100 |           100 |
| Département              |          98 |            96 |              100 |           100 |
| Ville                    |          99 |            96 |              100 |           100 |
| Métier                   |          98 |            96 |              100 |           100 |
| Résultats métier × ville |          98 |            96 |              100 |           100 |
| Fiche entreprise         |         100 |            96 |              100 |           100 |
| Guide des prix           |          91 |            97 |              100 |           100 |
| Professionnels et tarifs |          98 |            96 |              100 |           100 |
| Demande de devis         |          98 |            96 |              100 |           100 |

## Ce qu'il a fallu corriger pour y arriver

**Deux animations infinies peignaient en permanence.** La pulsation d'un repère animait
`box-shadow`, une propriété de peinture : le navigateur redessinait la zone à chaque image,
pour toujours. Et deux fenêtres sur trois des toits de Paris — près de 235 — portaient chacune
leur propre animation infinie, déclarée en style en ligne, donc recopiée dans le balisage puis
dans la charge d'hydratation de React.

Règle qui en découle, écrite dans la feuille de style : **une animation infinie n'anime que
`transform`, `scale`, `translate`, `rotate` ou `opacity`.** Une animation qui s'arrête peut se
permettre davantage ; une animation qui ne s'arrête jamais, non.

**La page Île-de-France rendait 1 285 lignes dont quinze sont visibles.** Le transfert n'était
pas en cause — 80 Kio une fois compressé — mais la mise en page et la peinture de 875 Kio de
balisage, si. `content-visibility: auto` laisse tout dans le document, pour les moteurs comme
pour les lecteurs d'écran, et autorise le navigateur à sauter ce qui est hors écran.

**Deux couleurs échouaient au contraste AA.** Corrigées au niveau des jetons, donc partout à
la fois. Le détail et la conséquence sur la hiérarchie des gris sont en `QUESTIONS.md` Q32.

## Deux pièges de mesure, à ne pas retomber dedans

**Mesurer en `LERENOM_ENV=production`.** Ailleurs, `robots.ts` interdit l'indexation de tout
le site — à juste titre. Mesuré en développement, le référencement tombe à 63 et le seul grief
est « page bloquée à l'indexation » : on mesure le réglage, pas la page.

**Un navigateur neuf par page.** Enchaîner dix mesures dans une même instance fait dériver les
scores : l'accueil rendait 94 seul et 87 en huitième position, sur la même construction. Un
chiffre qui dépend de l'ordre de passage ne mesure rien.

## Ce qui n'est pas compté comme un défaut

L'accessibilité plafonne à 96 sur les pages qui portent le filigrane décoratif du pied de
page. Il est `aria-hidden`, sans interaction possible, et fait pour ne pas se lire — c'est une
texture. Le ramener à 100 demanderait de déformer un élément dont le rôle est d'être
invisible.
