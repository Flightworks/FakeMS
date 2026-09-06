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

test('distinguishes unavailable ground speed from an explicit ETA assumption', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();

  await input.fill('ETA BRAVO');
  await expect(page.getByRole('option', {
    name: /^ETA BRAVO.*ETE: UNAVAILABLE.*GS: UNAVAILABLE.*SRC: UNAVAILABLE/i,
  })).toBeVisible();

  await input.fill('ETA BRAVO @ 140KT');
  await expect(page.getByRole('option', {
    name: /^ETA BRAVO.*ETE:.*ETA UTC:.*ETA LOCAL.*GS: 140\.0 KT.*USER_ASSUMPTION.*SRC: USER_INPUT/i,
  })).toBeVisible();
});

test('renders ETE separately for an explicit origin and destination', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('ETE G01 BRAVO @ 120KT');

  await expect(page.getByRole('option', {
    name: /^ETE G01 → BRAVO.*ETE:.*ETA UTC:.*SRC: USER_INPUT/i,
  })).toBeVisible();
});

test('solves time, distance, and ground speed without a map preview', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();

  await input.fill('TIME 45NM @ 120KT');
  await expect(page.getByRole('option', {
    name: /^TIME: 22 min 30 s.*DIST: 45\.0 NM.*GS: 120\.0 KT/i,
  })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Projection preview' })).toHaveCount(0);

  await input.fill('DIST 15MIN @ 120KT');
  await expect(page.getByRole('option', {
    name: /^DIST: 30\.0 NM.*TIME: 15 min 0 s/i,
  })).toBeVisible();

  await input.fill('GS 40NM / 20MIN');
  await expect(page.getByRole('option', {
    name: /^GS: 120\.0 KT.*DIST: 40\.0 NM.*TIME: 20 min 0 s/i,
  })).toBeVisible();
});

test('lists nearest waypoints in range order without a map preview', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('NEAREST 2 WAYPOINTS');

  const results = page.getByRole('listbox', { name: 'Command results' }).getByRole('option');
  await expect(results.nth(0)).toHaveAccessibleName(/G01.*RNG:.*BRG:.*FRESHNESS: UNKNOWN.*QUALITY: UNKNOWN/i);
  await expect(results.nth(1)).toHaveAccessibleName(/BRAVO.*RNG:.*BRG:.*FRESHNESS: UNKNOWN.*QUALITY: UNKNOWN/i);
  await expect(page.getByRole('region', { name: 'Projection preview' })).toHaveCount(0);
});

test('converts and copies coordinates locally without claiming permission', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('COORD BRAVO DDM');
  await expect(page.getByRole('option', {
    name: /COORD BRAVO: N34°04\.80' W118°09\.00'.*LOCAL DISPLAY.*FORMAT: DDM/i,
  })).toBeVisible();

  await input.fill('COPY POS BRAVO');
  await expect(page.getByRole('option', {
    name: /COPY POS BRAVO: 34\.08000, -118\.15000.*LOCAL CLIPBOARD.*COPY IF PERMITTED/i,
  })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Projection preview' })).toHaveCount(0);
});
