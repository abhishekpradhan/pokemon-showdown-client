import {
  addBattleChoice,
  availableSwitches,
  buildMoveDeck,
  canShiftBattleChoice,
  createBattleChoiceSession,
  isBattleRequest,
  moveTargetOptions,
  normalizeBattleRequest,
  type BattleRequest,
  type BattleSideID,
} from './battle-adapter';

const roster = (id: BattleSideID, count = 6) => ({
  id,
  name: id,
  pokemon: Array.from({ length: count }, (_, index) => ({
    ident: `${id}: Pokémon${index + 1}`,
    details: 'Pikachu',
    condition: '200/200',
    active: index === 0,
    moves: ['tackle'],
  })),
});
const active = {
  moves: [
    { move: 'Tackle', target: 'normal', pp: 20, maxpp: 35 },
    { move: 'Protect', target: 'self', pp: 10, maxpp: 16 },
  ],
};
const request = (gameType: string, id: BattleSideID = 'p1'): BattleRequest => ({
  gameType,
  rqid: 42,
  side: roster(id),
  active: Array.from({ length: gameType === 'triples' ? 3 : 1 }, () => active),
});

describe('server field-location rules', () => {
  it('validates disclosed ally rosters and all four side IDs', () => {
    expect(isBattleRequest({ ...request('multi', 'p3'), ally: roster('p1') })).toBe(true);
    expect(isBattleRequest({ ...request('multi', 'p3'), ally: { id: 'p1', pokemon: [null] } })).toBe(false);
    expect(isBattleRequest({ ...request('multi', 'p3'), ally: { id: 'p9', pokemon: [] } })).toBe(false);
  });
  it('reverses opposing triples slots and limits edge adjacency', () => {
    expect(moveTargetOptions('normal', 3, 0)).toEqual([2, 3, -2]);
    expect(moveTargetOptions('normal', 3, 1)).toEqual([1, 2, 3, -1, -3]);
    expect(moveTargetOptions('normal', 3, 2)).toEqual([1, 2, -2]);
    expect(moveTargetOptions('any', 3, 0)).toEqual([1, 2, 3, -2, -3]);
    expect(moveTargetOptions('adjacentAllyOrSelf', 3, 0)).toEqual([-1, -2]);
    expect(moveTargetOptions('adjacentFoe', 3, 0)).toEqual([2, 3]);
  });
  it.each(['p1', 'p2', 'p3', 'p4'] as const)(
    'targets all other FFA owners from %s, including the negative opponent',
    side => {
      const self = side === 'p1' || side === 'p2' ? -1 : -2;
      const other = self === -1 ? -2 : -1;
      expect(moveTargetOptions('normal', 1, 0, 'freeforall', side)).toEqual([1, 2, other]);
      expect(moveTargetOptions('adjacentFoe', 1, 0, 'freeforall', side)).toEqual([1, 2, other]);
      expect(moveTargetOptions('adjacentAlly', 1, 0, 'freeforall', side)).toEqual([1, 2, other]);
      expect(moveTargetOptions('adjacentAllyOrSelf', 1, 0, 'freeforall', side)).toEqual([self]);
    },
  );
  it('controls one multi roster while using two locations on each field half', () => {
    const input = request('multi', 'p3');
    const deck = buildMoveDeck(input, undefined, 'gen9ou');
    expect(deck[0].requiresTarget).toBe(true);
    expect(deck[0].targetOptions).toEqual([1, 2, -1]);
    expect(moveTargetOptions('adjacentAlly', 1, 0, 'multi', 'p3')).toEqual([-1]);
    expect(availableSwitches(createBattleChoiceSession(input))).toEqual([2, 3, 4, 5, 6]);
    expect(
      addBattleChoice(createBattleChoiceSession(input), { kind: 'move', slot: 1, target: -1 }).command,
    ).toBe('/choose move 1 -1|42');
    expect(addBattleChoice(createBattleChoiceSession(input), { kind: 'move', slot: 1, target: -2 }).ok).toBe(
      false,
    );
    expect(addBattleChoice(createBattleChoiceSession(input), { kind: 'switch', slot: 2 }).command).toBe(
      '/choose switch 2|42',
    );
  });
  it('collects all triples choices and allows shifts only from live edge positions', () => {
    let session = createBattleChoiceSession(request('triples'));
    expect(canShiftBattleChoice(session)).toBe(true);
    expect(addBattleChoice(session, { kind: 'move', slot: 1, target: 1 }).ok).toBe(false);
    session = addBattleChoice(session, { kind: 'shift' }).session;
    expect(canShiftBattleChoice(session)).toBe(false);
    expect(addBattleChoice(session, { kind: 'shift' }).ok).toBe(false);
    session = addBattleChoice(session, { kind: 'move', slot: 2 }).session;
    expect(canShiftBattleChoice(session)).toBe(true);
    expect(addBattleChoice(session, { kind: 'move', slot: 1, target: 1 }).command).toBe(
      '/choose shift, move 2, move 1 +1|42',
    );
    expect(addBattleChoice(createBattleChoiceSession(request('multi')), { kind: 'shift' }).ok).toBe(false);
  });
  it('skips fainted triples slots and handles scarce replacement choices', () => {
    const input = request('triples');
    input.side!.pokemon![1].condition = '0 fnt';
    let session = createBattleChoiceSession(input);
    session = addBattleChoice(session, { kind: 'move', slot: 2 }).session;
    expect(session.draft.choices).toEqual(['move 2', 'pass']);
    expect(addBattleChoice(session, { kind: 'shift' }).command).toBe('/choose move 2, pass, shift|42');
    const replacement = { ...input, active: undefined, forceSwitch: [true, false, true] };
    session = createBattleChoiceSession(replacement);
    session = addBattleChoice(session, { kind: 'switch', slot: 4 }).session;
    expect(session.draft.choices).toEqual(['switch 4', 'pass']);
    expect(addBattleChoice(session, { kind: 'switch', slot: 4 }).ok).toBe(false);
    expect(addBattleChoice(session, { kind: 'switch', slot: 5 }).command).toBe(
      '/choose switch 4, pass, switch 5|42',
    );
  });
  it('previews triples leads and obeys four-player selected-team counts', () => {
    expect(
      normalizeBattleRequest({ gameType: 'triples', teamPreview: true, side: roster('p1') }).chosenTeamSize,
    ).toBe(3);
    const input = {
      gameType: 'freeforall',
      teamPreview: true,
      chosenTeamSize: 3,
      side: roster('p4'),
      rqid: 9,
    };
    let session = createBattleChoiceSession(input);
    session = addBattleChoice(session, { kind: 'team', order: [6, 2, 1] }).session;
    expect(addBattleChoice(session, { kind: 'confirm' }).command).toBe('/choose team 6, 2, 1|9');
    expect(
      normalizeBattleRequest({ gameType: 'multi', teamPreview: true, side: roster('p3') }).chosenTeamSize,
    ).toBe(1);
  });
});
