import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('executes the exact dragged command through the shared registry path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('DCT G01');
  const command = page.getByRole('option', { name: /DCT G01.*Direct To/ }).first();
  await expect(command).toBeVisible();
  await expect(command).toHaveAttribute('draggable', 'true');

  await command.evaluate((element) => {
    const dataTransfer = new DataTransfer();
    element.dispatchEvent(new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
    const map = document.querySelector('.leaflet-container');
    if (!map) throw new Error('Map container not found');
    map.dispatchEvent(new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
    map.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
  });

  const proposal = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await expect(proposal).toContainText('AWAITING AUTHORIZATION');
  await expect(proposal).toContainText('G01');
});

test('does not make a read-only result draggable or execute it on drop', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('SIM STATUS');
  const command = page.getByRole('option', { name: /SIM STATUS.*LOCAL SIMULATION/i }).first();
  await expect(command).toBeVisible();
  await expect(command).toHaveAttribute('draggable', 'false');

  await page.evaluate(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/json', JSON.stringify({
      type: 'command',
      commandId: 'sim-status',
      query: 'SIM STATUS',
    }));
    const map = document.querySelector('.leaflet-container');
    if (!map) throw new Error('Map container not found');
    map.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
  });

  await expect(page.getByRole('dialog', { name: /Confirm simulation/i })).toHaveCount(0);
});
