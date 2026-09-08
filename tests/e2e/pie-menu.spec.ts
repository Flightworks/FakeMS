import { expect, test } from '@playwright/test';

test('opens the radial menu after a long press', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await expect(page.getByRole('dialog', { name: 'MAP ACTION radial menu' })).toBeVisible({ timeout: 5_000 });
  await page.mouse.up();
});

test('keeps only the effective TRACKS to VECTOR radial action', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.mouse.move(700, 400);
  await page.mouse.down();
  const radial = page.getByRole('dialog', { name: 'MAP ACTION radial menu' });
  await expect(radial).toBeVisible({ timeout: 5_000 });

  await expect(radial.getByText('TRACKS', { exact: true })).toBeVisible();
  await expect(radial.getByText('DROP', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('TOOLS', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('VIEW', { exact: true })).toHaveCount(0);

  const parent = radial.getByText('TRACKS', { exact: true });
  const bounds = await parent.boundingBox();
  if (!bounds) throw new Error('TRACKS parent option is not measurable');

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

  await expect(radial.getByText('VECTOR', { exact: true })).toBeVisible();
  await expect(radial).toBeVisible();

  const subOption = radial.getByText('VECTOR', { exact: true });
  const subBounds = await subOption.boundingBox();
  if (!subBounds) throw new Error('VECTOR sub-option is not measurable');

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
  await expect(radial).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Mission action status' })).toHaveCount(0);
});

test('keeps the effective TRACKS to VECTOR action from an entity radial menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });

  const entityMarker = page.locator('.custom-entity-icon').first();
  await expect(entityMarker).toBeVisible();
  const markerBounds = await entityMarker.boundingBox();
  if (!markerBounds) throw new Error('entity marker is not measurable');

  const markerX = markerBounds.x + markerBounds.width / 2;
  const markerY = markerBounds.y + markerBounds.height / 2;
  await page.mouse.move(markerX, markerY);
  await page.mouse.down();

  const radial = page.getByRole('dialog', { name: /radial menu$/ });
  await expect(radial).toBeVisible({ timeout: 5_000 });
  await expect(radial.getByText('TRACKS', { exact: true })).toBeVisible();
  await expect(radial.getByText('DROP', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('ENGAGE', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('COMMS', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('SENSORS', { exact: true })).toHaveCount(0);

  const parent = radial.getByText('TRACKS', { exact: true });
  const parentBounds = await parent.boundingBox();
  if (!parentBounds) throw new Error('TRACKS entity option is not measurable');
  const parentX = parentBounds.x + parentBounds.width / 2;
  const parentY = parentBounds.y + parentBounds.height / 2;
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y) ?? document.body;
    const dispatch = (type: 'pointerdown' | 'pointerup', buttons: number) => {
      target.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 4,
        pointerType: 'mouse',
        buttons,
      }));
    };
    dispatch('pointerdown', 1);
    dispatch('pointerup', 0);
  }, { x: parentX, y: parentY });

  await expect(radial.getByText('VECTOR', { exact: true })).toBeVisible();

  const subOption = radial.getByText('VECTOR', { exact: true });
  const subBounds = await subOption.boundingBox();
  if (!subBounds) throw new Error('VECTOR entity option is not measurable');
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
        pointerId: 5,
        pointerType: 'mouse',
        buttons,
      }));
    };
    dispatch('pointerdown', 1);
    dispatch('pointerup', 0);
  }, { x: subX, y: subY });

  await page.mouse.up();
  await expect(radial).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Mission action status' })).toHaveCount(0);
});
