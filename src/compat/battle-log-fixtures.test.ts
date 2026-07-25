import singlesLog from './__fixtures__/gen9ou-singles.log?raw';
import doublesLog from './__fixtures__/gen9-doubles.log?raw';
import playerLog from './__fixtures__/player-gen9ou.log?raw';
import { projectBattleLog, type ArenaBattle, type PokemonSet } from './battle-adapter';

/**
 * Transcript safety net.
 *
 * Real battle logs (plus one synthetic player-perspective log, since replays
 * never contain |request| lines) are folded through the canonical projection
 * and their final state is snapshotted. Refactors that change behavior show
 * up as snapshot diffs to be reviewed — the Phase 2 engine swap is *expected*
 * to change some of these (it fixes real gaps); those diffs get re-blessed
 * deliberately, with eyes on them.
 */

const digestPokemon = (pokemon: PokemonSet) => ({
  name: pokemon.name,
  species: pokemon.species,
  hp: Math.round(pokemon.hp),
  ...(pokemon.currentHp !== undefined ? { currentHp: pokemon.currentHp, maxHp: pokemon.maxHp } : null),
  ...(pokemon.status ? { status: pokemon.status } : null),
  ...(pokemon.boosts ? { boosts: pokemon.boosts } : null),
  ...(pokemon.volatiles?.length ? { volatiles: pokemon.volatiles } : null),
  ...(pokemon.terastallized ? { terastallized: pokemon.terastallized } : null),
  ...(pokemon.item ? { item: pokemon.item } : null),
  ...(pokemon.fainted ? { fainted: true } : null),
});

const digest = (battle: ArenaBattle) => ({
  format: battle.format,
  mode: battle.mode,
  playerSide: battle.playerSide ?? null,
  turn: battle.turn,
  winner: battle.winner ?? null,
  ended: !!battle.ended,
  p1: battle.p1.name,
  p2: battle.p2.name,
  active: digestPokemon(battle.active),
  opponentActive: digestPokemon(battle.opponentActive),
  teamSizes: [battle.team.length, battle.opponentTeam.length],
  ourHazards: battle.sideConditions ?? [],
  theirHazards: battle.opponentSideConditions ?? [],
  weather: battle.weather ?? null,
});

const invariants = (battle: ArenaBattle) => {
  for (const pokemon of [battle.active, battle.opponentActive, ...battle.team, ...battle.opponentTeam]) {
    expect(pokemon.hp).toBeGreaterThanOrEqual(0);
    expect(pokemon.hp).toBeLessThanOrEqual(100);
  }
  expect(battle.team.length).toBeLessThanOrEqual(6);
  expect(battle.opponentTeam.length).toBeLessThanOrEqual(6);
};

describe('battle log fixtures', () => {
  it('projects a real gen9ou singles replay', () => {
    const battle = projectBattleLog(singlesLog, { id: 'fixture-singles' });
    invariants(battle);
    // A finished log ends 'ended'; mid-log it must read as a spectator.
    expect(battle.mode).toBe('ended');
    expect(projectBattleLog(singlesLog, { id: 'fixture-singles', upTo: 60 }).mode).toBe('spectator');
    // Replays are a spectator's view: no exact HP may exist on either side.
    for (const pokemon of [battle.active, battle.opponentActive, ...battle.team, ...battle.opponentTeam]) {
      expect(pokemon.currentHp).toBeUndefined();
    }
    expect(digest(battle)).toMatchSnapshot();
  });

  it('projects a real gen9 random doubles replay', () => {
    const battle = projectBattleLog(doublesLog, { id: 'fixture-doubles' });
    invariants(battle);
    expect(projectBattleLog(doublesLog, { id: 'fixture-doubles', upTo: 80 }).mode).toBe('spectator');
    expect(digest(battle)).toMatchSnapshot();
  });

  it('projects a player-perspective log with requests', () => {
    const battle = projectBattleLog(playerLog, { id: 'fixture-player', username: 'ArenaTester' });
    invariants(battle);

    // The username matches |player|p1, so this renders as the player...
    expect(battle.playerSide).toBe('p1');
    // ...which is the only case where exact HP is knowable.
    const kingambit = battle.team.find(pokemon => pokemon.species === 'Kingambit');
    expect(kingambit?.maxHp).toBe(334);

    // State tracked from protocol lines must survive later |request| rebuilds.
    const garchomp = battle.team.find(pokemon => pokemon.species === 'Garchomp');
    expect(garchomp?.status).toBe('BRN');

    expect(battle.sideConditions).toEqual([{ name: 'Spikes', layers: 1 }]);
    expect(battle.winner).toBe('ArenaTester');
    expect(digest(battle)).toMatchSnapshot();
  });

  it('projects the same log as a spectator when the username matches neither player', () => {
    const battle = projectBattleLog(playerLog, { id: 'fixture-watcher', username: 'SomeoneElse' });
    // Requests in the log flip it to player mode (requests only ever reach the
    // player), but a pure observer of the line stream before requests must
    // not claim a side from |player| lines alone.
    expect(battle.p1.name).toBe('ArenaTester');
    expect(battle.p2.name).toBe('RivalGuy');
  });
});
