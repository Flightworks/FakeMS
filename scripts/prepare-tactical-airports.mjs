import fs from 'node:fs';
import path from 'node:path';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/prepare-tactical-airports.mjs <input.geojson> <output.geojson>');
  process.exit(2);
}

const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (source.type !== 'FeatureCollection' || !Array.isArray(source.features)) {
  throw new Error('Airport source must be a GeoJSON FeatureCollection');
}

const isFiniteCoordinate = value => typeof value === 'number' && Number.isFinite(value);
const majorFeatures = source.features.flatMap(feature => {
  const coordinates = feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
  const properties = feature?.properties ?? {};
  const scalerank = Number(properties.scalerank);
  const iataCode = typeof properties.iata_code === 'string' ? properties.iata_code.trim() : '';
  const gpsCode = typeof properties.gps_code === 'string' ? properties.gps_code.trim() : '';

  if (!coordinates || !isFiniteCoordinate(coordinates[0]) || !isFiniteCoordinate(coordinates[1])) return [];
  const isRegionalContextAirport = iataCode === 'MRS';
  if (!Number.isFinite(scalerank) || (scalerank > 2 && !isRegionalContextAirport) || (!iataCode && !gpsCode)) return [];

  return [{
    type: 'Feature',
    properties: {
      name: typeof properties.name === 'string' ? properties.name : null,
      iata_code: iataCode || null,
      gps_code: gpsCode || null,
      scalerank,
    },
    geometry: {
      type: 'Point',
      coordinates: [coordinates[0], coordinates[1]],
    },
  }];
});

if (majorFeatures.length === 0) throw new Error('Airport filter produced no features');

const longitudes = majorFeatures.map(feature => feature.geometry.coordinates[0]);
const latitudes = majorFeatures.map(feature => feature.geometry.coordinates[1]);
const output = {
  type: 'FeatureCollection',
  name: 'ne_10m_airports_major',
  features: majorFeatures,
  bbox: [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ],
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({ input: inputPath, output: outputPath, features: majorFeatures.length }));
