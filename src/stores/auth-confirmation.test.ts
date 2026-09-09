import { vi } from 'vitest';
import { useArenaStore } from './arena-store';
import { useWorkspaceStore } from './workspace-store';
import { parsePsFrame } from '../compat/protocol-client';
import * as oauth from '../compat/ps-oauth';
import * as login from '../compat/login-server';

const initial = useArenaStore.getState();
const preferences = useWorkspaceStore.getState();
const send = vi.fn(() => true);
const frame = (raw: string) => useArenaStore.getState().handleFrame(parsePsFrame(raw));
const grant = { user: 'ArenaNew', token: 'synthetic-token', assertion: 'synthetic-assertion' };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  useArenaStore.getState().cancelLogin();
  send.mockClear();
  useWorkspaceStore.setState({
    autojoinRooms: [],
    preferredAvatar: '',
    serverLanguage: 'english',
    blockPms: false,
    blockChallenges: false,
  });
  useArenaStore.setState({
    ...initial,
    named: true,
    username: 'ArenaOld',
    connection: 'connected',
    challstr: '1|synthetic-challenge',
    rooms: {},
    lastError: undefined,
    loginPending: false,
    protocol: { send } as unknown as typeof initial.protocol,
  });
  vi.spyOn(oauth, 'saveOAuthToken').mockReturnValue(true);
});
afterEach(() => {
  useArenaStore.getState().cancelLogin();
  useArenaStore.setState(initial, true);
  useWorkspaceStore.setState(preferences, true);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
});

it('arms the confirmation timeout only once a slow login server has answered and /trn is sent', async () => {
  vi.useFakeTimers();
  vi.spyOn(login, 'getAssertion').mockImplementation(
    () =>
      new Promise<login.AssertionOutcome>(resolve => {
        setTimeout(() => resolve({ kind: 'assertion', assertion: 'slow-assertion' }), 9_000);
      }),
  );
  const pending = useArenaStore.getState().chooseName('ArenaOld');
  // Nine seconds at the login server: longer than the 8 s server-confirmation
  // window, which must not be running yet because nothing was sent.
  await vi.advanceTimersByTimeAsync(9_000);
  await pending;
  expect(send).toHaveBeenCalledWith('/trn ArenaOld,0,slow-assertion');
  expect(useArenaStore.getState()).toMatchObject({ loginPending: true, lastError: undefined });
  frame('|updateuser| ArenaOld|1|lucas');
  expect(useArenaStore.getState()).toMatchObject({ loginPending: false, named: true, username: 'ArenaOld' });
  await vi.advanceTimersByTimeAsync(8_001);
  expect(useArenaStore.getState().lastError).toBeUndefined();
});

it('starts the confirmation window when the assertion is sent, not when the fetch starts', async () => {
  vi.useFakeTimers();
  vi.spyOn(login, 'getAssertion').mockImplementation(
    () =>
      new Promise<login.AssertionOutcome>(resolve => {
        setTimeout(() => resolve({ kind: 'assertion', assertion: 'slow-assertion' }), 9_000);
      }),
  );
  const pending = useArenaStore.getState().chooseName('ArenaOld');
  await vi.advanceTimersByTimeAsync(9_000);
  await pending;
  await vi.advanceTimersByTimeAsync(7_999);
  expect(useArenaStore.getState()).toMatchObject({ loginPending: true, lastError: undefined });
  await vi.advanceTimersByTimeAsync(2);
  expect(useArenaStore.getState()).toMatchObject({ loginPending: false });
  expect(useArenaStore.getState().lastError).toContain('did not confirm');
});

it('reports a hung login server as a clear error instead of an endless pending sign-in', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    ),
  );
  const pending = useArenaStore.getState().chooseName('ArenaOld');
  await vi.advanceTimersByTimeAsync(login.LOGIN_SERVER_TIMEOUT - 1);
  expect(useArenaStore.getState().loginPending).toBe(true);
  await vi.advanceTimersByTimeAsync(2);
  await pending;
  expect(send).not.toHaveBeenCalled();
  expect(useArenaStore.getState().loginPending).toBe(false);
  expect(useArenaStore.getState().lastError).toContain('did not respond in time');
});

it('keeps OAuth pending through old-account profile updates and settles only the requested identity', async () => {
  const authorization = deferred<oauth.OAuthGrant>();
  vi.spyOn(oauth, 'requestOAuthGrant').mockReturnValue(authorization.promise);
  const pending = useArenaStore.getState().loginWithOAuth();
  frame('|updateuser| ArenaOld@!|1|lucas|{"language":"french"}');
  expect(useArenaStore.getState()).toMatchObject({
    loginPending: true,
    loginStage: 'authorization',
    username: 'ArenaOld',
    avatar: 'lucas',
    serverLanguage: 'french',
  });
  expect(send).not.toHaveBeenCalled();
  authorization.resolve(grant);
  await pending;
  expect(send).toHaveBeenCalledWith('/trn ArenaNew,0,synthetic-assertion');
  frame('|updateuser| ArenaOld|1|dawn|{"language":"english"}');
  expect(useArenaStore.getState()).toMatchObject({ loginPending: true, loginStage: 'confirmation' });
  frame('|updateuser|+aReNa NeW@!|1|dawn');
  expect(useArenaStore.getState()).toMatchObject({ loginPending: false, named: true, username: 'aReNa NeW' });
});

it('does not accept a matching guest identity before its assertion has been submitted', async () => {
  const assertion = deferred<login.AssertionOutcome>();
  vi.spyOn(login, 'getAssertion').mockReturnValue(assertion.promise);
  const pending = useArenaStore.getState().chooseName('ArenaOld');
  frame('|updateuser| ArenaOld|1|dawn');
  expect(useArenaStore.getState().loginPending).toBe(true);
  assertion.resolve({ kind: 'assertion', assertion: 'synthetic-guest-assertion' });
  await pending;
  expect(send).toHaveBeenCalledWith('/trn ArenaOld,0,synthetic-guest-assertion');
  frame('|updateuser| ArenaOld|1|lucas');
  expect(useArenaStore.getState().loginPending).toBe(false);
});

it('retains the server confirmation timeout after an unrelated profile acknowledgement', async () => {
  vi.useFakeTimers();
  vi.spyOn(oauth, 'requestOAuthGrant').mockResolvedValue(grant);
  await useArenaStore.getState().loginWithOAuth();
  await vi.advanceTimersByTimeAsync(7_000);
  frame('|updateuser| ArenaOld|1|lucas');
  await vi.advanceTimersByTimeAsync(1_001);
  expect(useArenaStore.getState()).toMatchObject({ loginPending: false, username: 'ArenaOld' });
  expect(useArenaStore.getState().lastError).toContain('did not confirm');
});

it('ignores unrelated rejections and accepts an unnamed rejection only after sending the assertion', async () => {
  const authorization = deferred<oauth.OAuthGrant>();
  vi.spyOn(oauth, 'requestOAuthGrant').mockReturnValue(authorization.promise);
  const pending = useArenaStore.getState().loginWithOAuth();
  frame('|nametaken||Stale rejection');
  expect(useArenaStore.getState()).toMatchObject({ loginPending: true, lastError: undefined });
  authorization.resolve(grant);
  await pending;
  frame('|nametaken|ArenaOld|Unrelated rejection');
  expect(useArenaStore.getState()).toMatchObject({ loginPending: true, lastError: undefined });
  frame('|nametaken||The assertion was rejected.');
  expect(useArenaStore.getState()).toMatchObject({
    loginPending: false,
    username: 'ArenaOld',
    lastError: 'The assertion was rejected.',
  });
  frame('|updateuser| ArenaOld@!|1|dawn|{"language":"french"}');
  expect(useArenaStore.getState()).toMatchObject({
    loginPending: false,
    lastError: 'The assertion was rejected.',
  });
});

it('cannot settle a replacement login with the previous attempt identity', async () => {
  vi.spyOn(login, 'getAssertion').mockResolvedValue({ kind: 'assertion', assertion: 'synthetic-assertion' });
  await useArenaStore.getState().chooseName('ArenaFirst');
  await useArenaStore.getState().chooseName('ArenaSecond');
  frame('|updateuser| ArenaFirst|1|lucas');
  expect(useArenaStore.getState().loginPending).toBe(true);
  frame('|updateuser| ArenaSecond|0|lucas');
  expect(useArenaStore.getState().loginPending).toBe(true);
  frame('|updateuser| ArenaSecond|1|lucas');
  expect(useArenaStore.getState().loginPending).toBe(false);
});

it('binds resumed OAuth assertions to their confirmed registered identity', async () => {
  vi.spyOn(oauth, 'oauthConfigured').mockReturnValue(true);
  vi.spyOn(oauth, 'currentOAuthToken').mockResolvedValue({
    token: 'synthetic-token',
    user: 'ArenaNew',
    issuedAt: Date.now(),
  });
  vi.spyOn(oauth, 'assertionFromToken').mockResolvedValue({
    user: 'ArenaNew',
    assertion: 'synthetic-assertion',
  });
  await useArenaStore.getState().resumeSession('1|synthetic-challenge');
  frame('|updateuser| ArenaOld|1|lucas');
  expect(useArenaStore.getState().loginPending).toBe(true);
  frame('|updateuser| ArenaNew|1|lucas');
  expect(useArenaStore.getState().loginPending).toBe(false);
});

it('a cancelled authorization cannot submit its delayed grant', async () => {
  const authorization = deferred<oauth.OAuthGrant>();
  vi.spyOn(oauth, 'requestOAuthGrant').mockReturnValue(authorization.promise);
  const pending = useArenaStore.getState().loginWithOAuth();
  useArenaStore.getState().cancelLogin();
  authorization.resolve(grant);
  await pending;
  expect(send).not.toHaveBeenCalled();
  expect(oauth.saveOAuthToken).not.toHaveBeenCalled();
  expect(useArenaStore.getState().loginPending).toBe(false);
});
