import { battleFromRequest, commandForChoice, parseHpPercent, type BattleRequest } from './battle-adapter';

describe('battle request adapter', () => {
  it('maps PS request payloads into playable battle state', () => {
    const request: BattleRequest = {
      rqid: 7,
      side: {
        name: 'Codex',
        pokemon: [
          { ident: 'p1: Iron Valiant', details: 'Iron Valiant, L80', condition: '156/200', active: true },
          { ident: 'p1: Heatran', details: 'Heatran, L80', condition: '0 fnt' },
        ],
      },
      active: [{
        moves: [
          { move: 'Moonblast', type: 'Fairy', pp: 11, maxpp: 16, target: 'normal' },
          { move: 'Close Combat', type: 'Fighting', pp: 7, maxpp: 8, disabled: true },
        ],
      }],
    };

    const battle = battleFromRequest('battle-gen9ou-1', request);

    expect(battle.id).toBe('battle-gen9ou-1');
    expect(battle.rqid).toBe(7);
    expect(battle.active.name).toBe('Iron Valiant');
    expect(battle.team[0].hp).toBe(78);
    expect(battle.team[1].fainted).toBe(true);
    expect(battle.moves[0].cmd).toBe('/choose move 1|7');
    expect(battle.moves[1].disabled).toBe(true);
  });

  it('builds exact PS choice commands with rqid', () => {
    expect(commandForChoice({
      name: 'Moonblast',
      type: 'Fairy',
      pp: '11/16',
      cmd: 'move 1 terastallize',
      effectiveness: 'ready',
    }, 9)).toBe('/choose move 1 terastallize|9');

    expect(commandForChoice({ slot: 3, name: 'Kingambit', species: 'kingambit', hp: 64 }, 9)).toBe('/choose switch 3|9');
  });

  it('parses HP conditions', () => {
    expect(parseHpPercent('50/200')).toBe(25);
    expect(parseHpPercent('0 fnt')).toBe(0);
  });
});
