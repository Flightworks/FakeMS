export const EARTH_RADIUS = 6378137;
export const ORIGIN_SHIFT = 2 * Math.PI * EARTH_RADIUS / 2.0;

export const latLonToMeters = (lat: number, lon: number) => {
  const mx = lon * ORIGIN_SHIFT / 180.0;
  let my = Math.log(Math.tan((90 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0);
  my = my * ORIGIN_SHIFT / 180.0;
  return { x: mx, y: my };
};

export const metersToLatLon = (mx: number, my: number) => {
  const lon = (mx / ORIGIN_SHIFT) * 180.0;
  let lat = (my / ORIGIN_SHIFT) * 180.0;
  lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0);
  return { lat, lon };
};

export const projectPoint = (start: { x: number, y: number }, bearing: number, distance: number) => {
  const rad = (90 - bearing) * (Math.PI / 180);
  return {
    x: start.x + Math.cos(rad) * distance,
    y: start.y + Math.sin(rad) * distance
  };
};

// --- Geodesic Math (WGS84 Spherical Approximations) ---

const toRad = (deg: number) => deg * Math.PI / 180;
const toDeg = (rad: number) => rad * 180 / Math.PI;

/**
 * Calculates the destination point given a start point, a distance, and a bearing.
 * Distance in meters, bearing in degrees. Returns lat/lon in degrees.
 */
export const getDestinationPoint = (lat: number, lon: number, distance: number, bearing: number) => {
  const R = EARTH_RADIUS;
  const dLat = distance * Math.cos(toRad(bearing)) / R;
  const dLon = distance * Math.sin(toRad(bearing)) / (R * Math.cos(toRad(lat)));

  return {
    lat: lat + toDeg(dLat),
    lon: lon + toDeg(dLon)
  };
};

/**
 * Calculates distance between two points in meters using straight spherical math.
 */
export const distanceBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = EARTH_RADIUS; // meters
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Calculates the initial bearing from point 1 to point 2 in degrees.
 */
export const bearingBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);
  const deltaLon = toRad(lon2 - lon1);

  const y = Math.sin(deltaLon) * Math.cos(radLat2);
  const x = Math.cos(radLat1) * Math.sin(radLat2) -
    Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(deltaLon);
  const brng = Math.atan2(y, x);

  return (toDeg(brng) + 360) % 360;
};
