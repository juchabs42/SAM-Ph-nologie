# SAM Phénologie — Version 2.5

Application web/PWA SudExpé de suivi des stades phénologiques du pommier par degrés-jours.

## Modèles intégrés

### Gala

- modèle variétal WSU ;
- température de base : **6,1 °C (43 °F)** ;
- seuils publiés pour les stades allant de Green Tip à Petal Fall ;
- seuils normalisés dans l'application à **0 DJ au stade Fleckinger C**.

| Stade de l'application | Seuil depuis C (DJ base 6,1 °C) | Construction |
|---|---:|---|
| C | 0,00 | Green Tip, point de départ |
| C3 | 22,84 | ½ inch green |
| D | 75,76 | Tight cluster |
| E | 112,82 | First pink |
| E2 | 147,16 | Full pink |
| F | 185,48 | First bloom |
| F2 | 207,72 | Full bloom |
| G | 234,97 | interpolation entre pleine floraison et chute des pétales |
| H | 262,22 | Petal fall |
| I | 312,22 | prolongation générique : H + 50 DJ |
| J | 382,22 | prolongation générique : H + 120 DJ |

### Cripps Pink / Pink Lady

- modèle variétal WSU ;
- température de base : **6,1 °C (43 °F)** ;
- seuils normalisés à **0 DJ au stade Fleckinger C**.

| Stade de l'application | Seuil depuis C (DJ base 6,1 °C) | Construction |
|---|---:|---|
| C | 0,00 | Green Tip, point de départ |
| C3 | 13,72 | ½ inch green |
| D | 55,26 | Tight cluster |
| E | 82,40 | First pink |
| E2 | 113,45 | Full pink |
| F | 152,61 | First bloom |
| F2 | 181,91 | Full bloom |
| G | 204,91 | interpolation entre pleine floraison et chute des pétales |
| H | 227,90 | Petal fall |
| I | 277,90 | prolongation générique : H + 50 DJ |
| J | 347,90 | prolongation générique : H + 120 DJ |

### Autres variétés

Golden Delicious, Joya, Reine des reinettes, Granny Smith, Ariane, Dalinette, Opale et « Autre variété » restent calculées avec le **modèle générique du pommier, base 5 °C**.

Des publications décrivent des besoins en froid et en chaleur jusqu'à la floraison pour plusieurs cultivars, mais elles ne fournissent pas nécessairement une série de seuils directement compatible avec tous les stades Fleckinger C à J. L'application n'invente donc pas de seuils variétaux pour ces variétés.

## Références principales

- Hoogenboom G., Salazar M. et collaborateurs. *Development of apple bloom phenology and fruit growth models*. Washington Tree Fruit Research Commission / Washington State University, final project report, 2015. Table 2 : seuils de début et de fin des huit stades pour Gala, Cripps Pink et Red Delicious.
- Chaves B. et al. *Modeling apple bloom phenology*. Acta Horticulturae 1160, 2017.

Rapport WSU :
https://treefruitresearch.org/wp-content/uploads/2019/11/Report-723.-Hoogenboom_Final_Report_Apple_2015.pdf

Article Acta Horticulturae :
https://www.actahort.org/books/1160/1160_29.htm

## Limites à retenir

- Le modèle WSU a été établi dans l'État de Washington, sur plusieurs sites et années. Il doit être contrôlé et recalé avec les observations de Marsillargues.
- La correspondance entre la nomenclature WSU et Fleckinger est une adaptation opérationnelle.
- Le stade G est interpolé, car le modèle publié passe directement de Full Bloom à Petal Fall.
- Les seuils I et J ne sont pas publiés dans ce modèle de floraison et sont prolongés avec les incréments du modèle générique.
- Une observation terrain saisie dans l'application reste prioritaire et recale la courbe.

## Fichiers à garder dans GitHub

- `README.md`
- `index.html`
- `style-v7.css`
- `app-v7.js`
- `manifest.webmanifest`
- `service-worker.js`
- `icon.svg`
- `sudexpe-logo.jpg`

Supprimer les anciennes versions `app-v6.js`, `style-v6.css` et tous les fichiers plus anciens.

## Mise à jour GitHub Pages

1. Décompresser le ZIP.
2. Envoyer tous les fichiers à la racine du dépôt GitHub.
3. Supprimer les anciens fichiers JavaScript et CSS.
4. Vérifier que `index.html` charge `style-v7.css` et `app-v7.js`.
5. Recharger le site avec `Ctrl + F5`.
