import { parsePsFrame } from '../compat/protocol-client';
import { useArenaStore } from './arena-store';
import { vi } from 'vitest';

describe('arena store protocol integration', () => {
  beforeEach(() => {
    useArenaStore.setState({
      username: 'Guest',
      named: false,
      challstr: '',
      rooms: {},
      battles: {},
      rawProtocolLog: [],
      formats: [],
      selectedFormat: 'gen9ou',
      searchState: 'idle',
      searchFormats: [],
      choiceSessionByRoom: {},
      choiceDraftByRoom: {},
      choiceErrorByRoom: {},
      battleModeByRoom: {},
      teams: [],
      activeTeam: '',
      activeTeamId: undefined,
      teamNotice: undefined,
      lastError: undefined,
      loginPending: false,
    });
  });

  it('stores challstr, user identity, formats, and room chat from protocol frames', () => {
    const store = useArenaStore.getState();

    store.handleFrame(parsePsFrame('|challstr|1|abc'));
    store.handleFrame(parsePsFrame('|updateuser|CodexTester|1|0'));
    store.handleFrame(parsePsFrame('|formats|,1|S/V Singles|[Gen 9] Random Battle,4f|[Gen 9] OU,e|[Gen 9] Ubers,e'));
    store.handleFrame(parsePsFrame('>lobby\n|init|chat\n|title|Lobby\n|c|alice|hello'));

    const state = useArenaStore.getState();
    expect(state.challstr).toBe('1|abc');
    expect(state.username).toBe('CodexTester');
    expect(state.named).toBe(true);
    expect(state.formats.find(format => format.id === 'gen9ou')).toMatchObject({ id: 'gen9ou', name: '[Gen 9] OU' });
    expect(state.rooms.lobby.title).toBe('Lobby');
    expect(state.rooms.lobby.chat[0]).toMatchObject({ user: 'alice', message: 'hello' });
  });

  it('creates battle state from init and request frames', () => {
    const store = useArenaStore.getState();

    store.handleFrame(parsePsFrame('>battle-gen9ou-1\n|init|battle\n|player|p1|Codex\n|player|p2|Rival'));
    store.handleFrame(parsePsFrame('>battle-gen9ou-1\n|request|{"rqid":4,"side":{"name":"Codex","pokemon":[{"ident":"p1: Iron Valiant","details":"Iron Valiant, L80","condition":"100/100","active":true}]},"active":[{"moves":[{"move":"Moonblast","type":"Fairy","pp":11,"maxpp":16}]}]}'));

    const battle = useArenaStore.getState().battles['battle-gen9ou-1'];
    expect(battle.p1.name).toBe('Codex');
    expect(battle.p2.name).toBe('Rival');
    expect(battle.rqid).toBe(4);
    expect(battle.moves[0].cmd).toBe('/choose move 1|4');
    expect(useArenaStore.getState().choiceSessionByRoom['battle-gen9ou-1']).toBeTruthy();
    expect(battle.p1.name).not.toBe('You');
  });

  it('tracks search state from updatesearch and sends complete targeted battle choices', () => {
    const send = vi.fn();
    useArenaStore.setState({ protocol: { send } as unknown as ReturnType<typeof useArenaStore.getState>['protocol'] });
    const store = useArenaStore.getState();

    store.handleFrame(parsePsFrame('|updatesearch|{"searching":["gen9ou"],"games":{}}'));
    expect(useArenaStore.getState().searchState).toBe('searching');
    store.handleFrame(parsePsFrame('|updatesearch|{"searching":[],"games":{}}'));
    expect(useArenaStore.getState().searchState).toBe('idle');

    store.handleFrame(parsePsFrame('>battle-gen9ou-2\n|init|battle\n|player|p1|Codex\n|player|p2|Rival'));
    store.handleFrame(parsePsFrame('>battle-gen9ou-2\n|request|{"rqid":8,"targetable":true,"side":{"name":"Codex","pokemon":[{"ident":"p1: Iron Valiant","details":"Iron Valiant, L80","condition":"100/100","active":true}]},"active":[{"moves":[{"move":"Moonblast","id":"moonblast","type":"Fairy","pp":11,"maxpp":16,"target":"normal"}]}]}'));
    const battle = useArenaStore.getState().battles['battle-gen9ou-2'];

    store.submitBattleChoice(battle.moves[0], battle.id);
    expect(send).not.toHaveBeenCalledWith(expect.stringContaining('/choose'), battle.id);
    expect(useArenaStore.getState().choiceDraftByRoom[battle.id].pendingMove).toMatchObject({ slot: 1 });

    store.submitBattleTarget(-1, battle.id);
    expect(send).toHaveBeenCalledWith('/choose move 1 -1|8', battle.id);
  });

  it('manages team CRUD and active-team deletion', () => {
    const store = useArenaStore.getState();

    store.importTeamText('Pikachu @ Light Ball\nAbility: Static\n- Thunderbolt', 'Electric test', 'gen9ou');
    let state = useArenaStore.getState();
    const teamId = state.activeTeamId;
    expect(state.teams[0]).toMatchObject({ name: 'Electric test', format: 'gen9ou' });

    store.renameTeam(teamId!, 'Renamed team');
    expect(useArenaStore.getState().teams[0].name).toBe('Renamed team');

    store.duplicateTeam(teamId!);
    state = useArenaStore.getState();
    expect(state.teams).toHaveLength(2);
    expect(state.activeTeamId).not.toBe(teamId);

    store.deleteTeam(state.activeTeamId!);
    state = useArenaStore.getState();
    expect(state.teams).toHaveLength(1);
    expect(state.activeTeamId).toBe(teamId);

    store.deleteTeam(teamId!);
    state = useArenaStore.getState();
    expect(state.teams).toHaveLength(0);
    expect(state.activeTeamId).toBeUndefined();
    expect(state.activeTeam).toBe('');
  });

  it('blocks search with all queue prerequisites and sends valid team search', () => {
    const send = vi.fn();
    useArenaStore.setState({
      protocol: { send } as unknown as ReturnType<typeof useArenaStore.getState>['protocol'],
      formats: [{ id: 'gen9ou', name: '[Gen 9] OU', searchShow: true, team: true }],
      selectedFormat: 'gen9ou',
      connection: 'connected',
      named: false,
    });
    const store = useArenaStore.getState();

    store.startSearch();
    expect(useArenaStore.getState().lastError).toContain('Choose a name');
    expect(send).not.toHaveBeenCalled();

    store.handleFrame(parsePsFrame('|updateuser|CodexTester|1|0'));
    store.startSearch();
    expect(useArenaStore.getState().lastError).toContain('Select or import a team');

    store.importTeamText('Pikachu\nAbility: Static\n- Thunderbolt', 'Searchable', 'gen9ou');
    store.startSearch();
    expect(send).toHaveBeenCalledWith(expect.stringContaining('/utm '));
    expect(send).toHaveBeenCalledWith('/search gen9ou');
  });

  it('requires a challstr before requesting an assertion', async () => {
    const send = vi.fn();
    useArenaStore.setState({
      protocol: { send } as unknown as ReturnType<typeof useArenaStore.getState>['protocol'],
      connection: 'connected',
      challstr: '',
    });

    // Without the handshake there is nothing to sign, so `/trn` must not go out
    // — sending it unsigned is what the server rejects as an invalid token.
    await useArenaStore.getState().chooseName('CodexTester');
    expect(send).not.toHaveBeenCalled();
    expect(useArenaStore.getState().lastError).toContain('handshaking');
  });

  it('signs the name with an assertion and keeps pending until updateuser', async () => {
    const send = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('4|assertion-payload', { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    useArenaStore.setState({
      protocol: { send } as unknown as ReturnType<typeof useArenaStore.getState>['protocol'],
      connection: 'connected',
      challstr: '4|challstr-value',
    });

    await useArenaStore.getState().chooseName('CodexTester');

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
    expect(body.get('act')).toBe('getassertion');
    expect(body.get('userid')).toBe('codextester');
    expect(body.get('challstr')).toBe('4|challstr-value');
    expect(send).toHaveBeenCalledWith('/trn CodexTester,0,4|assertion-payload');
    expect(useArenaStore.getState().loginPending).toBe(true);

    useArenaStore.getState().handleFrame(parsePsFrame('|updateuser| CodexTester|1|0'));
    expect(useArenaStore.getState()).toMatchObject({
      loginPending: false,
      named: true,
      username: 'CodexTester',
    });
    vi.unstubAllGlobals();
  });

  it('prompts for a password when the name is registered', async () => {
    const send = vi.fn();
    // A bare `;` means "registered account, needs a password", not a token.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(';', { status: 200 })));
    useArenaStore.setState({
      protocol: { send } as unknown as ReturnType<typeof useArenaStore.getState>['protocol'],
      connection: 'connected',
      challstr: '4|challstr-value',
      needsPassword: false,
    });

    await useArenaStore.getState().chooseName('Zarel');

    expect(send).not.toHaveBeenCalled();
    expect(useArenaStore.getState()).toMatchObject({ needsPassword: true, loginPending: false });
    vi.unstubAllGlobals();
  });

  it('surfaces nametaken from the server', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('4|assertion', { status: 200 })));
    useArenaStore.setState({
      protocol: { send } as unknown as ReturnType<typeof useArenaStore.getState>['protocol'],
      connection: 'connected',
      challstr: '4|challstr-value',
    });

    await useArenaStore.getState().chooseName('CodexTester');
    useArenaStore.getState().handleFrame(parsePsFrame('|nametaken|CodexTester|That name is taken.'));
    expect(useArenaStore.getState()).toMatchObject({
      loginPending: false,
      lastError: 'That name is taken.',
    });
    vi.unstubAllGlobals();
  });
});
