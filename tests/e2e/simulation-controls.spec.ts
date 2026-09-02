import { expect, test } from '@playwright/test';

test('exposes pause, reset and replay controls for the simulation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'NAV SIM' }).click();

  const toolbox = page.getByRole('region', { name: 'Simulation toolbox' });
  await expect(toolbox).toContainText('RUNNING');

  await toolbox.getByRole('button', { name: 'Pause simulation' }).click();
  await expect(toolbox).toContainText('PAUSED');

  await toolbox.getByRole('button', { name: 'Reset simulation' }).click();
  await expect(toolbox).toContainText('RESET · PAUSED');

  await toolbox.getByRole('button', { name: 'Replay simulation' }).click();
  await expect(toolbox).toContainText('REPLAY · RUNNING');
});
