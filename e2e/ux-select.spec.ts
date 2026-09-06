import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { installMockPs } from './mock-ps';

test.beforeEach(async ({ page }) => { await installMockPs(page); });

async function openChallenge(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Select battle format', exact: true }).waitFor();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('arena:challenge', { detail: { user: 'Bob', format: 'gen9ou', accept: false } })));
  const dialog = page.getByRole('dialog', { name: 'Challenge · Bob' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('challenge selectors accept pointer input and Escape dismisses one layer at a time', async ({ page }) => {
  const dialog = await openChallenge(page);
  const format = dialog.getByRole('button', { name: 'Select battle format', exact: true });
  await format.click();
  const filter = page.getByRole('combobox', { name: 'Select battle format filter' });
  await expect(filter).toBeFocused();
  await filter.fill('Random');
  await page.getByRole('option', { name: /Random Battle/ }).click();
  await expect(format).toBeFocused();
  await expect(format).toContainText('Random Battle');
  await expect(dialog.getByRole('combobox', { name: 'Challenge team' })).toHaveCount(0);
  await format.click();
  await expect(filter).toHaveValue('');
  await filter.press('Escape');
  await expect(filter).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(format).toBeFocused();
  await format.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Tab follows the challenge form and outside dismissal clears the filter', async ({ page }) => {
  // macOS WebKit uses Option+Tab to include buttons in native navigation.
  const previousControl = test.info().project.name === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab';
  const dialog = await openChallenge(page);
  const format = dialog.getByRole('button', { name: 'Select battle format', exact: true });
  const filter = page.getByRole('combobox', { name: 'Select battle format filter' });
  await format.click();
  await filter.fill('OU');
  await filter.press('Tab');
  await expect(dialog.getByRole('combobox', { name: 'Challenge team' })).toBeFocused();
  await page.keyboard.press(previousControl);
  await expect(format).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(filter).toBeFocused();
  await filter.press(previousControl);
  await expect(dialog.getByRole('button', { name: 'Close challenge' })).toBeFocused();
  await format.click();
  await filter.fill('No such format');
  await dialog.getByRole('heading', { name: 'Challenge · Bob' }).click();
  await expect(filter).toHaveCount(0);
  await format.click();
  await expect(filter).toHaveValue('');
  await expect(page.getByRole('listbox', { name: 'Select battle format', exact: true }).getByRole('option')).toHaveCount(2);
});

test('a short viewport and a simulated keyboard keep the popup inside visible bounds', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 420 });
  const dialog = await openChallenge(page);
  await dialog.getByRole('button', { name: 'Select battle format', exact: true }).click();
  const popup = page.locator('.select-popover');
  await expect(page.getByRole('combobox', { name: 'Select battle format filter' })).toBeFocused();
  const box = (await popup.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(367);
  expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.y + box.height).toBeLessThanOrEqual(412);
  // Headless browsers do not open an OS keyboard; model its visual viewport
  // resize while retaining the full layout viewport and the focused input.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 180 });
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 120 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => { const rect = (await popup.boundingBox())!; return rect.y >= 128 && rect.y + rect.height <= 292; }).toBe(true);
  await expect(page.getByRole('combobox', { name: 'Select battle format filter' })).toBeFocused();
  await page.screenshot({ path: `/tmp/select-ux-keyboard-${test.info().project.name}.png` });
});

test('modal selection remains usable when native popovers are unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: undefined }));
  const dialog = await openChallenge(page);
  const format = dialog.getByRole('button', { name: 'Select battle format', exact: true });
  await format.click();
  const filter = page.getByRole('combobox', { name: 'Select battle format filter' });
  await expect(filter).toBeFocused();
  await filter.fill('Random');
  await page.getByRole('option', { name: /Random Battle/ }).click();
  await expect(format).toContainText('Random Battle');
  await expect(format).toBeFocused();
  await expect(dialog).toBeVisible();
});
