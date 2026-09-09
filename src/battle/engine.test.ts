import { Dex } from '@pkmn/dex';
import { Generations, ID } from '@pkmn/data';
import { Battle } from '@pkmn/client';
import {
  createBattleHistory,
  feedLine,
  flipBattleView,
  loadEngine,
  projectEngineBattle,
  projectEngineLog,
} from './engine';
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
  it('does not mark a revealed but unsent roster member as fainted', () => {
    const engine = run('|gen|9\n|teamsize|p2|6\n|poke|p2|Gholdengo|');
    const view = projectEngineBattle(engine, { roomId: 'battle-unknown-hp', perspective: null });
    expect(view.opponentTeam[0]).toMatchObject({ hp: 100, hpKnown: false, fainted: false });
    expect(view.opponentTeamSize).toBe(6);
  });
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

    // Mid-battle (both sides full): the projection exposes every slot in
    // position order, with the 1-based slot numbers the target picker maps
    // protocol targets (+2 foe / -1 ally) onto.
    const midBattle = new Battle(gens, null);
    for (const line of doublesLog.split(/\r?\n/)) {
      if (line === '|turn|3') break;
      if (line) midBattle.add(line);
    }
    const view = projectEngineBattle(midBattle, {
      roomId: 'battle-gen9doublesou-1',
      perspective: null,
      result: { ended: false },
      lastRequest: undefined,
      waiting: false,
      format: 'gen9doublesou',
    });
    expect(view.actives?.map(pokemon => pokemon.slot)).toEqual([1, 2]);
    expect(view.opponentActives?.map(pokemon => pokemon.slot)).toEqual([1, 2]);
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

describe('battle information and history', () => {
  beforeAll(async () => {
    await loadEngine();
  });

  it('retains total unrevealed slots, public move usage and possible speed', () => {
    const battle = new Battle(gens, null);
    for (const line of [
      '|gametype|singles',
      '|gen|9',
      '|player|p1|Alice',
      '|player|p2|Bob',
      '|teamsize|p1|6',
      '|teamsize|p2|6',
      '|start',
      '|switch|p1a: Pikachu|Pikachu|100/100',
      '|switch|p2a: Bulbasaur|Bulbasaur|100/100',
      '|move|p2a: Bulbasaur|Tackle|p1a: Pikachu',
    ])
      feedLine(battle, line);
    const view = projectEngineBattle(battle, { roomId: 'battle-test', perspective: null });
    expect(view.opponentTeam).toHaveLength(1);
    expect(view.opponentTeamSize).toBe(6);
    expect(view.opponentActive.knownMoves).toContainEqual(
      expect.objectContaining({ name: 'Tackle', used: 1 }),
    );
    expect(view.opponentActive.speedRange?.[0]).toBeLessThan(view.opponentActive.speedRange![1]);
    expect(view.opponentActive.currentHp).toBeUndefined();
  });

  it('hides engine bookkeeping volatiles from nameplates while keeping real ones', () => {
    const battle = new Battle(gens, null);
    for (const line of [
      '|gametype|singles',
      '|gen|9',
      '|player|p1|Alice',
      '|player|p2|Bob',
      '|teamsize|p1|6',
      '|teamsize|p2|6',
      '|start',
      '|switch|p1a: Pikachu|Pikachu|100/100',
      '|switch|p2a: Bulbasaur|Bulbasaur|100/100',
      '|-enditem|p1a: Pikachu|Sitrus Berry|[eat]',
      '|-start|p1a: Pikachu|typechange|Water',
      '|-start|p1a: Pikachu|Substitute',
      '|-start|p1a: Pikachu|confusion',
      '|-start|p1a: Pikachu|perish3',
    ])
      feedLine(battle, line);
    // The engine records its bookkeeping ids; only the projection hides them.
    expect(Object.keys(battle.p1.active[0]!.volatiles)).toEqual(
      expect.arrayContaining(['itemremoved', 'typechange', 'substitute', 'confusion']),
    );
    const view = projectEngineBattle(battle, { roomId: 'battle-test', perspective: null });
    const volatiles = view.active.volatiles ?? [];
    expect(volatiles).toContain('Substitute');
    expect(volatiles.some(name => /^confusion$/i.test(name))).toBe(true);
    expect(volatiles.some(name => /itemremoved|typechange/i.test(name))).toBe(false);
    // The changed type still reaches the nameplate through the type icons.
    expect(view.active.types).toEqual(['Water']);
    expect(view.active.lastItem).toBe('Sitrus Berry');
    const counters = view.active.counters ?? [];
    expect(counters.some(line => /perish/i.test(line))).toBe(true);
    expect(counters.some(line => /itemremoved|typechange/i.test(line))).toBe(false);
  });

  it('does not invent exact HP when a public replay happens to name the viewer', () => {
    const view = projectEngineLog(singlesLog.split('\n'), { username: 'Jogarame' });
    expect(view?.team.every(pokemon => pokemon.currentHp === undefined)).toBe(true);
  });

  it('projects contextual information and finite condition durations', () => {
    const battle = run(playerLog, 'arenatester');
    feedLine(battle, '|-sidestart|p1: ArenaTester|Reflect');
    const view = projectEngineBattle(battle, { roomId: 'battle-test', perspective: 'p1' });
    expect(view.active.item).toBe('Black Glasses');
    expect(view.opponentTeam.find(pokemon => pokemon.species === 'Heatran')?.lastItem).toBe('Air Balloon');
    expect(view.sideConditions?.find(condition => condition.name === 'Reflect')?.duration).toEqual([5, 8]);
  });

  it('builds incremental history without duplicating old points and supports viewpoints', () => {
    const lines = singlesLog.split('\n').filter(Boolean);
    const split = lines.findIndex(line => line === '|turn|3');
    const history = createBattleHistory('battle-test')!;
    const first = [...history.synchronize(lines.slice(0, split))];
    const all = [...history.synchronize(lines)];
    expect(all.length).toBeGreaterThan(first.length);
    expect(all.slice(0, first.length)).toEqual(first);
    expect(history.synchronize(lines)).toHaveLength(all.length);
    const flipped = flipBattleView(all.at(-1)!.battle);
    expect(flipped.team).toEqual(all.at(-1)!.battle.opponentTeam);
    expect(flipped.opponentTeam).toEqual(all.at(-1)!.battle.team);
    expect(flipBattleView(flipped).team).toEqual(all.at(-1)!.battle.team);
  });

  it('offers bounded turn-only replay points and resets on a replaced transcript', () => {
    const history = createBattleHistory('battle-test', '', { turnsOnly: true, maxPoints: 5_000 })!;
    const points = [...history.synchronize(singlesLog.split('\n'))];
    expect(points[0].turn).toBeLessThanOrEqual(1);
    expect(points.at(-1)?.battle.ended).toBe(true);
    expect(points.length).toBeLessThan(40);
    const reset = history.synchronize(['|gen|9', '|gametype|singles', '|turn|1']);
    expect(reset).toHaveLength(1);
    expect(reset[0].turn).toBe(1);
  });
});
