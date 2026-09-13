import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('routes PW NAV reset and replay through the shared confirmation flow', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('button', { name: /^NAV/ });
  await nav.click();
  const toolbox = page.getByRole('region', { name: 'Simulation toolbox' });
  await expect(toolbox).toBeVisible();

  await toolbox.getByRole('button', { name: 'Pause simulation' }).click();
  await expect(toolbox).toContainText('PAUSED');

  await toolbox.getByRole('button', { name: 'Reset simulation' }).click();
  const resetDialog = page.getByRole('dialog', { name: /Confirm simulation reset/i });
  await expect(resetDialog).toBeVisible();
  await resetDialog.getByRole('button', { name: 'Cancel simulation change' }).click();
  await expect(resetDialog).toHaveCount(0);
  await expect(toolbox).toContainText('PAUSED');

  await toolbox.getByRole('button', { name: 'Reset simulation' }).click();
  await page.getByRole('button', { name: 'Confirm simulation reset' }).click();
  await expect(toolbox).toContainText('RESET · PAUSED');

  await toolbox.getByRole('button', { name: 'Replay simulation' }).click();
  const replayDialog = page.getByRole('dialog', { name: /Confirm simulation replay/i });
  await expect(replayDialog).toBeVisible();
  await page.getByRole('button', { name: 'Confirm simulation replay' }).click();
  await expect(toolbox).toContainText('REPLAY · RUNNING');
});

test('controls the local simulation with confirmation for reset and replay', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });

  await input.fill('SIM STATUS');
  await expect(page.getByRole('option', { name: /LOCAL SIMULATION · NO SIDE EFFECT/i })).toContainText('RUNNING');

  await input.fill('SIM PAUSE');
  await page.getByRole('option', { name: /LOCAL SIMULATION · IDEMPOTENT/i }).filter({ hasText: 'SIM PAUSE' }).click();
  await page.keyboard.press('Control+k');
  await input.fill('SIM STATUS');
  await expect(page.getByRole('option', { name: /LOCAL SIMULATION · NO SIDE EFFECT/i })).toContainText('PAUSED');

  await input.fill('SIM RESUME');
  await page.getByRole('option', { name: /LOCAL SIMULATION · IDEMPOTENT/i }).filter({ hasText: 'SIM RESUME' }).click();

  await page.keyboard.press('Control+k');
  await input.fill('SIM RESET');
  await page.getByRole('option', { name: /LOCAL SIMULATION · CONFIRMATION REQUIRED/i }).filter({ hasText: 'SIM RESET' }).click();
  const resetDialog = page.getByRole('dialog', { name: /Confirm simulation reset/i });
  await expect(resetDialog).toBeVisible();
  await page.getByRole('button', { name: 'Cancel simulation change' }).click();
  await expect(resetDialog).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await input.fill('SIM RESET');
  await page.getByRole('option', { name: /LOCAL SIMULATION · CONFIRMATION REQUIRED/i }).filter({ hasText: 'SIM RESET' }).click();
  await page.getByRole('button', { name: 'Confirm simulation reset' }).click();
  await expect(page.getByRole('dialog', { name: /Confirm simulation reset/i })).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await input.fill('SIM STATUS');
  await expect(page.getByRole('option', { name: /LOCAL SIMULATION · NO SIDE EFFECT/i })).toContainText('RESET · PAUSED');

  await input.fill('SIM REPLAY');
  await page.getByRole('option', { name: /LOCAL SIMULATION · CONFIRMATION REQUIRED/i }).filter({ hasText: 'SIM REPLAY' }).click();
  const replayDialog = page.getByRole('dialog', { name: /Confirm simulation replay/i });
  await expect(replayDialog).toBeVisible();
  await page.getByRole('button', { name: 'Confirm simulation replay' }).click();
  await expect(replayDialog).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await input.fill('SIM STATUS');
  await expect(page.getByRole('option', { name: /LOCAL SIMULATION · NO SIDE EFFECT/i })).toContainText('REPLAY · RUNNING');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
