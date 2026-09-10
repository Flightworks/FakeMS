import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Covers the Ligurian and Tyrrhenian coasts well beyond the normal Toulon mission view.
export const TOULON_COASTAL_BOUNDS = [0, 38, 14, 47];

const isFiniteCoordinate = value => typeof value === 'number' && Number.isFinite(value);
const sameCoordinate = (first, second) => first[0] === second[0] && first[1] === second[1];

const clipRingAtBoundary = (ring, boundary) => {
  if (ring.length === 0) return [];
  const clipped = [];
  let previous = ring.at(-1);
  let previousInside = boundary.inside(previous);

  for (const current of ring) {
    const currentInside = boundary.inside(current);
    if (currentInside !== previousInside) clipped.push(boundary.intersection(previous, current));
    if (currentInside) clipped.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return clipped;
};

const clipRing = (ring, bounds) => {
  if (!Array.isArray(ring) || ring.some(position => !Array.isArray(position) || !isFiniteCoordinate(position[0]) || !isFiniteCoordinate(position[1]))) {
    return null;
  }
  let clipped = ring.map(([longitude, latitude]) => [longitude, latitude]);
  if (clipped.length > 1 && sameCoordinate(clipped[0], clipped.at(-1))) clipped = clipped.slice(0, -1);

  const [west, south, east, north] = bounds;
  const boundaries = [
    {
      inside: ([longitude]) => longitude >= west,
      intersection: ([x1, y1], [x2, y2]) => [west, y1 + ((y2 - y1) * (west - x1)) / (x2 - x1)],
    },
    {
      inside: ([longitude]) => longitude <= east,
      intersection: ([x1, y1], [x2, y2]) => [east, y1 + ((y2 - y1) * (east - x1)) / (x2 - x1)],
    },
    {
      inside: ([, latitude]) => latitude >= south,
      intersection: ([x1, y1], [x2, y2]) => [x1 + ((x2 - x1) * (south - y1)) / (y2 - y1), south],
    },
    {
      inside: ([, latitude]) => latitude <= north,
      intersection: ([x1, y1], [x2, y2]) => [x1 + ((x2 - x1) * (north - y1)) / (y2 - y1), north],
    },
  ];

  for (const boundary of boundaries) clipped = clipRingAtBoundary(clipped, boundary);
  return clipped.length >= 3 ? [...clipped, clipped[0]] : null;
};

const clipPolygon = (coordinates, bounds) => {
  const rings = coordinates.map(ring => clipRing(ring, bounds)).filter(Boolean);
  return rings.length > 0 ? rings : null;
};

const clipGeometry = (geometry, bounds) => {
  if (geometry?.type === 'Polygon') {
    const coordinates = clipPolygon(geometry.coordinates, bounds);
    return coordinates ? { type: 'Polygon', coordinates } : null;
  }
  if (geometry?.type === 'MultiPolygon') {
    const coordinates = geometry.coordinates.map(polygon => clipPolygon(polygon, bounds)).filter(Boolean);
    return coordinates.length > 0 ? { type: 'MultiPolygon', coordinates } : null;
  }
  return null;
};

export const clipFeatureCollectionToBounds = (source, bounds) => {
  if (source?.type !== 'FeatureCollection' || !Array.isArray(source.features)) {
    throw new Error('Land source must be a GeoJSON FeatureCollection');
  }

  const features = source.features.flatMap(feature => {
    const geometry = clipGeometry(feature?.geometry, bounds);
    return geometry ? [{ type: 'Feature', properties: feature.properties ?? {}, geometry }] : [];
  });

  return { type: 'FeatureCollection', name: 'ne_10m_land_toulon', bbox: [...bounds], features };
};

const main = () => {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/prepare-toulon-coastal-detail.mjs <ne_10m_land.geojson> <output.geojson>');
    process.exit(2);
  }

  const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const output = clipFeatureCollectionToBounds(source, TOULON_COASTAL_BOUNDS);
  if (output.features.length === 0) throw new Error('Toulon coastal extraction produced no land features');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`);
  console.log(JSON.stringify({ input: inputPath, output: outputPath, bounds: output.bbox, features: output.features.length }));
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

export const scriptPath = fileURLToPath(import.meta.url);
