import { applySpreadSuggestion, suggestSpread } from './spread-suggestion';
import type { TeamSet } from '../compat/team-store';
import { genFromFormat } from '../data/dex';

const dragapult: TeamSet = {
  species: 'Dragapult',
  item: 'choicespecs',
  ability: 'infiltrator',
  moves: ['Shadow Ball', 'Draco Meteor', 'Flamethrower', 'U-turn'],
};

it('keeps digit-led rulesets separate from their generation number', () => {
  expect(genFromFormat('gen91v1')).toBe(9);
  expect(genFromFormat('gen92v2doubles')).toBe(9);
  expect(genFromFormat('gen71v1')).toBe(7);
  expect(genFromFormat('gen10ou')).toBe(10);
  expect(genFromFormat('gen2ou')).toBe(2);
  expect(genFromFormat()).toBe(9);
});

it('infers a special Choice role from moves and canonicalizes packed IDs', async () => {
  const suggestion = await suggestSpread(dragapult, 'gen9ou');
  expect(suggestion).toMatchObject({
    available: true,
    role: 'Fast Specs',
    evs: { spa: 252, spe: 252 },
    nature: 'Timid',
  });
  if (!suggestion.available) throw new Error('Expected a spread');
  expect(Object.values(suggestion.evs).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(508);
  const current = {
    ...dragapult,
    name: 'Specialist',
    ivs: { atk: 0, spe: 17 },
    happiness: 0,
    teraType: 'Stellar',
    gender: 'F',
    shiny: true,
  };
  expect(applySpreadSuggestion(current, suggestion)).toMatchObject({
    name: 'Specialist',
    ivs: { atk: 0, spe: 17 },
    happiness: 0,
    teraType: 'Stellar',
    gender: 'F',
    shiny: true,
  });
  expect(current).not.toHaveProperty('evs');
});

it('distinguishes defensive, physical, and Trick Room roles instead of always maximizing speed', async () => {
  const defensive = await suggestSpread(
    {
      species: 'Blissey',
      item: 'Heavy-Duty Boots',
      ability: 'Natural Cure',
      moves: ['Soft-Boiled', 'Seismic Toss', 'Thunder Wave', 'Stealth Rock'],
    },
    'gen9ou',
  );
  expect(defensive).toMatchObject({ available: true, role: 'Physically Defensive', nature: 'Bold' });
  const physical = await suggestSpread(
    { species: 'Garchomp', item: 'Choice Band', moves: ['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang'] },
    'gen4ou',
  );
  expect(physical).toMatchObject({
    available: true,
    role: 'Fast Band',
    evs: { atk: 252, spe: 252 },
    nature: 'Jolly',
  });
  const slow = await suggestSpread(
    {
      species: 'Bronzong',
      item: 'Leftovers',
      moves: ['Trick Room', 'Gyro Ball', 'Earthquake', 'Stealth Rock'],
    },
    'gen4ou',
  );
  expect(slow).toMatchObject({ available: true, evs: { spe: 0 } });
  if (slow.available) expect(['Relaxed', 'Sassy', 'Brave', 'Quiet']).toContain(slow.nature);
});

it('handles early-generation stat experience and low-level rounding without applying a nature', async () => {
  const old = await suggestSpread(
    { species: 'Alakazam', moves: ['Psychic', 'Recover', 'Thunder Wave', 'Reflect'] },
    'gen1ou',
  );
  expect(old).toMatchObject({ available: true, evs: { hp: 252, def: 252, spa: 252, spe: 252, spd: 0 } });
  if (old.available) expect(old.nature).toBeUndefined();
  const low = await suggestSpread(
    { species: 'Abra', moves: ['Psychic', 'Shadow Ball', 'Energy Ball', 'Protect'], item: 'Focus Sash' },
    'gen7lc',
  );
  expect(low.available).toBe(true);
  if (low.available) {
    expect(low.evs.spe).toBeLessThan(252);
    expect(Object.values(low.evs).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(508);
  }
});

it('does not guess unknown data or unsupported stat systems and permits the Ditto exception', async () => {
  expect(await suggestSpread({ species: 'Pikachu', moves: ['Thunderbolt'] }, 'gen9ou')).toMatchObject({
    available: false,
    reason: expect.stringContaining('four moves'),
  });
  expect(
    await suggestSpread({ species: 'Pikachu', moves: ['Custom Attack'] }, 'gen9customgame'),
  ).toMatchObject({ available: false, reason: expect.stringContaining('unknown') });
  expect(await suggestSpread(dragapult, 'gen2ou')).toMatchObject({ available: false });
  expect(await suggestSpread(dragapult, 'gen7letsgoou')).toMatchObject({ available: false });
  expect(
    await suggestSpread({ species: 'Ditto', moves: ['Transform'], ability: 'Imposter' }, 'gen9ou'),
  ).toMatchObject({ available: true, role: 'Physically Defensive' });
});
