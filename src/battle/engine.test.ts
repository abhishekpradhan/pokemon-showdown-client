import { Dex } from '@pkmn/dex';
import { Generations, ID } from '@pkmn/data';
import { Battle } from '@pkmn/client';
import singlesLog from '../compat/__fixtures__/gen9ou-singles.log?raw';
import doublesLog from '../compat/__fixtures__/gen9-doubles.log?raw';
import playerLog from '../compat/__fixtures__/player-gen9ou.log?raw';

/**
 * Started life as the Phase 2 spike; stays as the engine's fixture coverage.
 *
 * Feeds the same transcripts as battle-log-fixtures.test.ts through
 * @pkmn/client and asserts the facts our UI depends on. Where the two suites
 * disagree, the engine is the one that is right — that is the point of the
 * swap.
 */

const gens = new Generations(Dex);

const run = (log: string, player?: string) => {
  const battle = new Battle(gens, (player as ID) ?? null);
  // Every line goes through add(), |request| included — the engine's own
  // handler processes requests. Calling update() manually double-reconciles
  // the team and duplicates it.
  for (const line of log.split(/\r?\n/)) {
    if (line) battle.add(line);
  }
  return battle;
};

describe('@pkmn/client engine over fixtures', () => {
  it('replays a real singles battle to completion', () => {
    const battle = run(singlesLog);
    expect(battle.turn).toBeGreaterThan(10);
    expect(battle.p1.name).toBe('Jogarame');
    expect(battle.p2.name).toBe('Imcool5335');
    // Spectator perspective: HP is percentage-normalized on both sides.
    for (const side of [battle.p1, battle.p2]) {
      for (const pokemon of side.team) {
        expect(pokemon.maxhp === 100 || pokemon.maxhp === 48 || pokemon.fainted).toBe(true);
      }
    }
  });

  it('tracks doubles positions natively', () => {
    const battle = run(doublesLog);
    // Two active slots per side — the thing the hand-rolled adapter never had.
    expect(battle.p1.active.length).toBe(2);
    expect(battle.p2.active.length).toBe(2);
    expect(battle.gameType).toBe('doubles');
  });

  it('maintains player-perspective battle state', () => {
    const battle = run(playerLog, 'arenatester');
    expect(battle.turn).toBe(7);

    // Exact HP survives for the request side.
    const kingambit = battle.p1.team.find(p => p.speciesForme === 'Kingambit');
    expect(kingambit?.maxhp).toBe(334);
    expect(kingambit?.hp).toBe(293);

    // Status tracked through the log, not wiped by request rebuilds —
    // the engine has no such failure mode by construction.
    const garchomp = battle.p1.team.find(p => p.speciesForme === 'Garchomp');
    expect(garchomp?.status).toBe('brn');
    // Garchomp was Whirlwind-dragged out after Swords Dance: stat stages do
    // not survive leaving the field, and the engine gets that right without
    // us hand-writing the rule.
    expect(garchomp?.boosts.atk).toBeUndefined();

    // Hazards live on sides.
    expect(Object.keys(battle.p1.sideConditions)).toContain('spikes');

    // Tera shows while the Pokémon is on the field...
    const midBattle = run(playerLog.slice(0, playerLog.indexOf('|turn|6')), 'arenatester');
    expect(midBattle.p2.team.find(p => p.speciesForme === 'Heatran')?.terastallized).toBe('Fire');

    // ...and the engine clears it on faint while still remembering the
    // consumed item — both more faithful than the hand-rolled projection.
    const heatran = battle.p2.team.find(p => p.speciesForme === 'Heatran');
    expect(heatran?.fainted).toBe(true);
    expect((heatran as unknown as { lastItem?: string })?.lastItem).toBe('airballoon');
  });

  it('exposes timer state from |inactive|', () => {
    const battle = run(playerLog);
    battle.add('|inactive|Time left: 150 sec this turn | 300 sec total');
    expect(battle.kickingInactive).not.toBe('off');
  });
});
