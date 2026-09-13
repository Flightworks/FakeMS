import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const LEGACY_OPTIONS = ['TRACKS', 'DROP', 'TOOLS', 'COMMS', 'SENSORS'];

type RadialContext = {
  name: string;
  title: string;
  roots: string[];
  probeParent: string;
  probeLeaves: string[];
  open: (page: Page) => Promise<Locator>;
};

const waitForMap = async (page: Page) => {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.custom-entity-icon').first()).toBeVisible({ timeout: 10_000 });
};

const entityMarker = (page: Page, entityId: string) => page.locator(
  '.custom-entity-icon',
  { has: page.locator(`[data-entity-id="${entityId}"]`) },
);

const openMapRadial = async (page: Page, x = 700, y = 400) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  const radial = page.getByRole('dialog', { name: 'MAP ACTION radial menu' });
  await expect(radial).toBeVisible({ timeout: 5_000 });
  return radial;
};

const openEntityRadial = async (page: Page, entityId: string, title: string) => {
  const marker = entityMarker(page, entityId);
  await expect(marker).toBeVisible();
  const bounds = await marker.boundingBox();
  if (!bounds) throw new Error(`${entityId} marker is not measurable`);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;

  // Dispatch on the exact mission marker so nearby overlapping markers cannot
  // change the captured context. Leaflet still routes this through the marker
  // handler and the application long-press path.
  await marker.dispatchEvent('mousedown', {
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
    detail: 1,
  });
  const radial = page.getByRole('dialog', { name: `${title} radial menu` });
  await expect(radial).toBeVisible({ timeout: 5_000 });
  return radial;
};

const assertNoLegacyOptions = async (radial: Locator) => {
  for (const label of LEGACY_OPTIONS) {
    await expect(radial.getByText(label, { exact: true })).toHaveCount(0);
  }
};

const assertTwoLevelTree = async (
  radial: Locator,
  roots: readonly string[],
  probeParent: string,
  probeLeaves: readonly string[],
) => {
  const rootLabels = (await radial.locator('button[data-menu-level="inner"]').allTextContents())
    .map(label => label.trim());
  expect(rootLabels).toEqual(roots);
  await assertNoLegacyOptions(radial);

  await radial.getByRole('button', { name: probeParent, exact: true }).click();
  const leafLabels = (await radial.locator('button[data-menu-level="outer"]').allTextContents())
    .map(label => label.trim());
  expect(leafLabels).toEqual(probeLeaves);
  await assertNoLegacyOptions(radial);
  await expect(radial.locator('button[data-menu-level="inner"]')).toHaveCount(roots.length);
  await expect(radial.locator('button[data-menu-level="outer"]')).toHaveCount(probeLeaves.length);
  await expect(radial.locator(
    'button[data-menu-level]:not([data-menu-level="inner"]):not([data-menu-level="outer"])',
  )).toHaveCount(0);
};

const radialContexts: RadialContext[] = [
  {
    name: 'MAP/FOND',
    title: 'MAP ACTION',
    roots: ['Vue', 'Affichage', 'Mesurer'],
    probeParent: 'Vue',
    probeLeaves: ['Centrer ici', 'Recentrer l’ownship', 'Nord en haut', 'Cap en haut'],
    open: page => openMapRadial(page),
  },
  {
    name: 'OWNSHIP',
    title: 'VIPER 1-1',
    roots: ['Navigation simulée', 'Stabiliser', 'Trajectoire', 'Données'],
    probeParent: 'Navigation simulée',
    probeLeaves: ['Cap et vitesse', 'Pause / reprise', 'Route active'],
    open: page => openEntityRadial(page, 'ownship', 'VIPER 1-1'),
  },
  {
    name: 'WAYPOINT',
    title: 'G01',
    roots: ['Direct simulé', 'Mesurer', 'Point'],
    probeParent: 'Mesurer',
    probeLeaves: ['Distance / relèvement', 'ETA / ETE'],
    open: page => openEntityRadial(page, 'wp-1', 'G01'),
  },
  {
    name: 'TRACK',
    title: 'HOSTILE 1',
    roots: ['Données', 'Suivi'],
    probeParent: 'Données',
    probeLeaves: ['Informations', 'Âge', 'Qualité'],
    open: page => openEntityRadial(page, 'en-1', 'HOSTILE 1'),
  },
  {
    name: 'BASE',
    title: 'BASE',
    roots: ['Données', 'Rejoindre', 'Vue'],
    probeParent: 'Données',
    probeLeaves: ['Identité et coordonnées', 'Données du scénario'],
    open: page => openEntityRadial(page, 'apt-1', 'BASE'),
  },
];

test('qualifies all five radial contexts and their available family labels', async ({ page }) => {
  test.setTimeout(120_000);

  for (const context of radialContexts) {
    await waitForMap(page);
    const radial = await context.open(page);
    await expect(radial).toHaveAttribute('aria-label', `${context.title} radial menu`);
    await assertTwoLevelTree(radial, context.roots, context.probeParent, context.probeLeaves);
    await page.keyboard.press('Escape');
    await expect(radial).toHaveCount(0);
    await page.mouse.up();
  }
});

test('changes rendered map state through VECTORS, GRID, and declutter leaves', async ({ page }) => {
  await waitForMap(page);
  const vectors = page.locator('.kinematic-vector-line');
  await expect(vectors).toHaveCount(3);
  await expect(page.getByTestId('vector-layer-status')).toHaveText('VECTORS ON');

  let radial = await openMapRadial(page);
  await radial.getByRole('button', { name: 'Affichage', exact: true }).click();
  await radial.getByRole('button', { name: 'Vecteurs', exact: true }).click();
  await expect(radial).toHaveCount(0);
  await page.mouse.up();
  await expect(vectors).toHaveCount(0);
  await expect(page.getByTestId('vector-layer-status')).toHaveText('VECTORS OFF');

  radial = await openMapRadial(page);
  await radial.getByRole('button', { name: 'Affichage', exact: true }).click();
  await radial.getByRole('button', { name: 'Grille', exact: true }).click();
  await expect(radial).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(async () => page.locator('.latlon-grid-line').count()).toBeGreaterThan(0);

  radial = await openMapRadial(page);
  await radial.getByRole('button', { name: 'Affichage', exact: true }).click();
  await radial.getByRole('button', { name: 'Allègement', exact: true }).click();
  await expect(radial).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByText('HOSTILE 1', { exact: true })).toBeHidden();
  await expect(page.getByTestId('vector-layer-status')).toHaveText('VECTORS OFF · DECLUTTER');
  await expect(page.locator('.custom-entity-icon')).toHaveCount(6);
});

test('selects a track through DATA and shows the selected target panel', async ({ page }) => {
  await waitForMap(page);
  const radial = await openEntityRadial(page, 'en-1', 'HOSTILE 1');
  await radial.getByRole('button', { name: 'Données', exact: true }).click();
  await radial.getByRole('button', { name: 'Informations', exact: true }).click();

  await expect(radial).toHaveCount(0);
  await expect(page.getByText('FROM H/C', { exact: true })).toBeVisible();
  await expect(page.getByText('BRG', { exact: true })).toBeVisible();
  await expect(page.getByText('DIST', { exact: true })).toBeVisible();
  await page.mouse.up();
});

test('uses a waypoint CENTER leaf to move the rendered map target to center', async ({ page }) => {
  await waitForMap(page);
  const marker = entityMarker(page, 'wp-2');
  const before = await marker.boundingBox();
  if (!before) throw new Error('BRAVO marker is not measurable before centering');
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const beforeDistance = Math.hypot(
    before.x + before.width / 2 - viewport.width / 2,
    before.y + before.height / 2 - viewport.height / 2,
  );
  expect(beforeDistance).toBeGreaterThan(20);

  const radial = await openEntityRadial(page, 'wp-2', 'BRAVO');
  await radial.getByRole('button', { name: 'Point', exact: true }).click();
  await radial.getByRole('button', { name: 'Centrer', exact: true }).click();
  await expect(radial).toHaveCount(0);
  await page.mouse.up();

  await expect.poll(async () => {
    const after = await marker.boundingBox();
    if (!after) return Number.POSITIVE_INFINITY;
    return Math.hypot(
      after.x + after.width / 2 - viewport.width / 2,
      after.y + after.height / 2 - viewport.height / 2,
    );
  }).toBeLessThan(10);
});

test('opens DCT as a proposal without activating a route before confirmation', async ({ page }) => {
  await waitForMap(page);
  const radial = await openEntityRadial(page, 'wp-1', 'G01');
  await radial.getByRole('button', { name: 'Direct simulé', exact: true }).click();

  const proposal = page.getByRole('dialog', { name: 'Direct-to route proposal status' });
  await expect(proposal).toBeVisible();
  await expect(proposal).toContainText('DCT PROPOSAL');
  await expect(proposal).toContainText('AWAITING AUTHORIZATION');
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(0);
  await expect(proposal.getByRole('button', { name: 'Accept route proposal' })).toBeVisible();
  await expect(radial).toHaveCount(0);

  await proposal.getByRole('button', { name: 'Reject route proposal' }).click();
  await expect(proposal).toContainText('REJECTED');
  await expect(page.locator('.leaflet-simulatedRouteLayer-pane path')).toHaveCount(0);
  await page.mouse.up();
});

test('changes track trail visibility through the TRACK radial tree', async ({ page }) => {
  await waitForMap(page);
  await page.waitForTimeout(2_500);
  const trails = page.locator('.leaflet-trackTrailLayer-pane path');
  await expect(trails).toHaveCount(0);

  const radial = await openEntityRadial(page, 'en-1', 'HOSTILE 1');
  await radial.getByRole('button', { name: 'Suivi', exact: true }).click();
  await radial.getByRole('button', { name: 'Trajectoire', exact: true }).click();
  await expect(radial).toHaveCount(0);
  await page.mouse.up();

  await expect.poll(async () => trails.count(), { timeout: 5_000 }).toBeGreaterThan(0);
});

test('omits unsupported CPA and projection leaves rather than claiming availability', async ({ page }) => {
  await waitForMap(page);
  let radial = await openEntityRadial(page, 'wp-1', 'G01');
  await radial.getByRole('button', { name: 'Mesurer', exact: true }).click();
  await expect(radial.getByRole('button', { name: 'Distance / relèvement', exact: true })).toBeVisible();
  await expect(radial.getByRole('button', { name: 'ETA / ETE', exact: true })).toBeVisible();
  await expect(radial.getByRole('button', { name: 'Projection paramétrée', exact: true })).toHaveCount(0);
  await expect(radial.getByText('CPA / TCPA', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(radial).toHaveCount(0);
  await page.mouse.up();

  await page.reload();
  await expect(page.locator('.custom-entity-icon').first()).toBeVisible({ timeout: 10_000 });
  radial = await openEntityRadial(page, 'en-1', 'HOSTILE 1');
  await expect(radial.getByRole('button', { name: 'Mesurer', exact: true })).toHaveCount(0);
  await expect(radial.getByText('CPA / TCPA', { exact: true })).toHaveCount(0);
  await expect(radial.getByText('Projection paramétrée', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(radial).toHaveCount(0);
  await page.mouse.up();
});

test('keeps decorative airport points out of mission radial contexts while BASE remains exact', async ({ page }) => {
  // The regional mission view places the nearest decorative airport just
  // outside the narrow profile; use the wide target profile to exercise its
  // non-interactive rendering without changing the mission data.
  await page.setViewportSize({ width: 1366, height: 768 });
  await waitForMap(page);
  const decorativePoints = page.locator('.tactical-airport-point:not([d="M0 0"])');
  const pointIndex = await decorativePoints.evaluateAll((elements) => elements.findIndex(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && rect.right >= 0
      && rect.left <= innerWidth
      && rect.bottom >= 0
      && rect.top <= innerHeight;
  }));
  expect(pointIndex).toBeGreaterThanOrEqual(0);
  const point = decorativePoints.nth(pointIndex);
  const pointBounds = await point.boundingBox();
  if (!pointBounds) throw new Error('decorative airport point is not measurable');

  await page.mouse.move(pointBounds.x + pointBounds.width / 2, pointBounds.y + pointBounds.height / 2);
  await page.mouse.down();
  const mapRadial = page.getByRole('dialog', { name: 'MAP ACTION radial menu' });
  await expect(mapRadial).toBeVisible({ timeout: 5_000 });
  const missionRadialLabels = await page.getByRole('dialog', { name: /radial menu$/ }).evaluateAll(
    dialogs => dialogs
      .map(dialog => dialog.getAttribute('aria-label'))
      .filter(label => label !== 'MAP ACTION radial menu'),
  );
  expect(missionRadialLabels).toEqual([]);
  await page.mouse.up();
  await expect(mapRadial).toHaveCount(0);

  const baseRadial = await openEntityRadial(page, 'apt-1', 'BASE');
  await expect(baseRadial).toHaveAttribute('aria-label', 'BASE radial menu');
  await page.mouse.up();
  await expect(baseRadial).toHaveCount(0);
});

test('clamps radial anchors and labels within 1024x768 and 1366x768 viewports', async ({ page }) => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    await waitForMap(page);
    const radial = await openMapRadial(page, viewport.width - 30, viewport.height - 30);
    const anchor = await radial.locator('[data-testid="radial-menu-anchor"]').boundingBox();
    if (!anchor) throw new Error(`radial anchor is not measurable at ${viewport.width}`);
    expect(anchor.x).toBeGreaterThanOrEqual(0);
    expect(anchor.x).toBeLessThanOrEqual(viewport.width);
    expect(anchor.y).toBeGreaterThanOrEqual(0);
    expect(anchor.y).toBeLessThanOrEqual(viewport.height);

    const buttonRects = await radial.locator('button[data-menu-level]').evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }));
    for (const rect of buttonRects) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(viewport.width);
      expect(rect.bottom).toBeLessThanOrEqual(viewport.height);
    }
    const title = radial.getByText('MAP ACTION', { exact: true });
    const titleBounds = await title.boundingBox();
    if (!titleBounds) throw new Error(`radial title is not measurable at ${viewport.width}`);
    expect(titleBounds.x).toBeGreaterThanOrEqual(0);
    expect(titleBounds.x + titleBounds.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    await page.mouse.up();
    await expect(radial).toHaveCount(0);
  }
});
