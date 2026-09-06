import { vi } from 'vitest';
import {
  __testables, assertionFromToken, authorizeUrl, clearOAuthToken,
  refreshOAuthToken, saveOAuthToken, storedOAuthToken,
  requestOAuthGrant, currentOAuthToken,
} from './ps-oauth';

const { parseAssertionResponse } = __testables;

describe('ps-oauth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_PS_OAUTH_CLIENT_ID', 'arena-test-client');
  });

  it('binds grants to the exact popup and nonce and cleans up on cancellation', async () => {
    vi.useFakeTimers();
    const popup = { closed: false, close: vi.fn(), name: '', location: { origin: location.origin, pathname: '/oauth.html', search: '' } };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const controller = new AbortController();
    const grant = requestOAuthGrant('challenge', controller.signal);
    const rejected = expect(grant).rejects.toThrow('cancelled');
    const authorize = new URL(String(open.mock.calls[0][0]));
    const state = new URL(authorize.searchParams.get('redirect_uri')!).searchParams.get('state');
    expect(state).toBeTruthy();
    window.dispatchEvent(new MessageEvent('message', {
      origin: location.origin,
      source: window,
      data: { type: 'ps-oauth', search: `?state=${state}&assertion=sig&token=token&user=Alice` },
    }));
    controller.abort();
    await rejected;
    expect(popup.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    open.mockRestore();
    vi.useRealTimers();
  });

  it('does not persist a token rotation after its operation is cancelled', async () => {
    saveOAuthToken('old', 'Alice', Date.now() - 8 * 86_400_000);
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done; })));
    const locks = { request: (_name: string, _options: unknown, callback: () => unknown) => callback() };
    Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });
    const controller = new AbortController();
    const pending = currentOAuthToken(controller.signal);
    controller.abort();
    clearOAuthToken();
    resolve(new Response(']{"success":"new"}'));
    await pending;
    expect(storedOAuthToken()).toBeNull();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  });

  it('parses the login server assertion shapes', () => {
    expect(parseAssertionResponse(']{"success":true,"data":"abc.def","user":"zarel"}'))
      .toEqual({ assertion: 'abc.def', user: 'zarel' });
    expect(parseAssertionResponse('abc.def')).toEqual({ assertion: 'abc.def' });
    // `;` prefixes are refusals, not assertions.
    expect(parseAssertionResponse(';;registered account')).toEqual({ failed: true });
    expect(parseAssertionResponse(']{"success":false}')).toEqual({ failed: true });
    expect(parseAssertionResponse('')).toEqual({ failed: true });
  });

  it('builds an authorize URL with the documented parameters', () => {
    const url = new URL(authorizeUrl('4|challstr-value'));
    expect(url.origin + url.pathname).toBe('https://play.pokemonshowdown.com/api/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('arena-test-client');
    expect(url.searchParams.get('challenge')).toBe('4|challstr-value');
    expect(url.searchParams.get('redirect_uri')).toBe(`${location.origin}/oauth.html`);
  });

  it('mints an assertion from a stored token and reports revocation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(']{"success":true,"data":"sig","user":"zarel"}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(assertionFromToken('chall', 'tok')).resolves.toEqual({ assertion: 'sig', user: 'zarel' });
    const requested = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(requested.pathname).toBe('/api/oauth/api/getassertion');
    expect(requested.searchParams.get('challenge')).toBe('chall');
    expect(requested.searchParams.get('token')).toBe('tok');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(']{"success":false}')));
    await expect(assertionFromToken('chall', 'stale')).resolves.toBeNull();
  });

  it('rotates tokens through refreshtoken', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(']{"success":"new-token"}')));
    await expect(refreshOAuthToken('old-token')).resolves.toBe('new-token');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(']{"success":false}')));
    await expect(refreshOAuthToken('old-token')).resolves.toBeNull();
  });

  it('expires stored tokens past the two-week server lifetime', () => {
    saveOAuthToken('tok', 'zarel');
    expect(storedOAuthToken()).toMatchObject({ token: 'tok', user: 'zarel' });

    saveOAuthToken('tok', 'zarel', Date.now() - 15 * 24 * 60 * 60 * 1000);
    expect(storedOAuthToken()).toBeNull();
    // An expired token is cleared, not left to fail on every reconnect.
    expect(localStorage.getItem('arena-ps-oauth-token')).toBeNull();

    saveOAuthToken('tok', 'zarel');
    clearOAuthToken();
    expect(storedOAuthToken()).toBeNull();
  });
});
