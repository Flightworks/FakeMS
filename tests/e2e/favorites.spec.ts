import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('persists safe favorites and uses them only to fill the palette', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.removeItem('cmd_favorites'));
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('PIN ETA BRAVO');
  const pin = page.getByRole('option', { name: /^PIN ETA BRAVO ·/i });
  await expect(pin).toBeVisible();
  await expect(pin).toContainText('FILL ONLY');
  await pin.click();

  await input.fill('FAVORITES');
  const favorite = page.getByRole('option', { name: /#1 ETA BRAVO ·/i });
  await expect(favorite).toBeVisible();
  await expect(favorite).toContainText('FILL ONLY');
  await favorite.click();
  await expect(input).toHaveValue('ETA BRAVO');

  await page.reload();
  await page.keyboard.press('Control+k');
  await input.fill('FAVORITES');
  await expect(page.getByRole('option', { name: /#1 ETA BRAVO ·/i })).toBeVisible();

  await input.fill('UNPIN 1');
  const unpin = page.getByRole('option', { name: /UNPIN #1 ETA BRAVO/i });
  await expect(unpin).toBeVisible();
  await unpin.click();

  await input.fill('FAVORITES');
  await expect(page.getByRole('option', { name: /FAVORITES: EMPTY/i })).toBeVisible();
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
