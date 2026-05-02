import { expect, test } from '@playwright/test';

test('loads home and direct battle route', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Showdown Arena' })).toBeVisible();
  await expect(page.getByRole('button', { name: /battle/i })).toBeVisible();

  await page.goto('/battle/demo-gen9ou');
  await expect(page.getByRole('heading', { name: /You vs Rival/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Moonblast/i })).toBeVisible();
});
