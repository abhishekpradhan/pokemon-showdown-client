import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { installMockPs } from './mock-ps';

const room = 'battle-gen9multi-invite';
const emit = (page: Page, frame: string) => page.evaluate(frame => (window as unknown as { __mockPsSockets: Array<{ emit: (value: string) => void }> }).__mockPsSockets[0].emit(frame), frame);
const sent = (page: Page) => page.evaluate(() => (window as unknown as { __mockPsSent: string[] }).__mockPsSent);
const forms = (invited = false) => '<form><label>Player 1: <strong>CodexTester</strong></label></form><form><label>Player 2: <strong>Rival</strong></label></form>' +
  (invited ? `<form data-submitsend="/msgroom ${room},/uninvitebattle rosa"><label>Player 3: <strong>rosa</strong> (invited) <button type="submit">Uninvite</button></label></form>` : `<form data-submitsend="/msgroom ${room},/invitebattle {username}, p3"><label>Player 3: <input name="username" class="textbox" placeholder="Username" /></label> <button class="button" type="submit">Add Player</button></form>`) +
  `<form data-submitsend="/msgroom ${room},/invitebattle {username}, p4"><label>Player 4: <input name="username" class="textbox" placeholder="Username" /></label> <button class="button" type="submit">Add Player</button></form>`;

test.beforeEach(async ({ page }) => {
  await installMockPs(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await expect(page.getByText('Online', { exact: true })).toBeVisible();
  await emit(page, '|updateuser|CodexTester|1|0');
});

test('a supplied-team invitation joins the fourth seat and permits its own battle choice', async ({ page }) => {
  await emit(page, "|pm|+ArenaAlice| CodexTester|/challenge gen9freeforall||You're invited to join a battle (with ArenaAlice, Bob, Cora)||");
  await expect(page.locator('.challenge-row')).toContainText('invited to join a battle');
  await page.locator('.challenge-row').getByRole('button', { name: 'Accept', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Challenge team')).toHaveCount(0);
  await expect(dialog).toContainText('This seat already has a team');
  await dialog.getByRole('button', { name: 'Join battle', exact: true }).click();
  expect((await sent(page)).filter(line => /\/accept|\/utm/.test(line))).toEqual(['|/accept arenaalice']);
  await emit(page, '|pm|+ArenaAlice| CodexTester|/challenge');
  const request = { rqid: 5, side: { id: 'p4', name: 'CodexTester', pokemon: [{ ident: 'p4: Squirtle', details: 'Squirtle', condition: '180/200', active: true, moves: ['tackle'], item: '', ability: '' }] }, active: [{ moves: [{ move: 'Tackle', target: 'normal', pp: 20, maxpp: 35 }] }] };
  await emit(page, `>${room}\n|init|battle\n|gametype|freeforall\n|gen|9\n|player|p1|ArenaAlice\n|player|p2|Bob\n|player|p3|Cora\n|player|p4|CodexTester\n|start\n|switch|p1a: Pikachu|Pikachu|100/100\n|switch|p2a: Eevee|Eevee|100/100\n|switch|p3b: Charmander|Charmander|100/100\n|switch|p4b: Squirtle|Squirtle|100/100\n|turn|1\n|request|${JSON.stringify(request)}`);
  await expect(page).toHaveURL(new RegExp(`/battle/${room}$`));
  await expect(page.getByRole('heading', { name: 'Choose Squirtle’s action', exact: true })).toBeVisible();
  await page.locator('.move-choice').click();
  await page.locator('.target-button').filter({ hasText: 'Eevee' }).click();
  expect(await sent(page)).toContain(`${room}|/choose move 1 -1|5`);
});

test('invitation metadata requests a team and preserves a custom decline action', async ({ page }) => {
  await emit(page, "|pm| ArenaAlice| CodexTester|/challenge gen9freeforall|gen9freeforall|You're invited to join a battle (with Alice, Bob)|Review seat|Decline invite");
  await page.locator('.challenge-row').getByRole('button', { name: 'Review seat', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Challenge team')).toBeVisible();
  await dialog.getByLabel('Challenge team').selectOption('');
  await dialog.getByRole('button', { name: 'Review seat', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect((await sent(page)).some(line => line.includes('/accept'))).toBe(false);
  await dialog.getByRole('button', { name: 'Decline invite', exact: true }).click();
  expect(await sent(page)).toContain('|/reject arenaalice');
  await expect(page.locator('.challenge-row')).toHaveCount(0);
});

test('hosts invite both remaining seats, revoke an invitation and reach the started battle', async ({ page }, info) => {
  const unexpectedResources: string[] = [];
  await page.route('https://invitation-resource.invalid/**', route => { unexpectedResources.push(route.request().url()); return route.abort(); });
  await emit(page, `>${room}\n|init|battle\n|gametype|multi\n|gen|9\n|player|p1|CodexTester\n|player|p2|Rival\n|uhtmlchange|invites|<img src="https://invitation-resource.invalid/track"><iframe src="https://invitation-resource.invalid/embed"></iframe>${forms()}`);
  const invitations = page.getByRole('region', { name: 'Battle invitations' });
  await expect(page.getByRole('heading', { name: 'Waiting for players', exact: true })).toBeVisible();
  await invitations.getByLabel('Player for seat p3').fill('Rosa');
  await invitations.getByRole('button', { name: 'Invite to p3', exact: true }).click();
  expect(await sent(page)).toContain(`${room}|/invitebattle rosa, p3`);
  await emit(page, `>${room}\n|uhtmlchange|invites|${forms(true)}`);
  await invitations.getByLabel('Player for seat p4').fill('Barry');
  await page.screenshot({ path: info.outputPath('host-invitations.png'), fullPage: true });
  await invitations.getByRole('button', { name: 'Invite to p4', exact: true }).click();
  expect(await sent(page)).toContain(`${room}|/invitebattle barry, p4`);
  await invitations.getByRole('button', { name: 'Uninvite rosa', exact: true }).click();
  expect(await sent(page)).toContain(`${room}|/uninvitebattle rosa`);
  await emit(page, '|pm| CodexTester| Rosa|/challenge');
  await expect(invitations.getByLabel('Player for seat p3')).toBeVisible();
  await emit(page, `>${room}\n|player|p3|Rosa\n|player|p4|Barry\n|start`);
  await expect(invitations).toHaveCount(0);
  expect(unexpectedResources).toEqual([]);
});
