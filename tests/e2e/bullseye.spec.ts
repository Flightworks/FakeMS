import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('confirms and clears a simulated Bullseye without changing designated points', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('SET BULL BRAVO');
  await expect(page.getByRole('option', { name: /^SET BULL BRAVO ·/i })).toBeVisible();
  await page.getByRole('option', { name: /^SET BULL BRAVO ·/i }).click();

  const setDialog = page.getByRole('dialog', { name: 'Set simulated Bullseye' });
  await expect(setDialog).toBeVisible();
  await expect(setDialog).toContainText('BRAVO');
  await setDialog.getByRole('button', { name: 'Cancel set Bullseye' }).click();
  await expect(setDialog).toHaveCount(0);
  await expect(page.getByTestId('simulated-bullseye')).toHaveCount(0);

  await input.fill('SET BULL BRAVO');
  await page.getByRole('option', { name: /^SET BULL BRAVO ·/i }).click();
  await page.getByRole('dialog', { name: 'Set simulated Bullseye' })
    .getByRole('button', { name: 'Confirm set Bullseye' }).click();
  await expect(page.getByTestId('simulated-bullseye')).toContainText('BRAVO');

  await page.keyboard.press('Control+k');
  await input.fill('SET BULL G01');
  await page.getByRole('option', { name: /^SET BULL G01 ·/i }).click();
  const replacementDialog = page.getByRole('dialog', { name: 'Set simulated Bullseye' });
  await expect(replacementDialog).toContainText('replaces BRAVO');
  await replacementDialog.getByRole('button', { name: 'Cancel set Bullseye' }).click();
  await expect(page.getByTestId('simulated-bullseye')).toContainText('BRAVO');

  await page.keyboard.press('Control+k');
  await input.fill('SET BULL G01');
  await page.getByRole('option', { name: /^SET BULL G01 ·/i }).click();
  await page.getByRole('dialog', { name: 'Set simulated Bullseye' })
    .getByRole('button', { name: 'Confirm set Bullseye' }).click();
  await expect(page.getByTestId('simulated-bullseye')).toContainText('G01');

  await page.keyboard.press('Control+k');
  await input.fill('CLEAR BULL');
  await page.getByRole('option', { name: /^CLEAR BULL ·/i }).click();
  const clearDialog = page.getByRole('dialog', { name: 'Clear simulated Bullseye' });
  await expect(clearDialog).toBeVisible();
  await clearDialog.getByRole('button', { name: 'Cancel clear Bullseye' }).click();
  await expect(page.getByTestId('simulated-bullseye')).toBeVisible();

  await page.keyboard.press('Control+k');
  await input.fill('CLEAR BULL');
  await page.getByRole('option', { name: /^CLEAR BULL ·/i }).click();
  await page.getByRole('dialog', { name: 'Clear simulated Bullseye' })
    .getByRole('button', { name: 'Confirm clear Bullseye' }).click();
  await expect(page.getByTestId('simulated-bullseye')).toHaveCount(0);
});

test('measures and previews from the simulated Bullseye without navigation effects', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('SET BULL BRAVO');
  await page.getByRole('option', { name: /^SET BULL BRAVO ·/i }).click();
  await page.getByRole('dialog', { name: 'Set simulated Bullseye' })
    .getByRole('button', { name: 'Confirm set Bullseye' }).click();

  await page.keyboard.press('Control+k');
  await input.fill('BULL HOSTILE 1');
  await expect(page.getByRole('option', { name: /BULL HOSTILE 1.*BRG:.*RNG:/i })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Command interpretation' })).toContainText('SOURCE: SIMULATED BULLSEYE');
  await expect(page.getByRole('region', { name: 'Command interpretation' })).toContainText('QUALIFICATION: CALCULATED');
  await expect(page.getByRole('region', { name: 'Projection preview' })).toHaveCount(0);

  await input.fill('BULL 180/5');
  const projection = page.getByRole('option', { name: /BULL BRG 180.*RNG 5\.0 NM/i });
  await expect(projection).toBeVisible();
  await projection.click();
  const preview = page.getByRole('region', { name: 'Bullseye projection preview' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('BULLSEYE');
  await expect(page.getByTestId('bullseye-preview-point')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Route proposal' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel Bullseye projection preview' }).click();
  await expect(preview).toHaveCount(0);
});

test('keeps SET BULL on the shared drag-and-drop command path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('SET BULL BRAVO');
  const command = page.getByRole('option', { name: /^SET BULL BRAVO ·/i });
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

  await expect(page.getByRole('dialog', { name: 'Set simulated Bullseye' })).toBeVisible();
});
