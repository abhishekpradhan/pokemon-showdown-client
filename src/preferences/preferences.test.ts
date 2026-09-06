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
    const send = vi.spyOn(useArenaStore.getState().protocol, 'send').mockImplementation(() => false);
    useArenaStore.setState({ named: true, username: 'PreferenceTester', connection: 'connected', avatar: 'dawn', serverLanguage: 'english', loginPending: false });
    useWorkspaceStore.getState().setPreference('preferredAvatar', 'lucas');
    useWorkspaceStore.getState().setPreference('serverLanguage', 'french');
    expect(send.mock.calls.map(args => args[0])).toEqual(['/avatar lucas', '/language french']);
    expect(useArenaStore.getState().avatar).toBe('dawn');
    const settled = vi.fn(); useArenaStore.setState({ onLoginSettled: settled });
    routeFrame(parsePsFrame('|updateuser| PreferenceTester|1|lucas|{"language":"french"}'), useArenaStore);
    expect(useArenaStore.getState()).toMatchObject({ avatar: 'lucas', serverLanguage: 'french' });
    expect(settled).not.toHaveBeenCalled();
    useArenaStore.setState({ named: false });
    routeFrame(parsePsFrame('|updateuser| PreferenceTester|1|lucas|{"language":"french"}'), useArenaStore);
    expect(settled).toHaveBeenCalledTimes(1);
  });
});
