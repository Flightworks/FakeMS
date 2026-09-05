import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('shows actionable tactical projection errors while typing', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  const alert = page.getByRole('alert');
  await expect(input).toBeVisible();

  await input.fill('BRAVO 180/');
  await expect(alert).toContainText('PORTÉE MANQUANTE — exemple : BRAVO 180/5NM');

  await input.fill('BRAVO 370/5');
  await expect(alert).toContainText('CAP HORS LIMITES — attendu : 000 à 359.999°');

  await input.fill('BRAVO 180/5XX');
  await expect(alert).toContainText('UNITÉ INCONNUE — NM, KM ou M');
});
