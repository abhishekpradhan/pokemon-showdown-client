# Security policy

## Report privately

Use GitHub's [private vulnerability report form](https://github.com/abhishekpradhan/pokemon-showdown-client/security/advisories/new) for this repository. [@abhishekpradhan](https://github.com/abhishekpradhan) triages reports. This is also the private contact channel for confidential support or conduct matters; [SUPPORT.md](SUPPORT.md) and the [code of conduct](CODE_OF_CONDUCT.md) point here.

If the form is unavailable, open an issue titled **Private security contact requested** that asks only for a private channel. Do not include vulnerability details, tokens, private logs, exploit payloads or affected users until the private channel is established.

Include the build revision (Settings → About, or `/build-info.json`), the affected route, the browser, reproduction steps and the expected impact. Never post OAuth tokens, `.env.local`, private replay URLs or unredacted protocol logs. The aim is to acknowledge reports within 7 days and give a triage update within 14 days; these are volunteer targets, not a guaranteed response service. Disclosure is coordinated after a fix and advisory. If there is no response, repeat the contact request without exposing the report.

## Supported versions and scope

The latest published release and current `main` are maintained. Older releases receive a backport only when one is explicitly announced; upgrade instead. Release status is recorded in [CHANGELOG.md](CHANGELOG.md).

Security-sensitive boundaries in this client:

- OAuth popup binding, operation cancellation, token rotation and local storage. Passwords are entered only on the configured OAuth provider, never in this client.
- The guest assertion and replay proxies: fixed server-side upstreams, bounded byte streams, origin/method/form-field checks, timeouts, no response caching and no request-body logging.
- Protocol diagnostics and exports: private messages, teams, challenges, assertions and private replay links are redacted at capture time.
- Server-supplied rich HTML and commands: DOMPurify, safe navigation/read/poll actions, bounded payloads, CSS containment and CSP.
- Persisted team schemas, migrations and the versioned service worker: cache recovery must never erase saved teams or credentials.
- Dependency integrity, deployment headers and source/version provenance.

Vulnerabilities in Pokémon Showdown's own server or login infrastructure belong with [Smogon's security process](https://github.com/smogon/pokemon-showdown/security).

## Deployment controls

`vercel.json` defines the production CSP and security headers. The policy permits HTTP(S) requests and WS(S) connections to explicitly configured custom servers, keeps scripts same-origin, blocks frames and objects, and allows inline styles for React and room content. Only development permits Vite's inline refresh preamble.

Both proxies require a same-origin `Origin` header on every POST. Browsers send it automatically; scripted callers such as the opt-in live smoke must set it explicitly. That check is a speed bump against use of a deployment as an anonymous relay, not authentication or a rate limiter, so deployers should configure platform request and concurrency limits for their traffic. Never turn the upstream into a client-supplied URL, and never expose secrets through `VITE_` variables.

Dependency advisories gate CI: high-severity advisories in shipped dependencies block, and every severity across the whole tree is reported daily. Keep fixes within compatible ranges where possible and run the affected security, protocol and UI tests. See [docs/releases.md](docs/releases.md).
