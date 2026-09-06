import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('uses one local scenario clock for time and speed commands', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Command input' });

  await input.fill('SIM TIME');
  await expect(page.getByRole('option', { name: /LOCAL SIMULATION · NO SIDE EFFECT/i })).toContainText('SPEED 1x');

  await input.fill('SIM SPEED 0.5');
  await page.getByRole('option', { name: /SIM SPEED 0\.50x/i }).click();
  await page.keyboard.press('Control+k');
  await input.fill('SIM TIME');
  await expect(page.getByRole('option', { name: /LOCAL SIMULATION · NO SIDE EFFECT/i })).toContainText('SPEED 0.5x');

  await input.fill('SIM SPEED 0');
  await expect(page.getByRole('option', { name: /SIM SPEED: UNAVAILABLE/i })).toContainText('CALCULATION NOT EXECUTED');
  await input.fill('SIM SPEED 20.1');
  await expect(page.getByRole('option', { name: /SIM SPEED: UNAVAILABLE/i })).toContainText('CALCULATION NOT EXECUTED');
  await input.fill('SIM SPEED NaN');
  await expect(page.getByRole('option', { name: /SIM SPEED: UNAVAILABLE/i })).toContainText('CALCULATION NOT EXECUTED');

  await input.fill('SIM PAUSE');
  await page.getByRole('option', { name: /LOCAL SIMULATION · IDEMPOTENT/i }).filter({ hasText: 'SIM PAUSE' }).click();
  await page.keyboard.press('Control+k');
  await input.fill('SIM SPEED 2');
  await page.getByRole('option', { name: /SIM SPEED 2\.00x/i }).click();
  await page.keyboard.press('Control+k');
  await input.fill('SIM TIME');
  await expect(page.getByRole('option', { name: /LOCAL SIMULATION · NO SIDE EFFECT/i })).toContainText('PAUSED');
  await expect(page.getByRole('option', { name: /LOCAL SIMULATION · NO SIDE EFFECT/i })).toContainText('SPEED 2x');

  await input.fill('SIM RESUME');
  await page.getByRole('option', { name: /LOCAL SIMULATION · IDEMPOTENT/i }).filter({ hasText: 'SIM RESUME' }).click();
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
