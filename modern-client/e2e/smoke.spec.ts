import { expect, test } from '@playwright/test';
import { installMockPs } from './mock-ps';

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
});

test('loads home with real readiness states and no demo language', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Showdown Arena' })).toBeVisible();
  await expect(page.getByText(/demo|fixture|preview/i)).toHaveCount(0);
  await expect(page.locator('.match-panel .inline-error')).toContainText('Choose a name');
  await expect(page.getByRole('button', { name: /search battle/i })).toBeDisabled();

  await page.getByRole('button', { name: /Guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: 'Set guest name' }).click();
  await expect(page.getByRole('button', { name: /CodexTester/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /search battle/i })).toBeEnabled();
});

test('search creates a mock battle room and sends exact battle choices', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: 'Set guest name' }).click();
  await page.getByRole('button', { name: /search battle/i }).click();

  await expect(page.getByRole('button', { name: /cancel search/i })).toBeVisible();
  await page.goto('/battle/battle-gen9ou-1');
  await expect(page.getByRole('heading', { name: /CodexTester vs MockRival/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Moonblast/i })).toBeVisible();
  await page.getByRole('button', { name: /Moonblast/i }).click();
  await expect(page.getByRole('button', { name: /Foe -1/i })).toBeVisible();
  await page.getByRole('button', { name: /Foe -1/i }).click();

  await expect.poll(async () => page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent.join('\n'))).toContain('battle-gen9ou-1|/choose move 1 -1|7');
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent.join('\n'))).toContain('|/utm ');
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent.join('\n'))).toContain('|/search gen9ou');
});

test('loads every primary route directly without placeholder language', async ({ page }) => {
  const routes = [
    ['/', 'Showdown Arena'],
    ['/teambuilder', 'Teambuilder'],
    ['/rooms', 'Rooms'],
    ['/ladder', 'Ladder'],
    ['/replays', 'Replays'],
    ['/settings', 'Settings'],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText(/preview|fixture/i)).toHaveCount(0);
  }
});

test('keeps mobile battle controls usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: 'Set guest name' }).click();
  await page.getByRole('button', { name: /search battle/i }).click();
  await page.goto('/battle/battle-gen9ou-1');
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
