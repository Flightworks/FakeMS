import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('previews a future position locally and clears it without mission effects', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  const interpretation = page.getByTestId('command-interpretation');
  await input.fill('PREDICT HOSTILE 1 +2MIN');

  await expect(interpretation).toContainText('COMMAND: PREDICT');
  await expect(interpretation).toContainText('EFFECT: MAP PREVIEW ONLY');
  await expect(interpretation).toContainText('ASSUMPTION: CONSTANT GROUND TRACK / GROUND SPEED');
  const predictOption = page.getByRole('option', { name: /^PREDICT HOSTILE 1 \+2MIN ·/i });
  await expect(predictOption).toBeVisible();

  await predictOption.click();

  await expect(page.getByRole('dialog', { name: 'Tactical command palette' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Future position preview' })).toBeVisible();
  await expect(page.getByTestId('future-position-preview-point')).toBeVisible();
  await expect(page.getByTestId('future-position-preview-vector')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Future position preview' }))
    .toContainText('CONSTANT GROUND TRACK / GROUND SPEED');
  await expect(page.getByRole('region', { name: 'Future position preview' })).toContainText('PROJECTED AT');
  await expect(page.getByRole('dialog', { name: 'Route proposal' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Future position preview' })).toHaveCount(0);
});

test('keeps PREDICT executable on the shared drag-and-drop path', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('PREDICT HOSTILE 1 +2MIN');
  const command = page.getByRole('option', { name: /^PREDICT HOSTILE 1 \+2MIN ·/i });
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

  await expect(page.getByRole('region', { name: 'Future position preview' })).toBeVisible();
  await expect(page.getByTestId('future-position-preview-point')).toBeVisible();
});
