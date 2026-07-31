# SAM Phénologie

Application web progressive (PWA) de suivi des stades phénologiques du pommier à partir des degrés-jours et des données Open‑Meteo.

## Fonctions

- plusieurs parcelles enregistrées localement ;
- coordonnées saisies ou récupérées par GPS ;
- historique météo depuis le stade B et prévisions sur 16 jours ;
- calcul simple des degrés-jours : `max(0, ((Tmin + Tmax) / 2) - Tbase)` ;
- modèle générique base 5 °C à partir du stade B ;
- affichage Fleckinger + BBCH ;
- recalage automatique à chaque observation terrain ;
- alertes de stade proche et de gel pour les stades sensibles ;
- fonctionnement hors connexion avec les dernières données enregistrées ;
- installation possible sur téléphone.

## Mise en ligne avec GitHub Pages

1. Créer un dépôt GitHub.
2. Déposer tous les fichiers à la racine du dépôt.
3. Ouvrir **Settings > Pages**.
4. Dans **Build and deployment**, choisir **Deploy from a branch**.
5. Sélectionner la branche `main` et le dossier `/ (root)`.
6. Ouvrir l’adresse fournie par GitHub Pages.

Le GPS et le service worker nécessitent une connexion HTTPS. GitHub Pages fournit HTTPS automatiquement.

## Modèle agronomique

La version actuelle utilise un modèle générique de travail, exprimé en degrés-jours base 5 °C à partir du stade B observé. Les seuils sont définis dans `app.js`, constante `STAGES`.

Le modèle doit être considéré comme indicatif : la phénologie du pommier dépend de la variété, de la satisfaction des besoins en froid, du site et de l’année. L’application est conçue pour être recalée par les observations terrain.

### Seuils utilisés dans cette version

| Fleckinger | BBCH | Description | DJ depuis B |
|---|---:|---|---:|
| B | 51 | Bourgeon gonflé | 0 |
| C | 53 | Éclatement des bourgeons | 35 |
| C3 | 54 | Oreille de souris | 65 |
| D | 56 | Bouton vert | 105 |
| E | 57 | Bouton rose | 145 |
| E2 | 59 | Ballonnets | 180 |
| F | 61 | Début floraison | 220 |
| F2 | 65 | Pleine floraison | 260 |
| G | 67 | Floraison déclinante | 300 |
| H | 69 | Fin floraison | 340 |
| I | 71 | Nouaison | 390 |
| J | 72 | Taille noisette | 520 |

## Sources méthodologiques

- Open‑Meteo, documentation des API Forecast et Historical Weather.
- Meier et al., échelle BBCH des plantes cultivées ; correspondances BBCH/Fleckinger du pommier.
- Kronenberg, 1983, discussion des températures de base du pommier, avec une valeur moyenne proche de 4,5 °C selon les approches.
- Travaux de modélisation de la floraison du pommier montrant la dépendance aux besoins en froid, au forçage thermique, au cultivar et au site.

## Limites

- Les données Open‑Meteo sont des données maillées, pas une mesure dans la parcelle.
- L’alerte gel repose sur la température minimale de l’air prévue ; elle ne calcule ni température humide ni température des organes.
- Aucun seuil universel de degrés-jours ne décrit parfaitement tous les cultivars de pommier en France.
- Cette application est un outil d’aide au suivi et ne remplace pas l’observation au verger.
