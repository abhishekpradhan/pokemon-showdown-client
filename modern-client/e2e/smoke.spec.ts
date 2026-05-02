import { expect, test } from '@playwright/test';

test('loads home and direct battle route', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Showdown Arena' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible();

  await page.goto('/battle/demo-gen9ou');
  await expect(page.getByRole('heading', { name: /You vs Rival/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Moonblast/i })).toBeVisible();
});

test('captures non-empty visual smoke screenshots', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Showdown Arena' })).toBeVisible();
  const homeShot = await page.screenshot({ fullPage: true });
  expect(homeShot.byteLength).toBeGreaterThan(40_000);

  await page.goto('/battle/demo-gen9ou');
  await expect(page.getByRole('button', { name: /Moonblast/i })).toBeVisible();
  const battleShot = await page.screenshot({ fullPage: true });
  expect(battleShot.byteLength).toBeGreaterThan(40_000);
});

test('keeps mobile battle controls usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/battle/demo-gen9ou');
  await expect(page.getByRole('heading', { name: /You vs Rival/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Moonblast/i })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('provides keyboard access to the main workspace', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /skip to battle workspace/i })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#workspace')).toBeFocused();
});
