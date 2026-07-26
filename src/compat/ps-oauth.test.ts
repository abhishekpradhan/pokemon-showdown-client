import { vi } from 'vitest';
import {
  __testables, assertionFromToken, authorizeUrl, clearOAuthToken,
  refreshOAuthToken, saveOAuthToken, storedOAuthToken,
} from './ps-oauth';

const { parseAssertionResponse } = __testables;

describe('ps-oauth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_PS_OAUTH_CLIENT_ID', 'arena-test-client');
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
