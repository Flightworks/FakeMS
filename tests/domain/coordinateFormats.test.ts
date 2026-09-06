import { describe, expect, it } from 'vitest';
import {
  formatCoordinate,
  parseCoordinate,
  type CoordinateFormat,
} from '../../domain/coordinateFormats';

describe('coordinate formats', () => {
  const position = { lat: 34.08, lon: -118.15 };

  it('formats one position as signed decimal, DDM, and DMS coordinates', () => {
    expect(formatCoordinate(position, 'DD')).toBe('34.08000, -118.15000');
    expect(formatCoordinate(position, 'DDM')).toBe("N34°04.80' W118°09.00'");
    expect(formatCoordinate(position, 'DMS')).toBe('N34°04\'48.0" W118°09\'00.0"');
  });

  it('parses decimal and hemispheric DDM/DMS coordinates without changing their signs', () => {
    expect(parseCoordinate('34.08,-118.15')).toEqual(position);
    expect(parseCoordinate("N34°04.80' W118°09.00'")).toEqual({
      lat: 34.08,
      lon: -118.15,
    });
    expect(parseCoordinate('S12°30\'00" E045°15\'00"')).toEqual({
      lat: -12.5,
      lon: 45.25,
    });
  });

  it('carries rounded minutes and seconds across degree boundaries', () => {
    expect(formatCoordinate({ lat: 12.999999, lon: -179.999999 }, 'DDM'))
      .toBe("N13°00.00' W180°00.00'");
    expect(formatCoordinate({ lat: -12.999999, lon: 179.999999 }, 'DMS'))
      .toBe('S13°00\'00.0" E180°00\'00.0"');
  });

  it('rejects impossible coordinates and contradictory sign or hemisphere input', () => {
    for (const input of ['91,0', '0,181', 'N-34.08 W118.15', 'N34.08 E-118.15', 'N34°60.00\' W118°00.00\'']) {
      expect(() => parseCoordinate(input), input).toThrow();
    }
    expect(() => formatCoordinate(position, 'MGRS' as CoordinateFormat)).toThrow();
  });
});
