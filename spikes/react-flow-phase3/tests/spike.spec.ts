import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const evidenceDir = path.resolve('spikes/react-flow-phase3/evidence');

async function node(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="${id}"]`);
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test.beforeAll(async () => {
  await mkdir(evidenceDir, { recursive: true });
});

test('LCOS identity, interaction, viewport, and deletion semantics', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto('/');
  await expect(page.getByTestId('artifact-count')).toHaveText('Artifacts 8');
  await expect(page.getByTestId('view-count')).toHaveText('Views 10');
  await expect(page.getByTestId('relation-count')).toHaveText('Relations 8');

  const brief = await node(page, 'view-brief-main');
  const logo = await node(page, 'view-logo-main');
  await brief.click();
  await expect(brief).toHaveClass(/selected/);
  await logo.click({ modifiers: ['Shift'] });
  await expect(brief).toHaveClass(/selected/);
  await expect(logo).toHaveClass(/selected/);

  const box = await brief.boundingBox();
  if (!box) throw new Error('Brief node has no bounding box');
  await page.mouse.move(box.x + 60, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 105, box.y + 82, { steps: 8 });
  await page.mouse.up();

  await brief.dblclick();
  await expect(page.getByTestId('inspector')).toHaveClass(/is-open/);
  await expect(page.getByTestId('inspector')).toContainText('artifact-source-brief');
  await expect(page.getByTestId('inspector')).toContainText('view-brief-main');

  const canvas = page.locator('.react-flow__pane');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas pane has no bounding box');
  const beforePan = await page.getByTestId('viewport-readout').textContent();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.55, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.65, canvasBox.y + canvasBox.height * 0.62, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  await expect(page.getByTestId('viewport-readout')).not.toHaveText(beforePan ?? '');

  const beforeZoom = await page.getByTestId('viewport-readout').textContent();
  await canvas.hover();
  await page.mouse.wheel(0, -420);
  await expect(page.getByTestId('viewport-readout')).not.toHaveText(beforeZoom ?? '');

  await page.getByRole('button', { name: 'Fit views' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Save viewport' }).click();
  const saved = await page.getByTestId('saved-viewport').textContent();
  const savedValues = saved?.match(/saved (-?\d+\.\d)\/(-?\d+\.\d)\/(\d+\.\d{2})/);
  expect(savedValues).not.toBeNull();
  await page.getByRole('button', { name: 'Set far viewport' }).click();
  await page.waitForTimeout(180);
  await page.getByRole('button', { name: 'Restore viewport' }).click();
  await page.waitForTimeout(260);
  await expect(page.getByTestId('saved-viewport')).toHaveText(saved ?? '');
  const restored = await page.getByTestId('viewport-readout').textContent();
  const restoredValues = restored?.match(/x (-?\d+\.\d) · y (-?\d+\.\d) · zoom (\d+\.\d{2})/);
  expect(restoredValues).not.toBeNull();
  expect(Number(restoredValues?.[1])).toBeCloseTo(Number(savedValues?.[1]), 0);
  expect(Number(restoredValues?.[2])).toBeCloseTo(Number(savedValues?.[2]), 0);
  expect(Number(restoredValues?.[3])).toBeCloseTo(Number(savedValues?.[3]), 1);

  await page.getByRole('button', { name: 'Delete selected views' }).click();
  await expect(page.getByTestId('artifact-count')).toHaveText('Artifacts 8');
  await expect(page.getByTestId('view-count')).toHaveText('Views 8');
  await expect(page.getByTestId('relation-count')).toHaveText('Relations 6');

  await page.screenshot({ path: path.join(evidenceDir, 'lcos-react-flow-interactions.png'), fullPage: true });
  expect(browserErrors).toEqual([]);
});

test('100 and 300 view render samples stay interactive', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto('/');
  const samples: unknown[] = [];

  for (const count of [100, 300]) {
    await page.getByRole('button', { name: `Load ${count} views` }).click();
    await expect(page.getByTestId('view-count')).toHaveText(`Views ${count}`);
    await expect(page.getByTestId('performance-result')).toContainText(`"nodeCount":${count}`);
    samples.push(JSON.parse((await page.getByTestId('performance-result').textContent()) ?? '{}'));

    const first = await node(page, `scale-view-${count}-0`);
    await first.click();
    await expect(first).toHaveClass(/selected/);
    await page.getByRole('button', { name: 'Fit views' }).click();
    await page.waitForTimeout(220);
    await page.screenshot({
      path: path.join(evidenceDir, `lcos-react-flow-${count}-views.png`),
      fullPage: true,
    });
  }

  await writeFile(
    path.join(evidenceDir, 'performance-results.json'),
    `${JSON.stringify({ browser: await page.evaluate(() => navigator.userAgent), samples }, null, 2)}\n`,
    'utf8',
  );
  expect(browserErrors).toEqual([]);
});
