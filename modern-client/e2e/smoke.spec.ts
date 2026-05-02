import { expect, test } from '@playwright/test';

test('loads home and direct battle route', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Showdown Arena' })).toBeVisible();
  await expect(page.getByRole('link', { name: /open demo battle/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /search battle/i })).toBeVisible();

  await page.getByRole('link', { name: /open demo battle/i }).click();
  await expect(page).toHaveURL(/\/battle\/demo-gen9ou$/);
  await expect(page.getByRole('heading', { name: /You vs Rival/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Moonblast/i })).toBeVisible();
});

test('loads every primary route directly', async ({ page }) => {
  const routes = [
    ['/', 'Showdown Arena'],
    ['/teambuilder', 'Teambuilder'],
    ['/rooms', 'Rooms'],
    ['/ladder', 'Ladder'],
    ['/replays', 'Replays'],
    ['/settings', 'Settings'],
    ['/battle/demo-gen9ou', 'You vs Rival'],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText('Compatibility surface')).toHaveCount(0);
  }
});

test('demo battle controls produce visible feedback', async ({ page }) => {
  await page.goto('/battle/demo-gen9ou');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Battle playback paused.')).toBeVisible();

  await page.getByRole('button', { name: /Moonblast/i }).click();
  await expect(page.getByText('Queued Moonblast.')).toBeVisible();

  await page.getByRole('textbox', { name: /chat message/i }).fill('testing chat');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('region', { name: /battle chat/i }).getByText('testing chat')).toBeVisible();
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
  await expect(page.getByRole('button', { name: /skip to battle workspace/i })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#workspace')).toBeFocused();
});
