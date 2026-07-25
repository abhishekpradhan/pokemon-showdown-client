import singlesLog from './__fixtures__/gen9ou-singles.log?raw';
import doublesLog from './__fixtures__/gen9-doubles.log?raw';
import playerLog from './__fixtures__/player-gen9ou.log?raw';
import { loadEngine, projectEngineLog } from '../battle/engine';
import type { ArenaBattle, PokemonSet } from './battle-adapter';

/**
 * Transcript safety net, now over the engine-backed projection.
 *
 * These digests were first blessed against the hand-rolled projection; the
 * Phase 2 swap re-blessed them deliberately. Notable diffs reviewed at the
 * time: the engine clears Terastallization on faint, drops stat stages on
 * forced switch-out, and reconstructs rosters with official-client fidelity.
 */

const lines = (log: string) => log.split(/\r?\n/).filter(Boolean);

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

beforeAll(async () => {
  await loadEngine();
});

describe('battle log fixtures (engine projection)', () => {
  it('projects a real gen9ou singles replay', () => {
    const battle = projectEngineLog(lines(singlesLog), { roomId: 'fixture-singles' })!;
    invariants(battle);
    // A finished log ends 'ended'; mid-log it must read as a spectator.
    expect(battle.mode).toBe('ended');
    expect(projectEngineLog(lines(singlesLog), { roomId: 'fixture-singles', upTo: 60 })!.mode).toBe('spectator');
    // Replays are a spectator's view: no exact HP may exist on either side.
    for (const pokemon of [battle.active, battle.opponentActive, ...battle.team, ...battle.opponentTeam]) {
      expect(pokemon.currentHp).toBeUndefined();
    }
    expect(digest(battle)).toMatchSnapshot();
  });

  it('projects a real gen9 random doubles replay', () => {
    const battle = projectEngineLog(lines(doublesLog), { roomId: 'fixture-doubles' })!;
    invariants(battle);
    expect(projectEngineLog(lines(doublesLog), { roomId: 'fixture-doubles', upTo: 80 })!.mode).toBe('spectator');
    expect(digest(battle)).toMatchSnapshot();
  });

  it('projects a player-perspective log with requests', () => {
    const battle = projectEngineLog(lines(playerLog), { roomId: 'fixture-player', username: 'ArenaTester' })!;
    invariants(battle);

    // The username matches |player|p1, so this renders as the player...
    expect(battle.playerSide).toBe('p1');
    // ...which is the only case where exact HP is knowable.
    const kingambit = battle.team.find(pokemon => pokemon.species === 'Kingambit');
    expect(kingambit?.maxHp).toBe(334);
    expect(kingambit?.currentHp).toBe(293);

    // Status tracked through the log survives request rebuilds — by
    // construction now, rather than by a carefully-tested merge.
    const garchomp = battle.team.find(pokemon => pokemon.species === 'Garchomp');
    expect(garchomp?.status).toBe('BRN');

    expect(battle.sideConditions).toEqual([{ name: 'Spikes', layers: 1 }]);
    expect(battle.winner).toBe('ArenaTester');
    // The final request is a force-switch, so the deck is rightly empty at
    // the end; mid-battle it carries the four moves with real dex data.
    const midBattle = projectEngineLog(lines(playerLog), { roomId: 'fixture-player', username: 'ArenaTester', upTo: 25 })!;
    expect(midBattle.moves.map(move => move.name)).toEqual(['Swords Dance', 'Earthquake', 'Dragon Claw', 'Fire Fang']);
    expect(midBattle.moves[1]).toMatchObject({ type: 'Ground', category: 'Physical' });
    expect(digest(battle)).toMatchSnapshot();
  });

  it('renders true doubles state, not a folded singles view', () => {
    const battle = projectEngineLog(lines(doublesLog), { roomId: 'fixture-doubles', upTo: 40 })!;
    // Both rosters should reach 4+ revealed Pokémon in a random doubles lead
    // pair — the folded singles view used to lose one of the two actives.
    expect(battle.team.length).toBeGreaterThanOrEqual(2);
    expect(battle.opponentTeam.length).toBeGreaterThanOrEqual(2);
  });
});
