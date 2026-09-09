# Self-hosting

Build with a supported Node version (24, or 22.13+) and the committed lockfile. On Vercel, the site is `dist/` plus the two `api/` Edge handlers, and `vercel.json` supplies SPA routing and the security and cache headers. Other hosts need an equivalent adapter for the exported Web Request handlers and an SPA fallback. Never expose a Vite development server as a production host.

## Configuration

Copy `.env.example` to `.env.local` for development. Vite explicitly loads config-time server variables for dev/build/preview. Existing shell variables take precedence over env files. `VITE_*` variables are compiled into the browser and must never contain secrets; changes require rebuilding. `PS_*` upstream variables belong to the server deployment.

| Setting | Purpose |
| --- | --- |
| `VITE_PS_SERVER_HOST`, `PORT`, `PREFIX`, `SECURE`, `ID` | Default socket server; runtime server selection may override it |
| `VITE_PS_ACTION_URL` | Browser's guest assertion endpoint, normally `/api/action` |
| `PS_LOGIN_SERVER` | Fixed action.php upstream for `/api/action` and legacy `/api/replay` uploads |
| `VITE_PS_OAUTH_CLIENT_ID` | Provider-registered public client ID for this exact origin |
| `VITE_PS_SPRITE_HOST` | Sprite/icon/audio host |
| `VITE_PS_LADDER_HOST` | Ladder service, independent of the socket host |
| `VITE_PS_OAUTH_ROOT` | OAuth provider API root; defaults to the official provider |
| `VITE_PS_REPLAY_SERVER` | Replay read/link origin; defaults to the official replay service |
| `VITE_PS_LOGIN_SERVER` | Public login service identity associated with the default socket |
| `VITE_SOURCE_URL` | Repository URL used for deployed source provenance |
| `VITE_PS_AUTOCONNECT` | Disable automatic connection for offline UI development |
| `VITE_ENABLE_DEMO_FIXTURES` | Explicit opt-in demo data for UI work |

Custom OAuth and replay providers are supported through the same variables; keep the provider, guest action proxy, replay links and ladder consistent with the selected server. Changing the socket address alone does not configure an independent account, ladder or replay service. Check the endpoint module and [compatibility](compatibility.md) before offering a custom server to users.

## OAuth origins

Request a public client ID through the [official provider instructions](https://github.com/smogon/pokemon-showdown-loginserver/blob/master/OAUTH.md). The registered scheme, host and port must match the app's origin. Localhost, a stable preview hostname and production are separate origins; use a registration appropriate to each. Ephemeral preview URLs do not inherit production authorization. Without a valid client ID the client offers guest naming and explains that registered login is unavailable.

Serve `/oauth.html` and `/oauth-callback.js` as actual static files, never as SPA fallback. The callback is no-store/no-referrer, external-script only, and forwards a state-bound result to its opener. Reverse proxies must preserve these headers and serve the proper JavaScript/HTML content types.

## Local server and other hosting

A local server normally uses an explicit address such as `ws://localhost:8000/showdown`. Use the protocol supported by that server. Browsers block insecure mixed-content sockets from HTTPS pages; host the local client over HTTP for local-only development or give the server TLS. Keep production pages and their service endpoints on HTTPS/WSS.

Both Vite dev and preview execute the actual API handlers through `server/dev-api.ts`, including validation and security headers. Another production host can implement the same adapter, or use a compatible reverse proxy that preserves the bounded validation contract. It must not forward arbitrary user-supplied upstream URLs or log bodies. Ensure fixed upstreams are correct before enabling a deployment.

Configure hosting-level request limits, rate/concurrency limits, operational alerts and rollback. The form-origin check deters browser cross-site abuse but is not a distributed rate limiter. CSP allows required HTTP(S)/WS(S) custom endpoints; deployments with fixed hosts can tighten connect/media/image directives after testing.

## Verify a deployed build

Check that `/build-info.json` identifies the intended source revision, `/oauth.html` is the callback, `/api/action` rejects GET and cross-origin POST, and responses carry the expected CSP and cache headers. Confirm a guest handshake, origin-registered OAuth where available, a controlled battle, the configured replay URL and upload, and offline team editing after the worker installs. Verify an update from the previous deployed version and keep that deployment available for rollback. See [releases](releases.md).

Run the guest handshake through the actual deployed assertion proxy from the repository with supported Node:

```sh
LIVE_PS_TESTS=1 LIVE_APP_URL=https://showdown-arena.vercel.app npm run test:live
```

Replace the URL with your application's HTTPS origin. Credentials, paths, queries and fragments are rejected; HTTP loopback origins are allowed for local verification. The script sends `/api/action` the same Origin header as the browser, fails on HTTP errors such as 502, and requires the simulator to acknowledge the signed ephemeral guest name. It sends no chat or matchmaking commands; it only joins the lobby to check read access. If a custom simulator is configured, supply the matching `VITE_PS_SERVER_HOST`, `VITE_PS_SERVER_PORT`, `VITE_PS_SERVER_PREFIX` and `VITE_PS_SERVER_SECURE` as shell variables. The script does not load `.env.local` or bypass hosting deployment protection.

Without `LIVE_APP_URL`, `LIVE_PS_TESTS=1 npm run test:live` contacts `PS_LOGIN_SERVER` (or the official login server) directly. That mode remains an advisory upstream check and cannot verify a deployed proxy. Neither mode completes registered OAuth authorization or a battle; verify those separately as described above.
