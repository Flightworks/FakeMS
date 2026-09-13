import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdateAvailableBanner } from '../../components/UpdateAvailableBanner';

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
    expect(serviceWorker).toContain('maps/ne_10m_land_toulon.geojson');
    expect(serviceWorker).toContain('maps/ne_10m_airports_major.geojson');
    expect(serviceWorker).not.toContain('tile.openstreetmap.org');
    expect(serviceWorker).not.toContain('TILE_MAX_ENTRIES');
    expect(serviceWorker).not.toContain('TILE_MAX_AGE_MS');
    expect(serviceWorker).toContain('PRECACHE_URLS');
    expect(serviceWorker).toContain('if (!PRECACHE_URLS.has(event.request.url)) return;');
    expect(serviceWorker).toContain("type === 'SKIP_WAITING'");
    expect(serviceWorker).toContain('Offline shell unavailable');
  });

  it('precaches every declared Toulon coastal pack asset', () => {
    const serviceWorker = read('public/sw.js');

    expect(serviceWorker).toContain('maps/toulon/manifest.json');
    expect(serviceWorker).toContain('maps/toulon/coast-west.geojson');
    expect(serviceWorker).toContain('maps/toulon/coast-east.geojson');
  });

  it('stages and validates replacements before removing the previous shell', () => {
    const serviceWorker = read('public/sw.js');

    expect(serviceWorker).toContain('STAGING_CACHE_NAME');
    expect(serviceWorker).toContain('Precache asset rejected');
    expect(serviceWorker).toContain('Precache staging is incomplete');
    expect(serviceWorker).toContain('last completed shell cache');
    expect(serviceWorker).toContain('ignoreVary: true');
    expect(serviceWorker).toContain('LEGACY_TILE_PREFIX');
    expect(serviceWorker).toContain('LEGACY_TILE_META_PREFIX');
  });

  it('keeps update failure status and the explicit reload action observable', () => {
    const banner = read('components/UpdateAvailableBanner.tsx');

    expect(banner).toContain('UPDATE FAILED');
    expect(banner).toContain('reload was not performed');
    expect(banner).toContain('Apply update and reload');
    expect(banner).toContain("type: 'SKIP_WAITING'");
  });

  it('does not claim success when the waiting worker rejects activation', () => {
    const postMessage = vi.fn(() => {
      throw new Error('worker interrupted');
    });
    const reload = vi.fn();
    const registration = {
      waiting: { postMessage },
    } as unknown as ServiceWorkerRegistration;

    render(createElement(UpdateAvailableBanner, { registration, onReload: reload }));

    fireEvent.click(screen.getByRole('button', { name: 'Apply update and reload' }));

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('UPDATE FAILED · previous version retained; reload was not performed');
    expect(screen.getByRole('button', { name: 'Apply update and reload' })).toBeEnabled();
  });
});
