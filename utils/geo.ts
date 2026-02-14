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