import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('applies explicit declutter presets without removing scenario objects', async ({ page }) => {
  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  const markerCount = await page.locator('.custom-entity-icon').count();
  expect(markerCount).toBeGreaterThan(0);

  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });

  await input.fill('DECLUTTER FULL');
  const full = page.getByRole('option', { name: /DECLUTTER FULL/i }).filter({ hasText: 'DISPLAY ONLY' });
  await expect(full).toContainText('HIDDEN: NONE');
  await full.click();

  await page.keyboard.press('Control+k');
  await input.fill('DECLUTTER MINIMAL');
  const minimal = page.getByRole('option', { name: /DECLUTTER MINIMAL/i }).filter({ hasText: 'DISPLAY ONLY' });
  await expect(minimal).toContainText('TRACK_LABELS');
  await minimal.click();
  await expect(page.locator('.custom-entity-icon')).toHaveCount(markerCount);

  await page.keyboard.press('Control+k');
  await input.fill('DECLUTTER NORMAL');
  const normal = page.getByRole('option', { name: /DECLUTTER NORMAL/i }).filter({ hasText: 'DISPLAY ONLY' });
  await expect(normal).toContainText('ACTIVE: MINIMAL');
  await normal.click();

  await page.keyboard.press('Control+k');
  await input.fill('DECLUTTER LOW');
  await expect(page.getByRole('option', { name: /DECLUTTER UNAVAILABLE/i })).toContainText('LOW/HIGH REJECTED');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
