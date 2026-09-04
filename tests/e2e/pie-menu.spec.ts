import { expect, test } from '@playwright/test';

test('opens the radial menu after a long press', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await expect(page.getByRole('dialog', { name: 'MAP ACTION radial menu' })).toBeVisible({ timeout: 5_000 });
  await page.mouse.up();
});

test('keeps the second ring open after selecting a parent option', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await expect(page.getByRole('dialog', { name: 'MAP ACTION radial menu' })).toBeVisible({ timeout: 5_000 });

  const parent = page.getByText('DROP', { exact: true });
  await expect(parent).toBeVisible();
  const bounds = await parent.boundingBox();
  if (!bounds) throw new Error('DROP parent option is not measurable');

  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y) ?? document.body;
    const dispatch = (type: 'pointerdown' | 'pointerup', buttons: number) => {
      target.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 2,
        pointerType: 'mouse',
        buttons,
      }));
    };
    dispatch('pointerdown', 1);
    dispatch('pointerup', 0);
  }, { x, y });

  await expect(page.getByText('WPT', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'MAP ACTION radial menu' })).toBeVisible();

  const subOption = page.getByText('WPT', { exact: true });
  const subBounds = await subOption.boundingBox();
  if (!subBounds) throw new Error('WPT sub-option is not measurable');

  const subX = subBounds.x + subBounds.width / 2;
  const subY = subBounds.y + subBounds.height / 2;
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y) ?? document.body;
    const dispatch = (type: 'pointerdown' | 'pointerup', buttons: number) => {
      target.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 3,
        pointerType: 'mouse',
        buttons,
      }));
    };
    dispatch('pointerdown', 1);
    dispatch('pointerup', 0);
  }, { x: subX, y: subY });

  await page.mouse.up();
  const panel = page.getByRole('dialog', { name: 'Mission action status' });
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Close mission action panel' }).click();
  await expect(panel).not.toBeVisible();
});
