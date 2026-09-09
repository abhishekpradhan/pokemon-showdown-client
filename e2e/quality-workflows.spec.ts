import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { installMockPs } from './mock-ps';

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
});
const emit = async (page: Page, raw: string) => {
  await page.waitForFunction(
    () => (window as unknown as { __mockPsSockets?: unknown[] }).__mockPsSockets?.length,
  );
  return page.evaluate(line => {
    (
      window as unknown as { __mockPsSockets: Array<{ emit: (text: string) => void }> }
    ).__mockPsSockets[0].emit(line);
  }, raw);
};

test('private-message links restore drafts and incoming messages reopen closed sessions', async ({
  page,
}) => {
  await page.goto('/room/pm-bob');
  await expect(page.getByRole('heading', { name: 'bob', exact: true })).toBeVisible();
  const message = page.getByRole('textbox', { name: 'Message bob', exact: true });
  await message.fill('A draft worth keeping');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(message).toHaveValue('A draft worth keeping');
  await expect(page.getByText('Message was not sent. Your draft is kept here.')).toBeVisible();
  await page.reload();
  await expect(message).toHaveValue('A draft worth keeping');
  await page.getByRole('button', { name: 'Close bob', exact: true }).click();
  await emit(page, '|pm| Bob| Guest 1000|A new message');
  await expect(page.getByRole('button', { name: /bob 1/i })).toBeVisible();
});

test('chat keeps the reading position while new traffic arrives and opens safe room links', async ({
  page,
}) => {
  await page.goto('/room/lobby');
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await emit(
    page,
    `>lobby\n${Array.from({ length: 220 }, (_, index) => `|c|Reader|History line ${index}`).join('\n')}`,
  );
  const feed = page.locator('.room-surface-feed');
  await feed.evaluate(el => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });
  await emit(page, '>lobby\n|c|Reader|The new message');
  await expect(page.getByRole('button', { name: 'New messages · Jump to latest' })).toBeVisible();
  expect(await feed.evaluate(el => el.scrollTop)).toBeLessThan(50);
  await page.getByRole('button', { name: 'New messages · Jump to latest' }).click();
  await expect(page.getByText('The new message', { exact: true })).toBeVisible();
  await emit(page, '>lobby\n|raw|<a data-href="/pm-bob">Open Bob conversation</a>');
  await page.getByText('Open Bob conversation', { exact: true }).click();
  await expect(page).toHaveURL(/\/room\/pm-bob/);
});

test('failed room joins offer a terminal explanation and retry', async ({ page }) => {
  await page.goto('/room/private-room');
  await expect(page.getByRole('heading', { name: 'Joining private-room' })).toBeVisible();
  await emit(page, '>private-room\n|noinit|joinfailed|This room is private.');
  await expect(page.getByRole('heading', { name: 'Unable to open this room' })).toBeVisible();
  await expect(page.getByText('This room is private.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});

test('tournament waiting lists cannot be accepted as incoming challenges', async ({ page }) => {
  await page.goto('/room/lobby');
  await emit(
    page,
    '>lobby\n|tournament|update|{"isStarted":true,"isJoined":true,"challengeBys":["Bob"],"challenges":[]}',
  );
  await expect(page.getByText('Waiting for Bob to challenge you.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept Bob' })).toHaveCount(0);
  await emit(page, '>lobby\n|tournament|update|{"challenged":"Bob"}');
  await expect(page.getByRole('button', { name: 'Accept Bob' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Tournament team' })).toBeVisible();
});

test('a notification opens a challenge dialog with explicit format and team context', async ({ page }) => {
  await page.goto('/');
  await emit(page, '|pm| Bob| Guest 1000|/challenge gen9ou|gen9ou|');
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await page.locator('.notification-popover').getByRole('button', { name: 'Accept', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Accept challenge · Bob' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Challenge team' })).toBeVisible();
  await expect(dialog).toContainText('[Gen 9] OU');
});

test('battle directory and privacy settings remain usable at narrow widths', async ({ page }) => {
  await page.goto('/battles');
  await expect(page.getByRole('heading', { name: 'Live battles', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Filter live battles' }).fill('ArenaTester');
  await expect(page.getByRole('button', { name: /ArenaTester vs MockRival/ })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('switch', { name: 'Block incoming private messages' }).click();
  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Block incoming private messages' })).toBeChecked();
});
