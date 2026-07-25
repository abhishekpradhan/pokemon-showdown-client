import { parseChatRoomList, parseRoomList, parseFormats } from './protocol-parsers';

describe('chat room directory', () => {
  // Shape captured from a live sim3.psim.us `/cmd rooms` response. Earlier code
  // expected `official`/`pspl` arrays, which the server no longer sends — the
  // branches handling them were dead, and "Official" is a section value.
  const live = {
    chat: [
      { title: 'Lobby', desc: "Still haven't decided on a room for you?", userCount: 790, section: 'Official' },
      { title: 'Help', desc: 'Have a question about Showdown?', userCount: 288, section: 'Official' },
      { title: 'Français', desc: 'Là où les Dresseurs…', userCount: 84, section: 'Languages' },
    ],
    sectionTitles: ['Official', 'Battle formats', 'Languages'],
    userCount: 15530,
    battleCount: 1717,
  };

  it('parses the live response shape', () => {
    const parsed = parseChatRoomList(live);
    expect(parsed).not.toBeNull();
    expect(parsed!.rooms).toHaveLength(3);
    expect(parsed!.rooms[0]).toMatchObject({ id: 'lobby', title: 'Lobby', userCount: 790, section: 'Official' });
    expect(parsed!.sectionTitles).toEqual(['Official', 'Battle formats', 'Languages']);
  });

  it('derives official status from the section, not a separate array', () => {
    const parsed = parseChatRoomList(live)!;
    expect(parsed.rooms.find(room => room.id === 'lobby')?.official).toBe(true);
    expect(parsed.rooms.find(room => room.id === 'franais')?.official).toBe(false);
  });

  it('rejects a battle roomlist payload', () => {
    // roomlist and rooms are different commands with different shapes; feeding
    // one to the other is what left the community screen listing only battles.
    expect(parseChatRoomList({ rooms: { 'battle-gen9ou-1': { p1: 'a', p2: 'b' } } })).toBeNull();
  });

  it('still parses battle roomlists', () => {
    const parsed = parseRoomList({
      rooms: { 'battle-gen9ou-1': { p1: 'Alice', p2: 'Bob', minElo: 1400 } },
      battleCount: 1,
    });
    expect(parsed!.rooms[0]).toMatchObject({ id: 'battle-gen9ou-1', p1: 'Alice', p2: 'Bob', format: 'gen9ou' });
  });
});

describe('format list', () => {
  it('reads sections and per-format flags', () => {
    const formats = parseFormats(['', ',1', 'S/V Singles', '[Gen 9] Random Battle,f', '[Gen 9] OU,e']);
    const random = formats.find(f => f.id === 'gen9randombattle');
    const ou = formats.find(f => f.id === 'gen9ou');
    expect(random?.section).toBe('S/V Singles');
    // 0xf = team|searchShow|challengeShow -> preset team, searchable
    expect(random).toMatchObject({ team: false, searchShow: true });
    expect(ou).toMatchObject({ team: true, searchShow: true });
  });
});
