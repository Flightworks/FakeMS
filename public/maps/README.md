# Données du fond tactique maritime

Ces fichiers sont des ressources statiques locales utilisées par FakeMS. Ils ne sont pas téléchargés au fonctionnement et ne constituent pas une carte de navigation certifiée.

## Source

- Jeu de données : Natural Earth Vector
- Révision : `789c9904087846cc3361302857aa2e76b0ae71ff`
- Licence : domaine public selon les conditions Natural Earth
- Mention recommandée : `Made with Natural Earth`
- Récupération : `2026-09-09T05:26:16Z`
- Conditions : https://www.naturalearthdata.com/about/terms-of-use/

## Terre et trait de côte

Le fond global reste volontairement léger. Une couche locale détaillée remplace son rendu autour de Toulon afin de garder un trait de côte lisible sans charger la géométrie 1:10m du monde entier.

### Fond global

Fichier local : `ne_110m_land.geojson`

Source :

```text
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/789c9904087846cc3361302857aa2e76b0ae71ff/geojson/ne_110m_land.geojson
```

- Type : `FeatureCollection`
- Échelle : `1:110m`
- Features : `127`
- Taille : `138160` octets
- SHA-256 : `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`

### Détail côtier Toulon

Fichier local : `ne_10m_land_toulon.geojson`

Source : le même `ne_10m_land.geojson` Natural Earth, découpé par `scripts/prepare-toulon-coastal-detail.mjs`.

- Échelle source : `1:10m` ;
- zone de découpe : longitude `0` à `14`, latitude `38` à `47` ;
- Features : `8` ;
- Sommets : `3334` ;
- Taille : `71576` octets ;
- SHA-256 : `93aadf2f5e9fb9fd71d384e455e2485d62082e6a3b52a7ced75bb9ae9ffec87b`.

Le rendu masque d’abord la forme 1:110m dans cette zone, puis applique les polygones 1:10m. Les limites de découpe restent au-delà de la vue nominale autour de Toulon.

## Aéroports majeurs

Source complète :

```text
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/789c9904087846cc3361302857aa2e76b0ae71ff/geojson/ne_10m_airports.geojson
```

Le fichier intégré est un sous-ensemble produit par `scripts/prepare-tactical-airports.mjs` :

- `scalerank <= 2`, plus Marseille-Provence (`MRS`) comme repère régional visible depuis Toulon ;
- code IATA ou code GPS requis ;
- coordonnées finies ;
- propriétés conservées : `name`, `iata_code`, `gps_code`, `scalerank` ;
- aucun libellé, URL ou métadonnée multilingue rendu par la carte.

Fichier local : `ne_10m_airports_major.geojson`

- Type : `FeatureCollection`
- Features : `66`
- Taille : `11774` octets
- SHA-256 : `bd673722b55fa147d7952cc34b97a2639976b5ee43f20a43d076db9b1470525f`

Les aéroports statiques sont des repères cartographiques non interactifs. Ils ne sont pas ajoutés aux entités FakeMS, aux pistes ou aux résultats de commande. L’aéroport de scénario `BASE` reste géré séparément par FakeMS.
