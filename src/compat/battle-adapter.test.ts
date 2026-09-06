import {
  addBattleChoice,
  buildMoveDeck,
  commandForChoice,
  createBattleChoiceSession,
  normalizeBattleRequest,
  parseHpPercent,
  requestFlags,
  availableSwitches,
  battleSupport,
  canPassBattleChoice,
  defensiveTypes,
  isReviving,
  restoreBattleChoiceSession,
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
    expect(slotB[0].targetOptions).toEqual([1, 2, -1]);
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

    const second = addBattleChoice(first.session, { kind: 'move', slot: 1, target: 1 });
    expect(second.complete).toBe(true);
    expect(second.command).toBe('/choose move 1 +1|8');
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
    expect(lead.command).toBeUndefined();
    expect(addBattleChoice(lead.session, { kind: 'confirm' }).command).toBe('/choose team 2|2');
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

describe('battle request regression corpus', () => {
  const pokemon = (name: string, condition = '100/100', extra = {}) => ({ ident: `p1: ${name}`, details: name, condition, ...extra });
  const singles = (): BattleRequest => ({ rqid: 10, active: [{ moves: [{ move: 'Tackle', target: 'normal' }] }], side: { id: 'p1', pokemon: [pokemon('Pikachu', '100/100', { active: true }), pokemon('Bulbasaur')] } });

  it('derives double leads, Illusion order and server preview counts without losing explicit counts', () => {
    const side = { pokemon: [pokemon('Pikachu'), pokemon('Bulbasaur'), pokemon('Zoroark')] };
    expect(normalizeBattleRequest({ teamPreview: true, gameType: 'doubles', side }).chosenTeamSize).toBe(2);
    expect(normalizeBattleRequest({ teamPreview: true, side: { pokemon: [...side.pokemon, pokemon('Zoroark', '100/100', { baseAbility: 'illusion' })] } }).chosenTeamSize).toBe(4);
    expect(normalizeBattleRequest({ teamPreview: true, side, teamPreviewCount: 2 }).chosenTeamSize).toBe(2);
    expect(normalizeBattleRequest({ teamPreview: true, side, chosenTeamSize: 3, teamPreviewCount: 2 }).chosenTeamSize).toBe(3);
  });

  it('allows active slots during preview and reviews, reorders and removes selections before confirming', () => {
    const request = { ...singles(), active: undefined, teamPreview: true, chosenTeamSize: 2 };
    const first = addBattleChoice(createBattleChoiceSession(request), { kind: 'team', order: [1] });
    const second = addBattleChoice(first.session, { kind: 'team', order: [2] });
    expect(second.complete).toBe(true);
    expect(second.command).toBeUndefined();
    const reordered = addBattleChoice(second.session, { kind: 'team', order: [2, 1] });
    expect(reordered.draft.choices).toEqual(['team 2', 'team 1']);
    const removed = addBattleChoice(reordered.session, { kind: 'team', order: [2] });
    expect(removed.draft.choices).toEqual(['team 1']);
    expect(addBattleChoice(removed.session, { kind: 'confirm' }).ok).toBe(false);
    expect(addBattleChoice(reordered.session, { kind: 'confirm' }).command).toBe('/choose team 2, 1|10');
  });

  it('completes scarce replacements in either position and rejects an unnecessary pass', () => {
    const request: BattleRequest = { rqid: 11, forceSwitch: [true, true], side: { pokemon: [pokemon('A', '0 fnt'), pokemon('B', '0 fnt'), pokemon('C')] } };
    const session = createBattleChoiceSession(request);
    expect(canPassBattleChoice(session)).toBe(true);
    expect(addBattleChoice(session, { kind: 'switch', slot: 3 }).command).toBe('/choose switch 3, pass|11');
    const skipped = addBattleChoice(session, { kind: 'pass' });
    expect(addBattleChoice(skipped.session, { kind: 'switch', slot: 3 }).command).toBe('/choose pass, switch 3|11');
    expect(addBattleChoice(createBattleChoiceSession({ ...request, forceSwitch: [true] }), { kind: 'pass' }).ok).toBe(false);
  });

  it('selects only fainted targets for revival, including a fainted active position', () => {
    const request: BattleRequest = { rqid: 12, forceSwitch: [true, false], side: { pokemon: [pokemon('Pawmot', '100/100', { reviving: true }), pokemon('Pikachu', '0 fnt'), pokemon('Bulbasaur')] } };
    const session = createBattleChoiceSession(request);
    expect(isReviving(session)).toBe(true);
    expect(availableSwitches(session)).toEqual([2]);
    expect(addBattleChoice(session, { kind: 'switch', slot: 3 }).ok).toBe(false);
    expect(addBattleChoice(session, { kind: 'switch', slot: 2 }).command).toBe('/choose switch 2, pass|12');
  });

  it('automatically skips Commander and fainted non-null active requests', () => {
    const request: BattleRequest = { rqid: 13, active: [{ moves: [{ move: 'Splash' }] }, { moves: [{ move: 'Protect', target: 'self' }] }], side: { pokemon: [pokemon('Tatsugiri', '100/100', { commanding: true }), pokemon('Dondozo')] } };
    const session = createBattleChoiceSession(request);
    expect(session.draft.choices).toEqual(['pass']);
    expect(addBattleChoice(session, { kind: 'move', slot: 1, activeIndex: 1 }).command).toBe('/choose pass, move 1|13');
    request.side!.pokemon![0] = pokemon('Tatsugiri', '0 fnt');
    expect(createBattleChoiceSession(request).draft.choices).toEqual(['pass']);
  });

  it('rejects submitted, stale-position and illegal self-target choices', () => {
    const chosen = addBattleChoice(createBattleChoiceSession(singles()), { kind: 'move', slot: 1, activeIndex: 0 });
    expect(chosen.command).toBe('/choose move 1|10');
    expect(addBattleChoice(chosen.session, { kind: 'move', slot: 1, activeIndex: 0 }).ok).toBe(false);
    expect(addBattleChoice(createBattleChoiceSession(singles()), { kind: 'move', slot: 1, activeIndex: 1 }).ok).toBe(false);
    expect(addBattleChoice(createBattleChoiceSession({ ...singles(), targetable: true }), { kind: 'move', slot: 1, target: -1 }).ok).toBe(false);
    expect(addBattleChoice(restoreBattleChoiceSession(singles(), 'move 1'), { kind: 'move', slot: 1 }).ok).toBe(false);
    expect(restoreBattleChoiceSession(singles(), '').status).toBe('drafting');
  });

  it('honors cancellation restrictions revealed by the last choice', () => {
    const request = singles(); request.active![0]!.maybeTrapped = true;
    expect(addBattleChoice(createBattleChoiceSession(request), { kind: 'switch', slot: 2 }).session.noCancel).toBe(true);
    request.active![0]!.maybeDisabled = true;
    expect(addBattleChoice(createBattleChoiceSession(request), { kind: 'move', slot: 1 }).session.noCancel).toBe(true);
  });

  it('uses legal ongoing Max moves even when base moves are disabled', () => {
    const request = singles();
    request.active = [{ moves: [{ move: 'Protect', disabled: true, target: 'self' }], maxMoves: { maxMoves: [{ move: 'Max Guard', target: 'self' }] } }];
    const deck = buildMoveDeck(request, undefined, 'gen8ou');
    expect(deck[0]).toMatchObject({ name: 'Max Guard', disabled: false, target: 'self', canDynamax: false });
    expect(addBattleChoice(createBattleChoiceSession(request), { kind: 'move', slot: 1 }).command).toBe('/choose move 1|10');
  });

  it('uses transformed targeting and rejects an ineligible Z move', () => {
    const request = singles(); request.targetable = true;
    request.active = [{ moves: [{ move: 'Surf', target: 'allAdjacent' }, { move: 'Tackle', target: 'normal' }], canZMove: [null, { move: 'Breakneck Blitz', target: 'normal' }], canDynamax: true, maxMoves: { maxMoves: [{ move: 'Max Geyser', target: 'adjacentFoe' }, { move: 'Max Strike', target: 'adjacentFoe' }] } }];
    const deck = buildMoveDeck(request, undefined, 'gen8ou');
    expect(deck[0].canZMove).toBe(false); expect(deck[1].zMove?.name).toBe('Breakneck Blitz');
    expect(deck[0].maxMove?.targetOptions).toEqual([1]);
    expect(addBattleChoice(createBattleChoiceSession(request), { kind: 'move', slot: 1, z: true }).ok).toBe(false);
    const pending = addBattleChoice(createBattleChoiceSession(request), { kind: 'move', slot: 1, max: true });
    expect(pending.draft.pendingMove?.max).toBe(true);
    expect(addBattleChoice(pending.session, { kind: 'move', slot: 1, max: true, target: 1 }).command).toBe('/choose move 1 max +1|10');
  });

  it('preserves Stellar defenses and communicates unsupported game types', () => {
    expect(defensiveTypes({ types: ['Water'], terastallized: 'Stellar' })).toEqual(['Water']);
    expect(defensiveTypes({ types: ['Water'], terastallized: 'Fire' })).toEqual(['Fire']);
    expect(battleSupport('gen9ou').supported).toBe(true);
    expect(battleSupport('gen9freeforall').supported).toBe(false);
    expect(battleSupport('customgame', 'multi').supported).toBe(false);
  });

  it('uses effective abilities, grounded states and transformed move types for matchup hints', async () => {
    const { loadDex } = await import('../data/dex'); await loadDex();
    const request = singles();
    request.active = [{ moves: [{ move: 'Earthquake' }], canDynamax: true, maxMoves: { maxMoves: [{ move: 'Max Geyser', type: 'Water' }] } }];
    const defender = { slot: 1, name: 'Rotom', species: 'Rotom', hp: 100, ability: 'Levitate' };
    const immune = buildMoveDeck(request, ['Electric', 'Ghost'], 'gen8ou', 0, defender)[0];
    expect(immune.effectiveness).toBe('0x');
    expect(immune.maxMove?.effectiveness).toBe('1x');
    expect(immune.maxMove?.notes).toEqual([]);
    expect(buildMoveDeck(request, ['Electric', 'Ghost'], 'gen8ou', 0, { ...defender, effectiveAbility: '' })[0].effectiveness).toBe('2x');
    expect(buildMoveDeck(request, ['Flying'], 'gen8ou', 0, { ...defender, grounded: true })[0].effectiveness).toBe('1x');
  });
});
