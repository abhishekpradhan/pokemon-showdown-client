import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { installMockPs } from './mock-ps';

const roomId = 'battle-gen9ou-1';
const emit = async (page: Page, lines: string, id = roomId) => page.evaluate(({ text, room }) => {
  const socket = (window as unknown as { __mockPsSockets: Array<{ emit: (data: string) => void }> }).__mockPsSockets[0];
  socket.emit(`>${room}\n${text}`);
}, { text: lines, room: id });
const choices = async (page: Page) => page.evaluate(() =>
  (window as unknown as { __mockPsSent: string[] }).__mockPsSent.filter(command => command.includes('/choose')));

test.beforeEach(async ({ page }) => { await installMockPs(page); });

async function startBattle(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Unnamed guest/i }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: /Use guest name/i }).click();
  await expect(page.getByRole('button', { name: 'CodexTester', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /find battle/i }).click();
  await expect(page).toHaveURL(new RegExp(`/battle/${roomId}`));
  await expect(page.locator('.move-choice', { hasText: 'Moonblast' })).toBeVisible();
}

test('request submission locks controls, rejection repairs them and undo awaits the server', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await startBattle(page);
  await page.locator('.move-choice', { hasText: 'Moonblast' }).click();
  await page.locator('.target-button', { hasText: 'Great Tusk' }).click();
  await expect(page.locator('.move-choice')).toHaveCount(0);
  expect(await choices(page)).toEqual([`${roomId}|/choose move 1 +1|7`]);
  await emit(page, '|error|[Invalid choice] The move is unavailable.');
  await expect(page.locator('.move-choice', { hasText: 'Moonblast' })).toBeEnabled();
  await page.locator('.move-choice', { hasText: 'Moonblast' }).click();
  await page.locator('.target-button', { hasText: 'Great Tusk' }).click();
  await page.getByRole('button', { name: 'Undo choice', exact: true }).click();
  await expect(page.getByText('Waiting for cancellation', { exact: true })).toBeVisible();
  await expect(page.locator('.move-choice')).toHaveCount(0);
  await emit(page, '|sentchoice|');
  await expect(page.locator('.move-choice', { hasText: 'Moonblast' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('team preview accepts the first slot, toggles and reorders before explicit confirmation', async ({ page }) => {
  await startBattle(page);
  const side = { id: 'p1', name: 'CodexTester', pokemon: ['Iron Valiant', 'Heatran', 'Dragapult'].map((name, i) => ({
    ident: `p1: ${name}`, details: `${name}, L80`, condition: '200/200', active: i === 0, moves: ['tackle'], ability: '', item: '',
  })) };
  await emit(page, `|teampreview|2\n|request|${JSON.stringify({ rqid: 8, teamPreview: true, side })}`);
  const preview = page.getByRole('group', { name: 'Team preview selection' });
  await preview.getByRole('button', { name: /^Iron Valiant,/ }).click();
  await preview.getByRole('button', { name: /^Heatran,/ }).click();
  await expect(page.getByRole('button', { name: 'Confirm team order' })).toBeEnabled();
  expect(await choices(page)).toEqual([]);
  await page.getByRole('button', { name: 'Move selection 2 earlier' }).click();
  await expect(page.getByLabel('Selected team order').locator('li').first()).toContainText('Heatran');
  await page.getByRole('button', { name: 'Confirm team order' }).click();
  expect(await choices(page)).toEqual([`${roomId}|/choose team 2, 1|8`]);
});

test('spectators can pause history, seek turns and change viewpoint', async ({ page }) => {
  await page.goto('/battle/battle-gen9uu-spectate1');
  await expect(page.getByLabel('Battle field')).toContainText('Krookodile');
  await expect(page.getByLabel('Battle playback')).toBeVisible();
  await page.getByRole('button', { name: 'Previous turn', exact: true }).click();
  await expect(page.locator('.field-turn')).toContainText('1');
  await page.getByRole('button', { name: 'Switch viewpoint', exact: true }).click();
  await expect(page.locator('.combatant-near .nameplate-name')).toHaveText('Reuniclus');
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(page.locator('.field-turn')).toContainText('2');
  await expect(page.locator('.move-choice')).toHaveCount(0);
});

test('mobile touch inspection is independent of submitting a move', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Touch inspection is exposed on coarse pointers.');
  await startBattle(page);
  await page.getByRole('button', { name: 'Inspect Moonblast', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Base accuracy');
  expect(await choices(page)).toEqual([]);
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(page.locator('.move-choice', { hasText: 'Moonblast' })).toBeEnabled();
  const far = await page.locator('.combatant-far .combatant-sprite').boundingBox();
  const near = await page.locator('.combatant-near .combatant-sprite').boundingBox();
  expect(far && near && far.y + far.height <= near.y + 1).toBeTruthy();
  const field = await page.getByLabel('Battle field').boundingBox();
  const nearHealth = await page.locator('.combatant-near .combatant-nameplate').boundingBox();
  const dock = await page.getByLabel('Battle action deck').boundingBox();
  expect(field && dock && field.y + field.height <= dock.y + 1).toBeTruthy();
  expect(field && near && nearHealth && Math.max(near.y + near.height, nearHealth.y + nearHealth.height) <= field.y + field.height).toBeTruthy();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
