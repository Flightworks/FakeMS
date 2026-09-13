import { expect, test } from '@playwright/test';

// Playwright cannot open the operating-system keyboard. A reduced viewport models
// the VisualViewport resize emitted when that keyboard appears.
test.use({
  hasTouch: true,
  viewport: { width: 1024, height: 768 },
});

test('keeps the command palette above a reduced touch viewport', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.keyboard.press('Control+k');

  const dialog = page.getByRole('dialog', { name: 'Tactical command palette' });
  const input = page.getByRole('textbox', { name: 'Command input' });
  const closeButton = page.getByRole('button', { name: 'Close command palette' });
  const firstResult = page.getByRole('option').first();
  const ownship = page.locator('.custom-entity-icon').first();

  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await expect(ownship).toBeVisible({ timeout: 15_000 });

  const ownshipBefore = await ownship.boundingBox();
  expect(ownshipBefore).not.toBeNull();

  await page.setViewportSize({ width: 1024, height: 360 });
  await expect.poll(async () => page.evaluate(() => ({
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  }))).toEqual({ width: 1024, height: 360 });

  await expect(firstResult).toBeVisible();
  await expect(input).toBeVisible();
  await expect(closeButton).toBeVisible();
  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    return box !== null && box.y >= 0 && box.y + box.height <= 360;
  }).toBe(true);

  const dialogBox = await dialog.boundingBox();
  const inputBox = await input.boundingBox();
  const closeButtonBox = await closeButton.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(closeButtonBox).not.toBeNull();

  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(360);
  expect(inputBox!.y).toBeGreaterThanOrEqual(0);
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(360);
  expect(closeButtonBox!.y).toBeGreaterThanOrEqual(0);
  expect(closeButtonBox!.y + closeButtonBox!.height).toBeLessThanOrEqual(360);

  const ownshipAtReducedViewport = await ownship.boundingBox();
  expect(ownshipAtReducedViewport).not.toBeNull();

  await input.fill('a');
  await expect(page.getByRole('option').first()).toBeVisible();

  const resultsBox = await page.getByRole('listbox', { name: 'Command results' }).boundingBox();
  expect(resultsBox).not.toBeNull();
  await page.mouse.move(resultsBox!.x + resultsBox!.width / 2, resultsBox!.y + resultsBox!.height / 2);
  await page.mouse.wheel(0, 700);
  await expect.poll(async () => page.getByRole('listbox', { name: 'Command results' }).evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const ownshipAfter = await ownship.boundingBox();
  expect(ownshipAfter).not.toBeNull();
  expect(Math.abs(ownshipAfter!.x - ownshipAtReducedViewport!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(ownshipAfter!.y - ownshipAtReducedViewport!.y)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(dialog).toBeVisible();
  await closeButton.click();
  await expect(dialog).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test('completes tactical projection parts without executing the command', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const palette = page.getByRole('dialog', { name: 'Tactical command palette' });
  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(palette).toBeVisible();

  await input.fill('BRA');
  const completions = page.getByRole('listbox', { name: 'Tactical completions' });
  await expect(completions.getByRole('option', { name: /BRAVO · REFERENCE/ })).toBeVisible();

  await input.press('Tab');
  await expect(input).toHaveValue('BRAVO ');
  await expect(palette).toBeVisible();

  await input.fill('BRAVO 180/5');
  await completions.getByRole('option', { name: /NM · UNITÉ DE PORTÉE · NM/ }).tap();
  await expect(input).toHaveValue('BRAVO 180/5NM');
  await expect(palette).toBeVisible();
});

test('uses the same semantic command action for click and Enter', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  const proposal = page.getByRole('dialog', { name: 'Direct-to route proposal status' });

  await input.fill('DCT G01');
  await page.getByRole('option', { name: /DCT G01.*Direct To/i }).first().click();
  await expect(proposal).toContainText('AWAITING AUTHORIZATION');
  await expect(proposal).toContainText('G01');
  await proposal.getByRole('button', { name: 'Reject route proposal' }).click();
  await expect(proposal).toContainText('REJECTED');

  await page.keyboard.press('Control+k');
  await input.fill('DCT G01');
  await input.press('Enter');
  await expect(proposal).toContainText('AWAITING AUTHORIZATION');
  await expect(proposal).toContainText('G01');
});

test('keeps the selected command id when the result list rebuilds', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  const results = page.getByRole('listbox', { name: 'Command results' });
  await input.fill('DCT');
  await expect(results.getByRole('option').nth(1)).toBeVisible();

  const selectedOption = results.locator('[role="option"][aria-selected="true"]');
  const firstSelectedLabel = await selectedOption.getAttribute('aria-label');
  await expect.poll(() => selectedOption.getAttribute('aria-label')).toBe(firstSelectedLabel);
  await input.press('ArrowDown');
  await expect.poll(() => selectedOption.getAttribute('aria-label')).not.toBe(firstSelectedLabel);
  const selectedBeforeRebuild = await selectedOption.getAttribute('aria-label');

  await input.fill('DCT ');
  await expect.poll(() => selectedOption.getAttribute('aria-label')).toBe(selectedBeforeRebuild);
});

test('does not execute a different command when the selected id leaves the list', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  const palette = page.getByRole('dialog', { name: 'Tactical command palette' });
  const results = page.getByRole('listbox', { name: 'Command results' });
  await input.fill('DCT');
  await expect(results.getByRole('option').first()).toBeVisible();
  await input.press('ArrowDown');
  await input.press('ArrowUp');
  await expect(results.locator('[role="option"][aria-selected="true"]')).toHaveAccessibleName(/DCT BASE · Direct To/i);

  await input.fill('FOCUS BRAVO');
  await expect(results.getByRole('option', { name: /FOCUS BRAVO/i }).first()).toBeVisible();
  await input.press('Enter');

  await expect(palette).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Direct-to route proposal status' })).toHaveCount(0);
});

test('keeps incomplete coordinate suggestions open and non-executable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  const palette = page.getByRole('dialog', { name: 'Tactical command palette' });
  await input.fill('N45');
  const suggestion = page.getByRole('option', { name: /Complete format/i }).first();
  await expect(suggestion).toBeVisible();
  await input.press('Enter');
  await expect(palette).toBeVisible();
  await expect(input).toHaveValue('N45');
});
