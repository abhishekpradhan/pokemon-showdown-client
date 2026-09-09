import { beforeAll, describe, expect, it } from 'vitest';
import {
  battleFieldPositions,
  battleTargetAt,
  type BattleRequest,
  type BattleSideID,
} from '../compat/battle-adapter';
import {
  createEngineBattle,
  feedLine,
  flipBattleView,
  loadEngine,
  projectEngineBattle,
  projectEngineLog,
} from './engine';
import corpus from '../test/fixtures/protocol-corpus.json';

beforeAll(async () => {
  await loadEngine();
});
const species = ['Pikachu', 'Bulbasaur', 'Charmander', 'Squirtle'];
const fourLog = (gameType: string) => [
  '|gen|9',
  `|gametype|${gameType}`,
  ...species.map((_, index) => `|player|p${index + 1}|Player${index + 1}|1|1200`),
  ...species.map((_, index) => `|teamsize|p${index + 1}|6`),
  '|start',
  ...species.map((name, index) => `|switch|p${index + 1}${index < 2 ? 'a' : 'b'}: ${name}|${name}|100/100`),
  '|turn|1',
];
const privateSide = (id: BattleSideID, name: string) => ({
  id,
  name: `Player${id[1]}`,
  pokemon: [
    {
      ident: `${id}: ${name}`,
      details: name,
      condition: '155/200',
      active: true,
      moves: ['tackle'],
      item: 'leftovers',
      ability: 'static',
      stats: { atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    },
    {
      ident: `${id}: Eevee`,
      details: 'Eevee',
      condition: '180/180',
      active: false,
      moves: ['protect'],
      item: 'choicescarf',
      ability: 'adaptability',
    },
  ],
});
const p3Request = (gameType: string): BattleRequest => ({
  gameType,
  rqid: 1,
  side: privateSide('p3', 'Charmander'),
  ally: gameType === 'multi' ? privateSide('p1', 'Pikachu') : undefined,
  active: [{ moves: [{ move: 'Tackle', target: 'normal', pp: 20, maxpp: 35 }] }],
});

describe('four independent battle owners', () => {
  it.each(corpus.cases)(
    'projects recorded $scenario $seat without engine warnings or undisclosed exact HP',
    recording => {
      const battle = projectEngineLog(
        recording.frames.flatMap(frame => frame.split('\n')),
        { username: recording.username },
      )!;
      expect(battle.engineWarning).toBeUndefined();
      expect(battle.playerSide).toBe(recording.seat);
      expect(battleFieldPositions(battle)).toHaveLength(recording.scenario === 'triples' ? 6 : 4);
      const ownIndex = Number(recording.seat[1]) - 1;
      for (const [index, side] of battle.sides!.entries()) {
        const disclosed = index === ownIndex || (recording.scenario === 'multi' && index === (ownIndex ^ 2));
        if (disclosed) expect(side.team[0].currentHp).toBeDefined();
        else
          expect(
            side.team.every(
              pokemon =>
                pokemon.currentHp === undefined && pokemon.maxHp === undefined && pokemon.stats === undefined,
            ),
          ).toBe(true);
      }
    },
  );
  it.each(['multi', 'freeforall'])(
    'retains every seat through %s private requests, damage and switches',
    gameType => {
      const engine = createEngineBattle(null)!;
      for (const line of fourLog(gameType)) expect(feedLine(engine, line)).toBe(true);
      const request = p3Request(gameType);
      expect(feedLine(engine, `|request|${JSON.stringify(request)}`)).toBe(true);
      expect(engine.sides.map(side => side.n)).toEqual([0, 1, 2, 3]);
      expect(engine.getAllActive()).toHaveLength(4);
      let battle = projectEngineBattle(engine, {
        roomId: 'battle-four',
        perspective: 'p3',
        lastRequest: request,
      });
      expect(battle.active).toMatchObject({
        name: 'Charmander',
        slot: 1,
        sideId: 'p3',
        currentHp: 155,
        maxHp: 200,
      });
      expect(battle.sides?.map(side => side.actives.map(pokemon => pokemon.name))).toEqual(
        species.map(name => [name]),
      );
      expect(battleTargetAt(battle, -1)).toMatchObject({
        sideId: 'p1',
        relation: gameType === 'multi' ? 'ally' : 'opponent',
      });
      expect(battleTargetAt(battle, -2)).toMatchObject({ sideId: 'p3', relation: 'you' });
      expect(battleTargetAt(battle, 1)).toMatchObject({ sideId: 'p2', relation: 'opponent' });
      expect(battleTargetAt(battle, 2)).toMatchObject({ sideId: 'p4', relation: 'opponent' });
      expect(battle.sides?.[0].team.length).toBe(gameType === 'multi' ? 2 : 1);
      expect(battle.sides?.[0].team[0].currentHp).toBe(gameType === 'multi' ? 155 : undefined);
      expect(battle.sides?.[1].team[0].currentHp).toBeUndefined();
      expect(battle.sides?.[3].team[0].item).toBeUndefined();
      for (const line of [
        '|-damage|p3b: Charmander|50/200',
        '|move|p4b: Squirtle|Tackle|p3b: Charmander',
        '|turn|2',
      ])
        expect(feedLine(engine, line)).toBe(true);
      battle = projectEngineBattle(engine, { roomId: 'battle-four', perspective: 'p3' });
      expect(battle.active.currentHp).toBe(50);
      expect(battle.sides?.[0].actives[0].name).toBe('Pikachu');
      expect(feedLine(engine, '|switch|p3b: Eevee|Eevee|180/180')).toBe(true);
      expect(feedLine(engine, '|faint|p2a: Bulbasaur')).toBe(true);
      battle = projectEngineBattle(engine, { roomId: 'battle-four', perspective: 'p3' });
      expect(battle.active.name).toBe('Eevee');
      expect(battle.sides?.[2].actives).toHaveLength(1);
      expect(battle.sides?.[1].actives).toHaveLength(0);
      expect(battle.sides?.[3].actives[0].name).toBe('Squirtle');
      expect(battle.engineWarning).toBeUndefined();
    },
  );
  it('replays four viewpoints while keeping undisclosed rosters and exact HP hidden', () => {
    let battle = projectEngineLog(fourLog('freeforall'))!;
    expect(battle.sides).toHaveLength(4);
    for (let index = 0; index < 4; index++) {
      expect(battle.active.name).toBe(species[index]);
      expect(battleFieldPositions(battle)).toHaveLength(4);
      expect(
        battle
          .sides!.flatMap(side => side.team)
          .every(pokemon => pokemon.currentHp === undefined && pokemon.item === undefined),
      ).toBe(true);
      battle = flipBattleView(battle);
    }
    expect(battle.active.name).toBe('Pikachu');
    expect(projectEngineLog(fourLog('multi'), { username: 'Player4' })?.playerSide).toBe('p4');
  });
  it('advances every owner’s Toxic counter once per upkeep', () => {
    const engine = createEngineBattle(null)!;
    for (const line of [
      ...fourLog('multi'),
      ...species.map((name, index) => `|-status|p${index + 1}${index < 2 ? 'a' : 'b'}: ${name}|tox`),
      '|upkeep',
    ])
      expect(feedLine(engine, line)).toBe(true);
    expect(engine.getAllActive().map(pokemon => pokemon.statusState.toxicTurns)).toEqual([1, 1, 1, 1]);
    expect(feedLine(engine, '|upkeep')).toBe(true);
    expect(engine.getAllActive().map(pokemon => pokemon.statusState.toxicTurns)).toEqual([2, 2, 2, 2]);
  });
  it('projects triples swap events and all six active positions', () => {
    const engine = createEngineBattle(null)!;
    for (const line of [
      '|gen|6',
      '|gametype|triples',
      '|start',
      ...['Pikachu', 'Eevee', 'Charmander'].flatMap((name, index) => [
        `|switch|p1${String.fromCharCode(97 + index)}: ${name}|${name}|100/100`,
        `|switch|p2${String.fromCharCode(97 + index)}: Foe${index}|${name}|100/100`,
      ]),
      '|turn|1',
      '|swap|p1a: Pikachu|1',
    ])
      expect(feedLine(engine, line)).toBe(true);
    const battle = projectEngineBattle(engine, { roomId: 'battle-triples', perspective: null });
    expect(battleFieldPositions(battle)).toHaveLength(6);
    expect(battle.actives?.map(pokemon => pokemon.name)).toEqual(['Eevee', 'Pikachu', 'Charmander']);
    expect(battleTargetAt(battle, -2)?.pokemon?.name).toBe('Pikachu');
  });
});
