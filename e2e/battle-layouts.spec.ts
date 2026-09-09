import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { installMockPs } from './mock-ps';

const room = 'battle-layout-test';
const names = ['Pikachu', 'Bulbasaur', 'Charmander', 'Squirtle'];
const moves = [
  { move: 'Tackle', target: 'normal', pp: 20, maxpp: 35 },
  { move: 'Protect', target: 'self', pp: 10, maxpp: 16 },
];
const side = (index: number, activeNames = [names[index]], bench = ['Eevee']) => ({
  id: `p${index + 1}`,
  name: `Player${index + 1}`,
  pokemon: [...activeNames, ...bench].map((name, slot) => ({
    ident: `p${index + 1}: ${name}`,
    details: name,
    condition: '180/200',
    active: slot < activeNames.length,
    moves: ['tackle', 'protect'],
    item: '',
    ability: '',
  })),
});
const emit = (page: Page, lines: string) =>
  page.evaluate(
    ({ room, lines }) => {
      const socket = (window as unknown as { __mockPsSockets: Array<{ emit: (value: string) => void }> })
        .__mockPsSockets[0];
      socket.emit(`>${room}\n${lines}`);
    },
    { room, lines },
  );
const sentChoices = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __mockPsSent: string[] }).__mockPsSent.filter(command =>
      command.includes('/choose'),
    ),
  );
async function expectFieldContained(page: Page) {
  const geometry = await page.locator('.battle-field.is-expanded').evaluate(field => {
    const box = field.getBoundingClientRect();
    const dock = document.querySelector('.decision-dock')!.getBoundingClientRect();
    return {
      fieldBottom: box.bottom,
      dockTop: dock.top,
      cards: [...field.querySelectorAll('.combatant-nameplate, .combatant-sprite')].map(card => {
        const bounds = card.getBoundingClientRect();
        return (
          bounds.top >= box.top &&
          bounds.bottom <= box.bottom + 1 &&
          bounds.left >= box.left &&
          bounds.right <= box.right + 1
        );
      }),
    };
  });
  expect(geometry.fieldBottom).toBeLessThanOrEqual(geometry.dockTop + 1);
  expect(geometry.cards.every(Boolean)).toBe(true);
}
async function open(page: Page, lines: string) {
  await page.goto(`/battle/${room}`);
  await page.waitForFunction(
    () =>
      (window as unknown as { __mockPsSockets: Array<{ readyState: number }> }).__mockPsSockets?.[0]
        ?.readyState === 1,
  );
  await emit(page, `|init|battle\n|title|Layout verification\n${lines}`);
  await expect(page.locator('.battle-field.is-expanded')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installMockPs(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const gameType of ['multi', 'freeforall'])
  for (const seat of [0, 1, 2, 3]) {
    test(`${gameType} seat p${seat + 1} owns one roster and targets the correct signed locations`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const request = {
        rqid: 1,
        side: side(seat),
        ally: gameType === 'multi' ? side(seat ^ 2) : undefined,
        active: [{ moves }],
      };
      await open(
        page,
        [
          '|gen|9',
          `|gametype|${gameType}`,
          ...names.map((_, index) => `|player|p${index + 1}|Player${index + 1}|1|1200`),
          ...names.map((_, index) => `|teamsize|p${index + 1}|6`),
          '|start',
          ...names.map(
            (name, index) => `|switch|p${index + 1}${index < 2 ? 'a' : 'b'}: ${name}|${name}|100/100`,
          ),
          '|turn|1',
          `|request|${JSON.stringify(request)}`,
        ].join('\n'),
      );
      await expect(page.locator('.layout-side')).toHaveCount(4);
      await expect(page.locator('.combatant-nameplate')).toHaveCount(4);
      await expectFieldContained(page);
      await expect(
        page.getByRole('heading', { name: `Choose ${names[seat]}’s action`, exact: true }),
      ).toBeVisible();
      await page.locator('.move-choice').filter({ hasText: 'Tackle' }).click();
      await expect(page.locator('.target-button')).toHaveCount(3);
      const partner = page.locator('.target-button').filter({ hasText: names[seat ^ 2] });
      await expect(partner).toContainText(gameType === 'multi' ? 'Partner' : 'Opponent');
      if (seat === 2)
        await page.screenshot({ path: info.outputPath(`${gameType}-p3-targets.png`), fullPage: true });
      await partner.click();
      expect(await sentChoices(page)).toEqual([`${room}|/choose move 1 -${seat < 2 ? 2 : 1}|1`]);
      await emit(
        page,
        `|request|${JSON.stringify({ rqid: 2, forceSwitch: [true], side: side(seat), ally: request.ally })}`,
      );
      await page
        .getByRole('group', { name: 'Team bench', exact: true })
        .getByRole('button', { name: /^Eevee,/ })
        .click();
      expect(await sentChoices(page)).toEqual([
        `${room}|/choose move 1 -${seat < 2 ? 2 : 1}|1`,
        `${room}|/choose switch 2|2`,
      ]);
      expect(errors).toEqual([]);
    });
  }

test('triples shows six positions and completes edge shift, center move and adjacent target choices', async ({
  page,
}, info) => {
  const own = ['Pikachu', 'Eevee', 'Charmander'];
  const foes = ['Raichu', 'Snorlax', 'Charmeleon'];
  await open(
    page,
    [
      '|gen|6',
      '|gametype|triples',
      '|player|p1|Player1',
      '|player|p2|Player2',
      '|start',
      ...own.flatMap((name, index) => [
        `|switch|p1${String.fromCharCode(97 + index)}: ${name}|${name}|100/100`,
        `|switch|p2${String.fromCharCode(97 + index)}: ${foes[index]}|${foes[index]}|100/100`,
      ]),
      '|turn|1',
      `|request|${JSON.stringify({ rqid: 1, side: side(0, own, ['Bulbasaur', 'Squirtle', 'Gastly']), active: own.map(() => ({ moves })) })}`,
    ].join('\n'),
  );
  await expect(page.locator('.combatant-nameplate')).toHaveCount(6);
  await expectFieldContained(page);
  await page.locator('.move-choice').filter({ hasText: 'Tackle' }).click();
  await expect(page.locator('.target-button').filter({ hasText: 'Raichu' })).toHaveCount(0);
  await expect(page.locator('.target-button')).toHaveCount(3);
  await page.getByRole('button', { name: 'Restart turn', exact: true }).click();
  await page.getByRole('button', { name: 'Shift to center', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose Eevee’s action', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shift to center', exact: true })).toHaveCount(0);
  await page.locator('.move-choice').filter({ hasText: 'Protect' }).click();
  expect(await sentChoices(page)).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Choose Charmander’s action', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('triples-controls.png'), fullPage: true });
  await page.locator('.move-choice').filter({ hasText: 'Tackle' }).click();
  await page.locator('.target-button').filter({ hasText: 'Raichu' }).click();
  expect(await sentChoices(page)).toEqual([`${room}|/choose shift, move 2, move 1 +1|1`]);
});

test('four-seat spectators can inspect every owner and cycle all viewpoints', async ({ page }) => {
  await open(
    page,
    [
      '|gen|9',
      '|gametype|freeforall',
      ...names.map((_, index) => `|player|p${index + 1}|Player${index + 1}|1|1200`),
      '|start',
      ...names.map((name, index) => `|switch|p${index + 1}${index < 2 ? 'a' : 'b'}: ${name}|${name}|100/100`),
      '|turn|1',
    ].join('\n'),
  );
  await expect(page.locator('.move-choice')).toHaveCount(0);
  for (let index = 0; index < 4; index++) {
    await expect(page.locator(`.layout-side[data-owner="p${index + 1}"] .layout-owner`)).toContainText(
      'Viewpoint',
    );
    await page.getByRole('button', { name: 'Switch viewpoint', exact: true }).click();
  }
  expect(await sentChoices(page)).toEqual([]);
});

for (const gameType of ['triples', 'multi', 'freeforall']) {
  test(`${gameType} previews each owner’s roster and confirms only the selected team order`, async ({
    page,
  }) => {
    const four = gameType !== 'triples';
    const seat = four ? 2 : 0;
    const team = ['Pikachu', 'Eevee', 'Charmander', 'Bulbasaur', 'Squirtle', 'Gastly'];
    const owners = Array.from({ length: four ? 4 : 2 }, (_, index) => index);
    await open(
      page,
      [
        '|gen|9',
        `|gametype|${gameType}`,
        ...owners.map(index => `|player|p${index + 1}|Player${index + 1}`),
        ...owners.flatMap(index => [
          `|teamsize|p${index + 1}|6`,
          ...team.map(name => `|poke|p${index + 1}|${name}|`),
        ]),
        '|teampreview',
        `|request|${JSON.stringify({ rqid: 3, teamPreview: true, chosenTeamSize: 3, side: side(seat, [], team) })}`,
      ].join('\n'),
    );
    await expect(page.locator('.layout-preview')).toHaveCount(owners.length);
    await expect(page.locator('.layout-preview-pokemon')).toHaveCount(owners.length * 6);
    const selection = page.getByRole('group', { name: 'Team preview selection', exact: true });
    for (const name of ['Bulbasaur', 'Eevee', 'Pikachu'])
      await selection.getByRole('button', { name: new RegExp(`^${name},`) }).click();
    expect(await sentChoices(page)).toEqual([]);
    await page.getByRole('button', { name: 'Move selection 1 later', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm team order', exact: true }).click();
    expect(await sentChoices(page)).toEqual([`${room}|/choose team 2, 4, 1|3`]);
  });
}

test('a triples edge can choose an empty adjacent location when the only surviving foe is out of reach', async ({
  page,
}) => {
  const own = side(0, ['Pikachu', 'Eevee', 'Charmander'], []);
  own.pokemon[1].condition = '0 fnt';
  own.pokemon[2].condition = '0 fnt';
  await open(
    page,
    [
      '|gen|6',
      '|gametype|triples',
      '|player|p1|Player1',
      '|player|p2|Player2',
      '|start',
      '|switch|p1a: Pikachu|Pikachu|100/100',
      '|switch|p2a: Raichu|Raichu|100/100',
      '|turn|1',
      `|request|${JSON.stringify({ rqid: 4, side: own, active: [{ moves }, null, null] })}`,
    ].join('\n'),
  );
  await page.locator('.move-choice').filter({ hasText: 'Tackle' }).click();
  const empty = page.locator('.target-button').filter({ hasText: 'Empty position 3' });
  await expect(empty).toBeEnabled();
  await empty.click();
  expect(await sentChoices(page)).toEqual([`${room}|/choose move 1 +3, pass, pass|4`]);
});
