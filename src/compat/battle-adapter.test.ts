import {
  addBattleChoice,
  applyBattleProtocolLine,
  battleFromRequest,
  commandForChoice,
  createBattleChoiceSession,
  normalizeBattleRequest,
  emptyBattle,
  parseHpPercent,
  type ArenaBattle,
  type BattleRequest,
} from './battle-adapter';

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
    expect(battle.moves[0].requiresTarget).toBe(false);
    expect(battle.moves[1].disabled).toBe(true);
  });

  it('builds exact PS choice commands with rqid', () => {
    expect(commandForChoice({
      name: 'Moonblast',
      slot: 1,
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

  it('normalizes request type, targetability, and team preview size', () => {
    const normalized = normalizeBattleRequest({
      rqid: 10,
      teamPreview: true,
      side: {
        pokemon: [
          { ident: 'p1: Meowscarada', details: 'Meowscarada, L80', condition: '100/100' },
          { ident: 'p1: Heatran', details: 'Heatran, L80', condition: '100/100' },
        ],
      },
    });

    expect(normalized.requestType).toBe('team');
    expect(normalized.chosenTeamSize).toBe(1);
    expect(normalized.noCancel).toBe(false);
  });

  it('builds partial targeted move choices before sending exact commands', () => {
    const request: BattleRequest = {
      rqid: 11,
      targetable: true,
      side: {
        pokemon: [
          { ident: 'p1: Iron Valiant', details: 'Iron Valiant, L80', condition: '100/100', active: true },
        ],
      },
      active: [{
        moves: [{ move: 'Moonblast', id: 'moonblast', type: 'Fairy', pp: 11, maxpp: 16, target: 'normal' }],
        canTerastallize: 'Fairy',
      }],
    };
    const session = createBattleChoiceSession(request);
    const pending = addBattleChoice(session, { kind: 'move', slot: 1, tera: true });

    expect(pending.complete).toBe(false);
    expect(pending.draft.pendingMove).toMatchObject({ slot: 1, tera: true });

    const complete = addBattleChoice(pending.session, { ...pending.draft.pendingMove!, target: -1 });
    expect(complete.complete).toBe(true);
    expect(complete.command).toBe('/choose move 1 terastallize -1|11');
  });

  it('rejects fainted switches and supports team preview choices', () => {
    const switchSession = createBattleChoiceSession({
      rqid: 12,
      forceSwitch: [true],
      side: {
        pokemon: [
          { ident: 'p1: Fainted', details: 'Fainted, L80', condition: '0 fnt', active: true },
          { ident: 'p1: Heatran', details: 'Heatran, L80', condition: '0 fnt' },
        ],
      },
    });
    expect(addBattleChoice(switchSession, { kind: 'switch', slot: 2 }).ok).toBe(false);

    const teamSession = createBattleChoiceSession({
      rqid: 13,
      teamPreview: true,
      chosenTeamSize: 2,
      side: {
        pokemon: [
          { ident: 'p1: Lead', details: 'Lead, L80', condition: '100/100' },
          { ident: 'p1: Second', details: 'Second, L80', condition: '100/100' },
        ],
      },
    });
    const one = addBattleChoice(teamSession, { kind: 'team', order: [2] });
    expect(one.complete).toBe(false);
    const two = addBattleChoice(one.session, { kind: 'team', order: [1] });
    expect(two.command).toBe('/choose team 2, 1|13');
  });

  it('projects live protocol into the visible field for either player side', () => {
    const playerBattle = battleFromRequest('battle-gen9ou-2', {
      rqid: 14,
      side: {
        id: 'p2',
        name: 'Codex',
        pokemon: [
          { ident: 'p2: Dragapult', details: 'Dragapult, L80', condition: '200/200', active: true },
        ],
      },
      active: [{ moves: [] }],
    });
    const withOpponent = applyBattleProtocolLine(playerBattle, {
      command: 'switch',
      args: ['p1a: Great Tusk', 'Great Tusk, L80', '150/200'],
    });
    const damaged = applyBattleProtocolLine(withOpponent, {
      command: '-damage',
      args: ['p2a: Dragapult', '50/200 brn'],
    });
    const weather = applyBattleProtocolLine(damaged, {
      command: '-weather',
      args: ['Sandstorm'],
    });
    const ended = applyBattleProtocolLine(weather, {
      command: 'win',
      args: ['Codex'],
    });

    expect(damaged.opponentActive).toMatchObject({ name: 'Great Tusk', hp: 75 });
    expect(damaged.active).toMatchObject({ name: 'Dragapult', hp: 25, status: 'BRN' });
    expect(ended.weather).toBe('Sandstorm');
    expect(ended).toMatchObject({ ended: true, winner: 'Codex', mode: 'ended' });
  });
});

describe('side assignment', () => {
  const emptyRoster = { ...emptyBattle, id: 'battle-gen9randombattle-1', format: 'gen9randombattle' };

  it('never reveals the opponent\'s exact HP', () => {
    // Mirror match as p2. The server sends our exact HP and only a percentage
    // for the opponent — the client must not invent the missing precision.
    let battle: ArenaBattle = { ...emptyRoster, playerSide: 'p2' };
    battle = applyBattleProtocolLine(battle, {
      command: 'switch',
      args: ['p1a: Lilligant', 'Lilligant, L86, F', '100/100'],
    });
    battle = applyBattleProtocolLine(battle, {
      command: 'switch',
      args: ['p2a: Lilligant', 'Lilligant, L86, F', '261/261'],
    });

    expect(battle.active.currentHp).toBe(261);
    expect(battle.active.maxHp).toBe(261);
    // The opponent's HP is a percentage, so no exact figure is carried through
    // — rendering "100/100" would read as a real HP total we cannot know.
    expect(battle.opponentActive.currentHp).toBeUndefined();
    expect(battle.opponentActive.maxHp).toBeUndefined();
    expect(battle.opponentActive.hp).toBe(100);
  });

  it('re-sides rosters when the request contradicts the assumed side', () => {
    // Switches can arrive before the first |request|. Those default to p1, so
    // a p2 player would otherwise end up with the opponent's nameplate showing
    // their own Pokémon.
    let battle: ArenaBattle = { ...emptyRoster, playerSide: 'p1' };
    battle = applyBattleProtocolLine(battle, {
      command: 'switch',
      args: ['p1a: Great Tusk', 'Great Tusk, L80', '100/100'],
    });
    battle = applyBattleProtocolLine(battle, {
      command: 'switch',
      args: ['p2a: Dragapult', 'Dragapult, L80', '301/301'],
    });
    expect(battle.active.name).toBe('Great Tusk');

    const corrected = battleFromRequest('battle-gen9randombattle-1', {
      rqid: 1,
      side: {
        id: 'p2',
        name: 'ArenaTester',
        pokemon: [{ ident: 'p2: Dragapult', details: 'Dragapult, L80', condition: '301/301', active: true }],
      },
      active: [{ moves: [{ move: 'Dragon Darts', pp: 16, maxpp: 16 }] }],
    }, battle);

    expect(corrected.playerSide).toBe('p2');
    expect(corrected.active.name).toBe('Dragapult');
    expect(corrected.opponentActive.name).toBe('Great Tusk');
    expect(corrected.opponentActive.currentHp).toBeUndefined();
    expect(corrected.opponentActive.hp).toBe(100);
  });
});
