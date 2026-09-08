import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('renders sampled simulated trails and clears only after confirmation', async ({ page }) => {
  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  await page.waitForTimeout(2_500);

  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('TRAIL HOSTILE 1 ON');
  const enable = page.getByRole('option', { name: /TRAIL HOSTILE 1 ON/i }).filter({ hasText: 'HISTORICAL ONLY' });
  await expect(enable).toBeVisible();
  await enable.click();
  await expect(page.locator('.track-trail-layer path')).toHaveCount(1);

  await page.getByRole('button').filter({ hasText: /^NAV/ }).first().click();
  const simulationToolbox = page.getByRole('region', { name: 'Simulation toolbox' });
  await simulationToolbox.getByRole('button', { name: 'SIM', exact: true }).click();
  await page.waitForTimeout(2_500);
  await page.keyboard.press('Control+k');
  await input.fill('TRAIL OWNSHIP ON');
  await page.getByRole('option', { name: /TRAIL VIPER 1-1 ON/i }).filter({ hasText: 'HISTORICAL ONLY' }).click();
  await expect(page.locator('.track-trail-layer path')).toHaveCount(2);

  await page.keyboard.press('Control+k');
  await input.fill('TRAIL STATUS');
  await expect(page.getByRole('option', { name: /TRAIL STATUS/i }).filter({ hasText: 'LOCAL MEMORY ONLY' })).toContainText('HOSTILE 1: VISIBLE');

  await page.keyboard.press('Control+k');
  await input.fill('TRAIL CLEAR HOSTILE 1');
  const cancelClear = page.getByRole('option', { name: /TRAIL CLEAR HOSTILE 1/i }).filter({ hasText: 'CONFIRMATION REQUIRED' });
  await cancelClear.click();
  const cancelled = page.getByRole('dialog', { name: 'Mission action status' });
  await cancelled.getByRole('button', { name: 'Reject mission action' }).click();
  await expect(cancelled).toContainText('REJECTED');
  await expect(page.locator('.track-trail-layer path')).toHaveCount(2);

  await page.keyboard.press('Control+k');
  await input.fill('TRAIL CLEAR HOSTILE 1');
  const clear = page.getByRole('option', { name: /TRAIL CLEAR HOSTILE 1/i }).filter({ hasText: 'CONFIRMATION REQUIRED' });
  await clear.click();
  const action = page.getByRole('dialog', { name: 'Mission action status' });
  await action.getByRole('button', { name: 'Preview mission action' }).click();
  await action.getByRole('button', { name: 'Authorize mission action' }).click();
  await action.getByRole('button', { name: 'Execute simulated action' }).click();
  await expect(action).toContainText('COMPLETED · SIMULATION');
  await expect(page.locator('.track-trail-layer path')).toHaveCount(1);
});

test('resets local trail history with the simulated scenario', async ({ page }) => {
  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  await page.waitForTimeout(2_500);

  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('TRAIL HOSTILE 1 ON');
  await page.getByRole('option', { name: /TRAIL HOSTILE 1 ON/i }).filter({ hasText: 'HISTORICAL ONLY' }).click();
  await expect(page.locator('.track-trail-layer path')).toHaveCount(1);

  await page.keyboard.press('Control+k');
  await input.fill('SIM RESET');
  await page.getByRole('option', { name: /SIM RESET/i }).filter({ hasText: 'CONFIRMATION REQUIRED' }).click();
  const reset = page.getByRole('dialog', { name: 'Confirm simulation reset' });
  await reset.getByRole('button', { name: 'Confirm simulation reset' }).click();
  await expect(page.locator('.track-trail-layer path')).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await input.fill('SIM REPLAY');
  await page.getByRole('option', { name: /SIM REPLAY/i }).filter({ hasText: 'CONFIRMATION REQUIRED' }).click();
  const replay = page.getByRole('dialog', { name: 'Confirm simulation replay' });
  await replay.getByRole('button', { name: 'Confirm simulation replay' }).click();
  await page.waitForTimeout(4_000);
  await page.keyboard.press('Control+k');
  await input.fill('TRAIL STATUS');
  await expect(page.getByRole('option', { name: /TRAIL STATUS/i }).filter({ hasText: 'LOCAL MEMORY ONLY' })).toContainText(/HOSTILE 1: HIDDEN · (?!TRAIL INSUFFICIENT)/);
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Control+k');
  await input.fill('TRAIL HOSTILE 1 ON');
  await page.getByRole('option', { name: /TRAIL HOSTILE 1 ON/i }).filter({ hasText: 'HISTORICAL ONLY' }).click();
  await expect(page.locator('.track-trail-layer path')).toHaveCount(1);
});
