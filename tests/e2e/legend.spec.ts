import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('consults the same local legend registry as rendered symbols', async ({ page }) => {
  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  await expect(page.locator('[data-legend-symbol="SYMBOL_HOSTILE"]')).toHaveCount(2);

  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });

  await input.fill('LEGEND');
  const list = page.getByRole('option', { name: /^LEGEND ·/i }).filter({ hasText: 'LOCAL REGISTRY' });
  await expect(list).toContainText('HOSTILE: Simulated hostile track symbol');

  await input.fill('LEGEND SYMBOL HOSTILE');
  const hostile = page.getByRole('option', { name: /LEGEND SYMBOL HOSTILE/i }).filter({ hasText: 'STATE: SIMULATED' });
  await expect(hostile).toContainText('LOCAL SIMULATION SYMBOLOGY');

  await input.fill('LEGEND LAYER TRACKS');
  const tracks = page.getByRole('option', { name: /LEGEND LAYER TRACKS/i }).filter({ hasText: 'STATE: LOCAL DISPLAY' });
  await expect(tracks).toContainText('VISIBILITY: ON');

  await input.fill('LEGEND SYMBOL RED');
  await expect(page.getByRole('option', { name: /LEGEND UNAVAILABLE/i })).toContainText('MEANING NOT INFERRED');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
