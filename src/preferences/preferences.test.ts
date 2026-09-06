import { vi } from 'vitest';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useArenaStore } from '../stores/arena-store';
import { avatarUrl, avatarName, isPublicAvatar, PUBLIC_AVATARS } from './avatars';
import { validateBackground } from './background';
import { routeFrame } from '../protocol/router';
import { parsePsFrame } from '../compat/protocol-client';

describe('preferences persistence and server confirmation', () => {
  const savedWorkspace = useWorkspaceStore.getState();
  const savedArena = useArenaStore.getState();
  afterEach(() => { useArenaStore.setState(savedArena, true); useWorkspaceStore.setState(savedWorkspace, true); localStorage.removeItem('ps-arena-workspace-v1'); vi.restoreAllMocks(); });
  it('migrates the old volume and rejects malformed stored options', async () => {
    localStorage.setItem('ps-arena-workspace-v1', JSON.stringify({ state: { volume: 73, background: 'url(evil)', preferredAvatar: '/admin', musicTrack: 'evil', serverLanguage: 'evil' }, version: 0 }));
    await useWorkspaceStore.persist.rehydrate();
    expect(useWorkspaceStore.getState()).toMatchObject({ effectsVolume: 73, notificationVolume: 73, musicVolume: 30, background: 'none', serverLanguage: 'english', preferredAvatar: '' });
    useWorkspaceStore.getState().setPreference('effectsVolume', 20);
    useWorkspaceStore.getState().setSoundEnabled(false);
    useWorkspaceStore.getState().setSoundEnabled(true);
    expect(useWorkspaceStore.getState()).toMatchObject({ effectsVolume: 20, notificationVolume: 73 });
  });
  it('resolves numeric trainers without accepting paths or reserved choices', () => {
    expect(avatarName(1)).toBe('lucas');
    expect(avatarUrl(1)).toBe('https://play.pokemonshowdown.com/sprites/trainers/lucas.png');
    expect(avatarUrl('../private')).toBeUndefined();
    expect(isPublicAvatar('lucas')).toBe(true);
    expect(PUBLIC_AVATARS.some(([id]) => id === '162' || id === '168')).toBe(false);
  });
  it('bounds and checks local background uploads', () => {
    expect(() => validateBackground(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).toThrow('PNG');
    expect(() => validateBackground(new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/png' }))).toThrow('1 MB');
  });
  it('waits for authoritative avatar/language and does not rejoin on preference acknowledgements', () => {
    const send = vi.spyOn(useArenaStore.getState().protocol, 'send').mockReturnValue(true);
    useArenaStore.setState({ named: true, username: 'PreferenceTester', connection: 'connected', avatar: 'dawn', serverLanguage: 'english', loginPending: false });
    useWorkspaceStore.getState().setPreference('preferredAvatar', 'lucas');
    useWorkspaceStore.getState().setPreference('serverLanguage', 'french');
    expect(send.mock.calls.map(args => args[0])).toEqual(['/avatar lucas', '/cmd userdetails preferencetester', '/language french']);
    expect(useArenaStore.getState().avatar).toBe('dawn');
    const settled = vi.fn(); useArenaStore.setState({ onLoginSettled: settled });
    routeFrame(parsePsFrame('|updateuser| PreferenceTester|1|lucas|{"language":"french"}'), useArenaStore);
    expect(useArenaStore.getState()).toMatchObject({ avatar: 'lucas', serverLanguage: 'french' });
    expect(settled).not.toHaveBeenCalled();
    useArenaStore.setState({ named: false });
    routeFrame(parsePsFrame('|updateuser| PreferenceTester|1|lucas|{"language":"french"}'), useArenaStore);
    expect(settled).toHaveBeenCalledTimes(1);
  });
  it('confirms an avatar from own structured details without trusting avatar reply HTML or another user', () => {
    const send = vi.spyOn(useArenaStore.getState().protocol, 'send').mockReturnValue(true);
    const settled = vi.fn();
    useArenaStore.setState({ named: true, username: 'PreferenceTester', connection: 'connected', avatar: 'dawn', loginPending: false, onLoginSettled: settled });
    useWorkspaceStore.getState().setPreference('preferredAvatar', 'lucas');
    expect(send.mock.calls.map(args => args[0])).toEqual(['/avatar lucas', '/cmd userdetails preferencetester']);
    routeFrame(parsePsFrame('|raw|<img src="https://play.pokemonshowdown.com/sprites/trainers/lucas.png" />'), useArenaStore);
    routeFrame(parsePsFrame('|queryresponse|userdetails|{"userid":"someoneelse","avatar":1,"rooms":{}}'), useArenaStore);
    expect(useArenaStore.getState().avatar).toBe('dawn');
    routeFrame(parsePsFrame('|queryresponse|userdetails|{"userid":"preferencetester","avatar":1,"rooms":{}}'), useArenaStore);
    expect(useArenaStore.getState().avatar).toBe('1');
    expect(settled).not.toHaveBeenCalled();
  });
  it('ignores own-details confirmations after identity changes, logout, disconnection or during another login', () => {
    for (const state of [
      { username: 'SomeoneElse', named: true, connection: 'connected' as const, loginPending: false },
      { username: 'PreferenceTester', named: false, connection: 'connected' as const, loginPending: false },
      { username: 'PreferenceTester', named: true, connection: 'offline' as const, loginPending: false },
      { username: 'PreferenceTester', named: true, connection: 'connected' as const, loginPending: true },
    ]) {
      useArenaStore.setState({ ...state, avatar: 'dawn' });
      routeFrame(parsePsFrame('|queryresponse|userdetails|{"userid":"preferencetester","avatar":1,"rooms":{}}'), useArenaStore);
      expect(useArenaStore.getState().avatar).toBe('dawn');
    }
    useArenaStore.setState({ username: 'PreferenceTester', named: true, connection: 'connected', loginPending: false, avatar: 'dawn' });
    for (const data of [
      { userid: 'preferencetester', avatar: 1, rooms: false },
      { userid: 'PreferenceTester', avatar: 1, rooms: {} },
      { userid: 'preferencetester', avatar: '../invalid', rooms: {} },
    ]) {
      routeFrame(parsePsFrame(`|queryresponse|userdetails|${JSON.stringify(data)}`), useArenaStore);
      expect(useArenaStore.getState().avatar).toBe('dawn');
    }
  });
  it('queries confirmation on reconnect and retry, but does not query when the avatar command was not sent', () => {
    const send = vi.spyOn(useArenaStore.getState().protocol, 'send').mockReturnValue(true);
    useWorkspaceStore.getState().setPreference('preferredAvatar', 'lucas');
    useArenaStore.setState({ named: true, username: 'PreferenceTester', connection: 'connected', avatar: 'dawn', loginPending: false });
    useArenaStore.getState().onLoginSettled();
    useArenaStore.getState().applyAvatarPreference();
    expect(send.mock.calls.map(args => args[0])).toEqual([
      '/avatar lucas', '/cmd userdetails preferencetester', '/avatar lucas', '/cmd userdetails preferencetester',
    ]);
    send.mockClear().mockReturnValue(false);
    expect(useArenaStore.getState().applyAvatarPreference()).toBe(false);
    expect(send.mock.calls.map(args => args[0])).toEqual(['/avatar lucas']);
    send.mockClear();
    useArenaStore.setState({ named: false });
    expect(useArenaStore.getState().applyAvatarPreference()).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
