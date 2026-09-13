# Pipeline de données côtières

## Objectif

FakeMS a besoin d’un trait de côte local pour le prototype visuel maritime,
sans tuiles ni requête réseau au runtime. Le pipeline T24/T25 prépare un pack
versionné de géométries OSM hors ligne. Il ne change ni les entités de mission
ni la surface terrestre globale utilisée par le fond de carte.

Le pack est une couche de contexte : il ne doit pas être interprété comme une
source de navigation ou comme une donnée hydrographique opérationnelle.

## Décision de source

La page produit SHOM LimTM est publique, mais l’endpoint WFS/WMS associé répond
HTTP 401 lorsqu’une ressource ou un jeton n’est pas fourni. Le téléchargement du
produit dépend en outre d’une commande configurable. Le pipeline ne devine pas
de credentials, ne contourne pas le contrôle d’accès et ne lance pas de
commande d’achat.

Pour le prototype, une réponse Overpass régionale déjà récupérée est donc
utilisée comme alternative :

```text
https://overpass-api.de/api/interpreter
[out:json][timeout:60];way["natural"="coastline"](42.8,4.8,43.5,6.5);out geom;
```

La zone exacte est `[4.8, 42.8, 6.5, 43.5]` (`west, south, east, north`). La
licence ODbL impose l’attribution `© OpenStreetMap contributors`, conservée
dans le manifest. La date de récupération du pack est celle de la métadonnée
du fichier source, ou une valeur passée explicitement avec `--generated-at`.

## Préparation reproductible

Le script n’a aucune dépendance Python tierce et ne fait aucun appel réseau :

```bash
python3 scripts/prepare-mission-coast.py \
  /tmp/toulon-coast-osm.json public/maps/toulon
```

Pour rendre une exécution indépendante de la date du fichier source :

```bash
python3 scripts/prepare-mission-coast.py \
  /tmp/toulon-coast-osm.json public/maps/toulon \
  --generated-at 2026-09-12T19:09:16Z
```

Le script :

1. lit le JSON Overpass et ne retient que les ways dont
   `tags.natural == "coastline"` ;
2. valide les coordonnées `lon`/`lat` et découpe les segments aux limites de
   la bbox, sans relier deux portions séparées par une zone hors bbox ;
3. produit deux secteurs stables, `coast-west.geojson` et
   `coast-east.geojson`, chacun en `FeatureCollection` WGS84 ;
4. écrit uniquement des features `LineString` avec `properties: {}`. Les IDs,
   noms et autres tags OSM ne sont pas copiés ;
5. calcule pour chaque asset le nombre de features, sommets, octets et le
   SHA-256, puis écrit `manifest.json`.

Les ways ouverts ne sont jamais refermés. Les ways qui étaient déjà fermés
restent des `LineString` fermés : ils ne sont pas transformés en polygones.
Aucune tentative de fusion ou de reconstruction topologique n’est effectuée.

## Contrat du manifest

`public/maps/toulon/manifest.json` contient notamment :

- `schema: "fakems.coastal-pack"`, `schema_version`, `pack_version` et la
  version de l’outil ;
- `generated_at`, `crs: "WGS84"` et la bbox exacte ;
- `source.url`, `source.query`, `source.retrieved_at`, licence, attribution,
  empreinte et taille du JSON Overpass ;
- `assets[]`, avec le chemin relatif, secteur, LOD, bbox, comptes et SHA-256 ;
- `counts`, agrégat des comptes des assets ;
- la raison pour laquelle la surface de terre n’est pas dérivée de ces lignes.

Les lignes source peuvent traverser la limite de la requête Overpass. Le
préparateur les découpe donc à la bbox avant de les écrire ; le validateur
refuse toute coordonnée qui sortirait de cette zone.

## Validation

Le validateur est également hors ligne et standard-library only :

```bash
python3 scripts/validate-mission-coast.py public/maps/toulon/manifest.json
```

Il refuse un manifest ou un asset malformé, une collection non
`FeatureCollection`, une collection vide, une CRS autre que WGS84, une
`LineString` absente ou invalide, des coordonnées non finies ou hors bbox, des
propriétés civiles, des chemins d’assets hors du pack, ainsi que tout
SHA-256/compte divergent. Il vérifie les octets réellement présents sur disque
plutôt que de faire confiance aux valeurs annoncées.

Le test ciblé se lance sans installation de paquet Python :

```bash
python3 -m unittest discover -s tests/maps -p 'test_*.py'
```

## Surface terrestre et limites

Une ligne de côte ne garantit ni fermeture, ni ordre topologique, ni
correspondance fiable entre îles et terre. Le pipeline n’invente donc pas de
polygones de remplissage : `ne_110m_land.geojson` de Natural Earth reste le
fallback de surface terrestre globale.

La donnée OSM est utile pour la lisibilité du prototype, mais elle n’est pas
survey-grade, sa couverture est hétérogène et dépend des mises à jour
communautaires. Le pack n’est pas une carte de navigation certifiée : il ne
fournit ni bathymétrie, ni dangers, ni profondeurs, ni chenaux, ni aides à la
navigation. Toute source SHOM future devra passer par une acquisition
configurée et autorisée, séparée de ce pipeline local.
