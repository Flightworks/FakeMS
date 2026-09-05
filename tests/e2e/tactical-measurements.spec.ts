import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('shows calculated tactical range and bearing without navigation side effects', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();

  await input.fill('RNG BRAVO');
  const range = page.getByRole('option', {
    name: /RNG BRAVO.*ENTITY_POSITIONS.*CALCULATED/i,
  });
  await expect(range).toBeVisible();
  await expect(page.getByRole('region', { name: 'Projection preview' })).toHaveCount(0);

  await input.fill('BRG/RNG G01 BRAVO');
  await expect(page.getByRole('option', {
    name: /BRG\/RNG G01 BRAVO.*FROM G01 TO BRAVO.*CALCULATED/i,
  })).toBeVisible();
});

test('blocks an ambiguous tactical measurement reference', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('RNG HOSTILE');

  await expect(page.getByRole('option', { name: /AMBIGUOUS_REFERENCE: HOSTILE/i })).toBeVisible();
  await expect(page.locator('[role="option"][id^="measurement-result-"]')).toHaveCount(0);
});
