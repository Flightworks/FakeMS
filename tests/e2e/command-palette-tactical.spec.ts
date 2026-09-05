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
  const previewPaths = page.locator('.projection-preview-pane path');
  await expect(previewPaths).toHaveCount(2);
  const pathData = await previewPaths.evaluateAll(elements => elements.map(element => element.getAttribute('d') || ''));
  expect(pathData.filter(path => path.includes('L')).length).toBe(1);
  expect(pathData.filter(path => path.includes('a8')).length).toBe(1);
  await expect(page.locator('.projection-preview-pane')).toHaveCSS('pointer-events', 'auto');
  await expect(page.locator('.projection-preview-pane .leaflet-interactive')).toHaveCount(0);

  const previewPath = previewPaths.first();
  await previewPath.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'mouse', clientX: 400, clientY: 400 });
  await page.waitForTimeout(1_100);
  await expect(page.getByRole('dialog', { name: 'MAP ACTION radial menu' })).toHaveCount(0);
  await previewPath.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'mouse', clientX: 400, clientY: 400 });

  await page.getByRole('button', { name: 'Cancel projection preview' }).click();
  await expect(preview).toHaveCount(0);

  await input.fill('BRAVO 180/5');
  const secondProjection = page.getByRole('option', { name: /PROJ: BRAVO.*180.*5NM/ }).first();
  await expect(secondProjection).toBeVisible();
  await secondProjection.click();
  await expect(preview).toBeVisible();

  await page.getByRole('button', { name: 'Close command palette' }).click();
  await expect(page.getByRole('region', { name: 'Projection preview' })).toHaveCount(0);
});

test('confirms a simulated designation without creating a route or track', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await expect(input).toBeVisible();
  await input.fill('BRAVO 180/5');
  await page.getByRole('option', { name: /PROJ: BRAVO.*180.*5NM/ }).first().click();

  const preview = page.getByRole('region', { name: 'Projection preview' });
  await expect(preview).toBeVisible();
  await page.getByRole('button', { name: 'Confirm designation' }).click();

  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Confirmed simulated designations' })).toContainText('P1');
  const designationPaths = page.locator('.simulated-designation-pane path');
  await expect(designationPaths).toHaveCount(1);
  await expect(page.locator('.simulated-designation-pane .leaflet-interactive')).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await expect(input).toBeVisible();
  await input.fill('BRAVO 180/5');
  await page.getByRole('option', { name: /PROJ: BRAVO.*180.*5NM/ }).first().click();
  await page.getByRole('button', { name: 'Confirm designation' }).click();

  await expect(page.getByRole('status', { name: 'Confirmed simulated designations' })).toContainText('P1');
  await expect(page.getByRole('status', { name: 'Confirmed simulated designations' })).toContainText('P2');
  await expect(designationPaths).toHaveCount(2);
});
