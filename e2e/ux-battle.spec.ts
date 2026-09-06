import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { installMockPs } from './mock-ps';

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function startBattle(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Unnamed guest', exact: true }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('CodexTester');
  await page.getByRole('button', { name: 'Use guest name', exact: true }).click();
  await expect(page.getByRole('button', { name: 'CodexTester', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Find battle', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Moonblast,/ })).toBeVisible();
}

test('move targeting keeps keyboard focus and has an explicit route back', async ({ page }) => {
  await startBattle(page);
  const move = page.getByRole('button', { name: /^Moonblast,/ });
  await move.focus();
  await page.keyboard.press('Enter');
  const target = page.locator('.target-button', { hasText: 'Great Tusk' });
  await expect(target).toBeFocused();
  const targetBox = await target.boundingBox();
  const regionBox = await page.getByLabel('Move targets', { exact: true }).boundingBox();
  expect(targetBox && regionBox && targetBox.width >= regionBox.width - 2).toBeTruthy();
  await page.getByRole('button', { name: 'Back to moves', exact: true }).click();
  await expect(move).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent.filter(command => command.includes('/choose')))).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(target).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Waiting for opponent', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Undo choice', exact: true })).toHaveText('Change choice');
});

test('spectator playback stays compact and preserves the battlefield', async ({ page }) => {
  await page.goto('/battle/battle-gen9uu-spectate1');
  const playback = page.getByLabel('Battle playback', { exact: true });
  await expect(playback).toBeVisible();
  const geometry = await page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    };
    return { width: innerWidth, playback: box('.battle-playback'), field: box('.battle-field'), dock: box('.decision-dock'), overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(geometry.playback.height).toBeLessThanOrEqual(geometry.width <= 560 ? 160 : 110);
  expect(geometry.field.height).toBeGreaterThan(geometry.playback.height);
  expect(geometry.field.bottom).toBeLessThanOrEqual(geometry.dock.top + 1);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
});

test('mobile inspector traps focus, supports tab keys and returns to its opener', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'The inspector is a modal sheet at mobile widths.');
  await startBattle(page);
  const opener = page.getByRole('button', { name: 'Open battle log', exact: true });
  await opener.click();
  const sheet = page.getByRole('dialog', { name: 'Battle inspector', exact: true });
  await expect(sheet).toBeVisible();
  const log = sheet.getByRole('tab', { name: 'Log', exact: true });
  await expect(log).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(sheet.getByRole('tab', { name: 'Chat', exact: true })).toBeFocused();
  await expect(sheet.getByRole('textbox', { name: 'Message battle', exact: true })).toBeVisible();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    expect(await sheet.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await sheet.getByRole('button', { name: 'Forfeit', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Forfeit battle?', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Forfeit', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
});

test('mobile inspection returns focus and the timer and switch names stay readable', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Touch affordances are exposed on coarse pointers.');
  await startBattle(page);
  const inspect = page.getByRole('button', { name: 'Inspect Moonblast', exact: true });
  await inspect.click();
  await expect(page.getByRole('dialog', { name: 'Moonblast', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await expect(inspect).toBeFocused();
  await expect(page.locator('.bench-body strong', { hasText: 'Heatran' })).toBeVisible();
  const roster = await page.locator('.field-hud').first().locator('.roster-pips').evaluate(element => {
    const parent = element.parentElement!.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    return { right: bounds.right, parentRight: parent.right, pips: Array.from(element.children).map(pip => ({ width: pip.getBoundingClientRect().width, height: pip.getBoundingClientRect().height })) };
  });
  expect(roster.pips).toHaveLength(6);
  expect(roster.pips.every(pip => pip.width >= 6 && Math.abs(pip.width - pip.height) < 1)).toBe(true);
  expect(roster.right).toBeLessThanOrEqual(roster.parentRight);
  await page.evaluate(() => {
    const socket = (window as unknown as { __mockPsSockets: Array<{ emit: (value: string) => void }> }).__mockPsSockets[0];
    socket.emit('>battle-gen9ou-1\n|inactive|Time left: 25 sec this turn | 150 sec total');
  });
  await expect(page.getByRole('timer')).toBeVisible();
});

test('a full mobile move and team selection stays readable and reachable', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Exercises the compact decision layout.');
  await startBattle(page);
  await page.evaluate(() => {
    const socket = (window as unknown as { __mockPsSockets: Array<{ emit: (value: string) => void }> }).__mockPsSockets[0];
    const pokemon = ['Iron Valiant', 'Heatran', 'Dragapult', 'Kingambit', 'Samurott-Hisui', 'Gholdengo'].map((name, index) => ({
      ident: `p1: ${name}`, details: `${name}, L80`, condition: '200/200', active: index === 0, moves: ['moonblast', 'closecombat', 'psyshock', 'shadowball'],
    }));
    const request = { rqid: 8, side: { id: 'p1', name: 'CodexTester', pokemon }, active: [{
      moves: ['Moonblast', 'Close Combat', 'Psyshock', 'Shadow Ball'].map(move => ({ move, pp: 10, maxpp: 16, target: 'normal' })), canTerastallize: 'Fairy',
    }] };
    socket.emit(`>battle-gen9ou-1\n|request|${JSON.stringify(request)}`);
  });
  await expect(page.locator('.move-choice')).toHaveCount(4);
  const first = await page.locator('.move-choice').nth(0).boundingBox();
  const second = await page.locator('.move-choice').nth(1).boundingBox();
  const third = await page.locator('.move-choice').nth(2).boundingBox();
  expect(first && second && third && Math.abs(first.y - second.y) < 1 && third.y > first.y).toBeTruthy();
  const lastSwitch = page.getByRole('group', { name: 'Team bench', exact: true }).getByRole('button', { name: /^Gholdengo,/ });
  await lastSwitch.scrollIntoViewIfNeeded();
  await expect(lastSwitch.locator('strong')).toBeVisible();
  await lastSwitch.click();
  expect(await page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent.filter(command => command.includes('/choose')))).toEqual(['battle-gen9ou-1|/choose switch 6|8']);
});
