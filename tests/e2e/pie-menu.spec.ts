import { expect, test } from '@playwright/test';

test('opens the radial menu after a long press', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await expect(page.getByRole('dialog', { name: 'MAP ACTION radial menu' })).toBeVisible({ timeout: 5_000 });
  await page.mouse.up();
});

test('exposes the available map context families and toggles vectors', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.mouse.move(700, 400);
  await page.mouse.down();
  const radial = page.getByRole('dialog', { name: 'MAP ACTION radial menu' });
  await expect(radial).toBeVisible({ timeout: 5_000 });
  await expect(radial.getByText('Vue', { exact: true })).toBeVisible();
  await expect(radial.getByText('Affichage', { exact: true })).toBeVisible();
  await expect(radial.getByText('Mesurer', { exact: true })).toBeVisible();
  await expect(radial.getByText('TRACKS', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('DROP', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('TOOLS', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('VIEW', { exact: true })).toHaveCount(0);

  const parent = radial.getByText('Affichage', { exact: true });
  const bounds = await parent.boundingBox();
  if (!bounds) throw new Error('Affichage parent option is not measurable');

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

  await expect(radial.getByText('Vecteurs', { exact: true })).toBeVisible();
  await expect(radial).toBeVisible();

  const subOption = radial.getByText('Vecteurs', { exact: true });
  const subBounds = await subOption.boundingBox();
  if (!subBounds) throw new Error('Vecteurs sub-option is not measurable');

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
  await expect(page.locator('.kinematic-vector-line')).toHaveCount(0);
  await expect(page.getByTestId('vector-layer-status')).toHaveText('VECTORS OFF');
  await expect(page.getByRole('dialog', { name: 'Mission action status' })).toHaveCount(0);
});

test('opens the ownship context tree with only executable families', async ({ page }) => {
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
  await expect(radial.getByText('Navigation simulée', { exact: true })).toBeVisible();
  await expect(radial.getByText('Stabiliser', { exact: true })).toBeVisible();
  await expect(radial.getByText('Trajectoire', { exact: true })).toBeVisible();
  await expect(radial.getByText('Données', { exact: true })).toBeVisible();
  await expect(radial.getByText('TRACKS', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('DROP', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('COMMS', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('SENSORS', { exact: true })).toHaveCount(0);

  const parent = radial.getByText('Stabiliser', { exact: true });
  const parentBounds = await parent.boundingBox();
  if (!parentBounds) throw new Error('Stabiliser ownship option is not measurable');
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

  await expect(radial.getByText('Suivre l’ownship', { exact: true })).toBeVisible();

  const subOption = radial.getByText('Suivre l’ownship', { exact: true });
  const subBounds = await subOption.boundingBox();
  if (!subBounds) throw new Error('ownship follow option is not measurable');
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

test('applies map grid and declutter leaves to rendered state', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });

  await page.mouse.move(700, 400);
  await page.mouse.down();
  const radial = page.getByRole('dialog', { name: 'MAP ACTION radial menu' });
  await expect(radial).toBeVisible({ timeout: 5_000 });
  await radial.getByRole('button', { name: 'Affichage', exact: true }).click();
  await radial.getByRole('button', { name: 'Grille', exact: true }).click();
  await page.mouse.up();
  await expect.poll(async () => page.locator('.latlon-grid-line').count()).toBeGreaterThan(0);

  await page.mouse.move(700, 400);
  await page.mouse.down();
  await expect(radial).toBeVisible({ timeout: 5_000 });
  await radial.getByRole('button', { name: 'Affichage', exact: true }).click();
  await radial.getByRole('button', { name: 'Allègement', exact: true }).click();
  await page.mouse.up();
  await expect(page.getByText('HOSTILE 1', { exact: true })).toBeHidden();
  await expect(page.locator('.custom-entity-icon')).toHaveCount(6);
});

test('keeps waypoint direct-to behind the existing proposal confirmation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });

  const waypointMarker = page.locator('.custom-entity-icon').nth(1);
  await expect(waypointMarker).toBeVisible();
  const markerBounds = await waypointMarker.boundingBox();
  if (!markerBounds) throw new Error('waypoint marker is not measurable');
  await page.mouse.move(markerBounds.x + markerBounds.width - 4, markerBounds.y + 4);
  await page.mouse.down();

  const radial = page.getByRole('dialog', { name: /radial menu$/ });
  await expect(radial).toBeVisible({ timeout: 5_000 });
  const direct = radial.getByText('Direct simulé', { exact: true });
  await expect(direct).toBeVisible();
  const directBounds = await direct.boundingBox();
  if (!directBounds) throw new Error('direct-to option is not measurable');
  const x = directBounds.x + directBounds.width / 2;
  const y = directBounds.y + directBounds.height / 2;
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y) ?? document.body;
    for (const [type, buttons] of [['pointerdown', 1], ['pointerup', 0]] as const) {
      target.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 6,
        pointerType: 'mouse',
        buttons,
      }));
    }
  }, { x, y });
  await page.mouse.up();

  await expect(page.getByRole('dialog', { name: 'Direct-to route proposal status' })).toBeVisible();
  await expect(page.getByText('DCT PROPOSAL', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept route proposal' })).toBeVisible();
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(0);
});
