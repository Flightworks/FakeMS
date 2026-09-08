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
