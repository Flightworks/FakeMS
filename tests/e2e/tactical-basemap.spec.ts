import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('renders a dark local maritime basemap with major airports under mission symbols', async ({ page }) => {
  const externalTileRequests: string[] = [];
  const externalRequests: string[] = [];
  page.on('request', request => {
    const requestUrl = request.url();
    if (/^https?:/.test(requestUrl) && new URL(requestUrl).origin !== 'http://127.0.0.1:4173') {
      externalRequests.push(requestUrl);
    }
    if (/tile\.openstreetmap\.org|basemaps\.cartocdn\.com|mapbox\.com/.test(requestUrl)) {
      externalTileRequests.push(requestUrl);
    }
  });

  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.tactical-basemap-land path:not([d="M0 0"])').first()).toBeVisible();
  await expect(page.locator('.tactical-coastal-detail path:not([d="M0 0"])').last()).toBeVisible();
  await expect(page.locator('.tactical-airport-point:not([d="M0 0"])').first()).toBeVisible();
  const coastPack = page.locator('.tactical-coast-pack').first();
  await expect(coastPack).toHaveAttribute('data-coast-state', 'loaded', { timeout: 30_000 });
  await expect(coastPack).toHaveAttribute('data-coast-sector-ids', 'coast-west,coast-east');
  await expect(coastPack).toHaveAttribute('data-coast-feature-count', '622');
  await expect(coastPack).not.toHaveAttribute('data-coast-mask');

  await expect(page.locator('.leaflet-tile')).toHaveCount(0);
  expect(externalTileRequests).toEqual([]);
  expect(externalRequests).toEqual([]);
  await expect(page.locator('[data-entity-id="apt-1"]')).toBeVisible();
  await expect(page.locator('.tactical-airport-label')).toHaveCount(0);

  const landPath = page.locator('.tactical-basemap-land path:not([d="M0 0"])').first();
  await expect(landPath).toHaveAttribute('fill', /#20272d/i);
  await expect(landPath).toHaveAttribute('stroke', /#6b7680/i);
  await expect(page.locator('.tactical-coastal-detail')).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('.tactical-coastal-detail path:not([d="M0 0"])').last()).toHaveAttribute('stroke', /#7b8791/i);

  await expect(page.locator('.tactical-airport-layer')).toHaveCSS('pointer-events', 'none');
});
