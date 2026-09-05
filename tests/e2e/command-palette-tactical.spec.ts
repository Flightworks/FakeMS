import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('shows and clears a temporary projection preview', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('BRAVO 180/5');

  const projection = page.getByRole('option', { name: /PROJ: BRAVO.*180.*5NM/ }).first();
  await expect(projection).toBeVisible();
  await projection.click();

  const preview = page.getByRole('region', { name: 'Projection preview' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('BRAVO');
  await expect(preview).toContainText('180.0°T / 5.0 NM');
  await expect(preview).toContainText('TARGET 33.99682, -118.15000');
  await expect(page.getByTestId('projection-preview-point')).toBeVisible();
  await expect(page.getByTestId('projection-preview-line')).toBeVisible();

  await page.getByRole('button', { name: 'Close command palette' }).click();
  await expect(preview).toHaveCount(0);
});
