import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('shows theoretical vertical calculations without execution effects', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');

  const input = page.getByRole('textbox', { name: 'Command input' });
  await input.fill('GRAD VS-700FPM GS110KT');
  await expect(page.getByRole('option', { name: /GRAD -381\.8 FT\/NM/i })).toContainText('THEORETICAL');

  await input.fill('VSREQ LOSE3000FT IN12NM @ 120KT');
  await expect(page.getByRole('option', { name: /VSREQ -500\.0 FPM/i })).toContainText('6.00 MIN');

  await input.fill('TOD BRAVO FROM4500FT TO1500FT VS-700FPM @ 120KT');
  await expect(page.getByRole('option', { name: /TOD BRAVO 8\.57 NM BEFORE/i })).toContainText('THEORETICAL');

  await input.fill('TOD BRAVO FROM4500FT TO1500FT VS700FPM @ 120KT');
  await expect(page.getByRole('option', { name: /TOD: UNAVAILABLE/i })).toContainText('SIGN_INCONSISTENT');
  await expect(page.getByRole('region', { name: /mission action/i })).toHaveCount(0);
});
