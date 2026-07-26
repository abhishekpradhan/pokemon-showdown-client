import {
  addBattleChoice,
  buildMoveDeck,
  commandForChoice,
  createBattleChoiceSession,
  normalizeBattleRequest,
  parseHpPercent,
  requestFlags,
  type BattleRequest,
} from './battle-adapter';

/**
 * Request handling and choice building — the half of the adapter we keep.
 * Battle-state projection lives in @pkmn/client now and is covered by
 * battle/engine.test.ts and the transcript fixtures.
 */

describe('request normalization', () => {
  it('parses HP conditions', () => {
    expect(parseHpPercent('156/200')).toBe(78);
    expect(parseHpPercent('0 fnt')).toBe(0);
    expect(parseHpPercent('64/100 par')).toBe(64);
  });

  it('normalizes request type, targetability, and team preview size', () => {
    const teamPreview: BattleRequest = {
      teamPreview: true,
      maxChosenTeamSize: 4,
      side: { pokemon: [] },
    };
    expect(normalizeBattleRequest(teamPreview)).toMatchObject({
      requestType: 'team',
      chosenTeamSize: 4,
    });

    const forced: BattleRequest = { forceSwitch: true, side: { pokemon: [] } };
    expect(normalizeBattleRequest(forced)).toMatchObject({
      requestType: 'switch',
      forceSwitch: [true],
    });

    const wait: BattleRequest = { wait: true };
    expect(normalizeBattleRequest(wait)).toMatchObject({ requestType: 'wait', noCancel: true });
  });

  it('summarizes decision flags without a roster rebuild', () => {
    const request: BattleRequest = {
      rqid: 9,
      active: [{ moves: [{ move: 'Tackle', pp: 5, maxpp: 5 }], trapped: true }],
      side: { pokemon: [] },
      noCancel: true,
    };
    expect(requestFlags(request)).toMatchObject({
      requestType: 'move',
      noCancel: true,
      trapped: true,
    });
  });
});

describe('move deck', () => {
  const request: BattleRequest = {
    rqid: 7,
    active: [{
      moves: [
        { move: 'Moonblast', id: 'moonblast', pp: 11, maxpp: 16, target: 'normal' },
        { move: 'Close Combat', id: 'closecombat', pp: 7, maxpp: 8, disabled: true },
      ],
      canTerastallize: 'Fairy',
    }],
    side: { name: 'Codex', pokemon: [] },
  };

  it('builds cards with request state', () => {
    const deck = buildMoveDeck(request, ['Ground', 'Fighting'], 'gen9ou');
    expect(deck).toHaveLength(2);
    expect(deck[0]).toMatchObject({
      name: 'Moonblast',
      pp: '11/16',
      cmd: '/choose move 1|7',
      canTerastallize: true,
    });
    expect(deck[1]).toMatchObject({ name: 'Close Combat', disabled: true });
  });

  it('builds a doubles deck per active slot with protocol-convention targets', () => {
    const doubles: BattleRequest = {
      rqid: 3,
      active: [
        { moves: [{ move: 'Dazzling Gleam', id: 'dazzlinggleam', pp: 16, maxpp: 16, target: 'allAdjacentFoes' }] },
        { moves: [{ move: 'Fake Out', id: 'fakeout', pp: 16, maxpp: 16, target: 'normal' }] },
      ],
      side: { name: 'Codex', pokemon: [] },
    };
    const slotA = buildMoveDeck(doubles, undefined, 'gen9vgc2024', 0);
    const slotB = buildMoveDeck(doubles, undefined, 'gen9vgc2024', 1);
    expect(slotA[0]).toMatchObject({ name: 'Dazzling Gleam', activeIndex: 0, requiresTarget: false });
    expect(slotB[0]).toMatchObject({ name: 'Fake Out', activeIndex: 1, requiresTarget: true });
    // PS convention: positive slots are foes, negative are allies — and a
    // normal-target move may hit either in doubles.
    expect(slotB[0].targetOptions).toEqual([1, 2, -1, -2]);
  });

  it('marks effectiveness against the defender typing when the dex is ready', async () => {
    const { loadDex } = await import('../data/dex');
    await loadDex();
    const deck = buildMoveDeck(request, ['Ground', 'Fighting'], 'gen9ou');
    // Moonblast is Fairy: 2x into Fighting, 1x into Ground.
    expect(deck[0].effectiveness).toBe('2x');
    expect(deck[0].type).toBe('Fairy');
  });
});

describe('choice sessions', () => {
  const moveRequest: BattleRequest = {
    rqid: 8,
    targetable: true,
    active: [{
      moves: [{ move: 'Moonblast', id: 'moonblast', pp: 11, maxpp: 16, target: 'normal' }],
    }],
    side: {
      name: 'Codex',
      pokemon: [
        { ident: 'p1: Iron Valiant', details: 'Iron Valiant, L80', condition: '156/200', active: true },
        { ident: 'p1: Heatran', details: 'Heatran, L80', condition: '184/200' },
        { ident: 'p1: Dragapult', details: 'Dragapult, L80', condition: '0 fnt' },
      ],
    },
  };

  it('builds exact PS choice commands with rqid', () => {
    const deck = buildMoveDeck(moveRequest, undefined, 'gen9ou');
    expect(commandForChoice(deck[0], 8)).toBe('/choose move 1|8');
  });

  it('builds partial targeted move choices before sending exact commands', () => {
    const session = createBattleChoiceSession(moveRequest);
    const first = addBattleChoice(session, { kind: 'move', slot: 1 });
    expect(first.ok).toBe(true);
    expect(first.complete).toBe(false);
    expect(first.draft.pendingMove).toMatchObject({ slot: 1 });

    const second = addBattleChoice(first.session, { kind: 'move', slot: 1, target: -1 });
    expect(second.complete).toBe(true);
    expect(second.command).toBe('/choose move 1 -1|8');
  });

  it('rejects fainted switches and supports team preview choices', () => {
    const session = createBattleChoiceSession(moveRequest);
    const fainted = addBattleChoice(session, { kind: 'switch', slot: 3 });
    expect(fainted.ok).toBe(false);
    expect(fainted.error).toContain('fainted');

    const preview: BattleRequest = {
      rqid: 2,
      teamPreview: true,
      maxChosenTeamSize: 1,
      side: {
        name: 'Codex',
        pokemon: [
          { ident: 'p1: Iron Valiant', details: 'Iron Valiant', condition: '100/100' },
          { ident: 'p1: Heatran', details: 'Heatran', condition: '100/100' },
        ],
      },
    };
    const teamSession = createBattleChoiceSession(preview);
    const lead = addBattleChoice(teamSession, { kind: 'team', order: [2] });
    expect(lead.complete).toBe(true);
    expect(lead.command).toBe('/choose team 2|2');
  });

  it('refuses moves while a switch is forced', () => {
    const forced: BattleRequest = {
      rqid: 5,
      forceSwitch: [true],
      side: {
        name: 'Codex',
        pokemon: [
          { ident: 'p1: Iron Valiant', details: 'Iron Valiant', condition: '0 fnt', active: true },
          { ident: 'p1: Heatran', details: 'Heatran', condition: '100/100' },
        ],
      },
    };
    const session = createBattleChoiceSession(forced);
    const move = addBattleChoice(session, { kind: 'move', slot: 1 });
    expect(move.ok).toBe(false);

    const switched = addBattleChoice(session, { kind: 'switch', slot: 2 });
    expect(switched.complete).toBe(true);
    expect(switched.command).toBe('/choose switch 2|5');
  });
});
