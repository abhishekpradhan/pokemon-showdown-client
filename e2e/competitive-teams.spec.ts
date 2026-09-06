import { expect, test } from './fixtures';
import { installMockPs } from './mock-ps';
import AxeBuilder from '@axe-core/playwright';

// Small excerpts of the public gen9ou dataset: analysis and usage stay distinct.
const samples = {
  dex: { Dragapult: { 'Boots Pivot': {
    moves: ['Dragon Darts', 'Hex', 'Will-O-Wisp', 'U-turn'], ability: 'Infiltrator', item: 'Heavy-Duty Boots', nature: 'Naive', teraType: 'Ghost', evs: { atk: 4, spa: 252, spe: 252 },
  } } },
  stats: { Dragapult: { 'Showdown Usage': {
    moves: ['Draco Meteor', 'Shadow Ball', 'Flamethrower', 'U-turn'], ability: 'Infiltrator', item: 'Choice Specs', nature: 'Timid', evs: { spa: 252, spd: 4, spe: 252 },
  } } },
};

test.beforeEach(async ({ page }) => { await installMockPs(page); });

test('sample sets preview, undo and save without losing personal or later manual edits', async ({ page }) => {
  let requests = 0;
  await page.route('https://play.pokemonshowdown.com/data/sets/gen9ou.json', async route => {
    requests++;
    await route.fulfill({ json: samples });
  });
  await page.goto('/teambuilder');
  await page.getByRole('button', { name: 'Edit Dragapult', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Species', exact: true })).toBeVisible();
  expect(requests).toBe(0);
  await page.getByLabel('Nickname', { exact: true }).fill('Night watch');
  await page.getByText('IVs and calculated stats', { exact: true }).click();
  await page.getByRole('button', { name: 'Minimum Attack', exact: true }).click();
  await page.getByText('Set details', { exact: true }).click();
  await page.getByLabel('Gender', { exact: true }).selectOption('F');
  await page.getByLabel('Happiness', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Browse sample sets', exact: true }).click();
  await expect(page.getByLabel('Sample set preview')).toContainText('Heavy-Duty Boots');
  await expect(page.getByRole('button', { name: 'Held item', exact: true })).toContainText('Choice Specs');
  await expect(page.getByLabel('Sample set preview')).toContainText('Night watch');
  await page.getByRole('button', { name: 'Sample set', exact: true }).click();
  await expect(page.getByRole('option', { name: /Showdown Usage/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Apply sample set', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move 1', exact: true })).toContainText('Dragon Darts');
  await page.getByRole('button', { name: 'Undo sample set', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move 1', exact: true })).toContainText('Shadow Ball');
  await page.getByRole('button', { name: 'Apply sample set', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'SpA EV', exact: true }).fill('244');
  await expect(page.getByRole('button', { name: 'Undo sample set', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save team', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save team', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Edit Dragapult', exact: true }).click();
  await expect(page.getByLabel('Nickname', { exact: true })).toHaveValue('Night watch');
  await expect(page.getByRole('button', { name: 'Held item', exact: true })).toContainText('Heavy-Duty Boots');
  await expect(page.getByRole('spinbutton', { name: 'SpA EV', exact: true })).toHaveValue('244');
  await page.getByText('IVs and calculated stats', { exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Atk IV', exact: true })).toHaveValue('0');
  await page.getByText('Set details', { exact: true }).click();
  await expect(page.getByLabel('Gender', { exact: true })).toHaveValue('F');
  await expect(page.getByLabel('Happiness', { exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Browse sample sets', exact: true }).click();
  await expect(page.getByLabel('Sample set preview')).toBeVisible();
  for (const theme of ['dark', 'light']) {
    await page.evaluate(async value => {
      document.documentElement.dataset.theme = value;
      // Assess the settled theme, after finite color transitions finish.
      await Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished));
    }, theme);
    const accessibility = await new AxeBuilder({ page }).include('.team-editor-panel').analyze();
    expect(accessibility.violations).toEqual([]);
  }
  await page.evaluate(async () => {
    document.documentElement.dataset.theme = 'dark';
    await Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished));
  });
  await page.getByRole('button', { name: 'Apply sample set', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('sample-set-editor.png'), fullPage: true });
});

test('sample fetch errors retry and inferred spreads remain explicit and reversible', async ({ page }) => {
  let unavailable = true;
  await page.route('https://play.pokemonshowdown.com/data/sets/gen9ou.json', route => route.fulfill(unavailable ? { status: 503, body: 'Unavailable' } : { json: samples }));
  await page.goto('/teambuilder');
  await page.getByRole('button', { name: 'Edit Dragapult', exact: true }).click();
  await page.getByRole('button', { name: 'Browse sample sets', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  unavailable = false;
  await page.getByRole('button', { name: 'Retry sample sets', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply sample set', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close sample sets', exact: true }).click();
  const hp = page.getByRole('spinbutton', { name: 'HP EV', exact: true });
  await hp.fill('100');
  const inferred = page.getByRole('region', { name: 'Inferred EV spread' });
  await expect(inferred).toContainText('Fast Specs');
  await expect(hp).toHaveValue('100');
  await page.getByRole('button', { name: 'Apply suggested spread', exact: true }).click();
  await expect(hp).toHaveValue('4');
  await page.getByRole('button', { name: 'Undo suggested spread', exact: true }).click();
  await expect(hp).toHaveValue('100');
  await page.getByRole('button', { name: 'Apply suggested spread', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'SpA EV', exact: true }).fill('240');
  await expect(page.getByRole('button', { name: 'Undo suggested spread', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Iron Valiant', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo suggested spread', exact: true })).toHaveCount(0);
});
