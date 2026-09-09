import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('PWA static assets', () => {
  it('does not disable browser zoom and uses local icons', () => {
    const index = read('index.html');
    const manifest = JSON.parse(read('public/manifest.json')) as {
      icons: Array<{ src: string }>;
    };

    expect(index).not.toContain('user-scalable=no');
    expect(index).not.toContain('maximum-scale');
    expect(index).toContain('./icons/fakems.svg');
    expect(index).not.toContain('placehold.co');
    expect(manifest.icons.every(icon => icon.src.startsWith('./icons/'))).toBe(true);
  });

  it('defines a build-versioned cache with local tactical map assets', () => {
    const serviceWorker = read('public/sw.js');

    expect(serviceWorker).toContain('__FAKEMS_BUILD_ID__');
    expect(serviceWorker).toContain('maps/ne_110m_land.geojson');
    expect(serviceWorker).toContain('maps/ne_10m_airports_major.geojson');
    expect(serviceWorker).not.toContain('tile.openstreetmap.org');
    expect(serviceWorker).not.toContain('TILE_MAX_ENTRIES');
    expect(serviceWorker).not.toContain('TILE_MAX_AGE_MS');
    expect(serviceWorker).toContain('PRECACHE_URLS');
    expect(serviceWorker).toContain('if (!PRECACHE_URLS.has(event.request.url)) return;');
    expect(serviceWorker).toContain("type === 'SKIP_WAITING'");
    expect(serviceWorker).toContain('Offline shell unavailable');
  });
});
