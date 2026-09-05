import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('blocks ambiguous projection references until an explicit candidate is selected', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('HOSTILE 180/5');

  await expect(page.getByRole('option', { name: /AMBIGUOUS_REFERENCE/ })).toBeVisible();
  const firstCandidate = page.getByRole('option', { name: /HOSTILE 1.*ENEMY.*en-1.*NM/i });
  const secondCandidate = page.getByRole('option', { name: /HOSTILE 2.*ENEMY.*en-2.*NM/i });
  await expect(firstCandidate).toBeVisible();
  await expect(secondCandidate).toBeVisible();
  await expect(page.getByRole('region', { name: 'Projection preview' })).toHaveCount(0);

  await firstCandidate.click();
  await expect(input).toHaveValue(/PROJ en-1 180\/5NM/i);
  const projection = page.getByRole('option', { name: /PROJ: HOSTILE 1.*180.*5NM/ });
  await expect(projection).toBeVisible();
  await projection.click();

  await expect(page.getByRole('region', { name: 'Projection preview' })).toContainText('HOSTILE 1');
});

test('keeps a fuzzy projection suggestion non-executable until explicit selection', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('BRAVX 180/5');

  await expect(page.getByRole('option', { name: /FUZZY_SUGGESTION/ })).toBeVisible();
  const suggestion = page.getByRole('option', { name: /BRAVO.*WAYPOINT.*wp-2.*NM/i });
  await expect(suggestion).toBeVisible();
  await expect(page.getByRole('region', { name: 'Projection preview' })).toHaveCount(0);

  await suggestion.click();
  await expect(input).toHaveValue(/PROJ wp-2 180\/5NM/i);
  const projection = page.getByRole('option', { name: /PROJ: BRAVO.*180.*5NM/ });
  await expect(projection).toBeVisible();
  await projection.click();

  await expect(page.getByRole('region', { name: 'Projection preview' })).toContainText('BRAVO');
});
