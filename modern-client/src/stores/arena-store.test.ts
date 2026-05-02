import { parsePsFrame } from '../compat/protocol-client';
import { useArenaStore } from './arena-store';
import { vi } from 'vitest';

describe('arena store protocol integration', () => {
  beforeEach(() => {
    useArenaStore.setState({
      username: 'Guest Player',
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
});
