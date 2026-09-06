import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('shows a local bearing intersection preview and clears it on Escape', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('INT BRAVO/270 G01/180');

  const interpretation = page.getByRole('region', { name: 'Command interpretation' });
  await expect(interpretation).toContainText('TYPE: INTERSECTION');
  await expect(interpretation).toContainText('BRAVO ↔ G01');
  await expect(interpretation).toContainText('QUALITY: GOOD');

  const intersection = page.getByRole('option', {
    name: /INT BRAVO\/270 G01\/180.*QUALITY: GOOD/i,
  });
  await expect(intersection).toBeVisible();
  await intersection.click();

  const preview = page.getByRole('region', { name: 'Bearing intersection preview' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('BRAVO');
  await expect(preview).toContainText('G01');
  await expect(preview).toContainText('QUALITY GOOD');
  await expect(preview).toContainText('89.97°');

  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
});
