# Security policy

## Report privately

Use GitHub's [private vulnerability report form](https://github.com/abhishekpradhan/pokemon-showdown-client/security/advisories/new). The repository owner, [@abhishekpradhan](https://github.com/abhishekpradhan), is responsible for triage.

If GitHub does not offer that form, open an issue titled **Private security contact requested** containing only a request for a private channel. Do not include vulnerability details, tokens, private logs, exploit payloads or affected users. The maintainer must establish the private channel before receiving those details. Report abusive GitHub accounts through GitHub's own abuse-reporting tools as needed.

Include the build revision from Settings or `/build-info.json`, affected route, browser, reproduction and expected impact. Aim to acknowledge reports within 7 days and provide a triage update within 14 days; these are volunteer-maintainer targets, not a guaranteed response service. Coordinate disclosure after a fix and advisory. If there is no response, repeat the contact request without exposing the report.

## Supported versions and scope

The latest published stable release and current `main` are maintained. Older releases receive a backport only when the maintainer explicitly announces one; users should upgrade. Pending releases and their limitations are recorded in [CHANGELOG.md](CHANGELOG.md) and [docs/releases.md](docs/releases.md).

Security-sensitive boundaries include:

- OAuth popup binding, operation cancellation, token rotation and local storage. Password entry happens only on the configured OAuth provider, not in this client.
- Guest assertion and replay proxies: fixed server-side upstreams, bounded byte streams, origin/method/form-field checks, timeouts, no response caching and no request-body logging.
- Protocol diagnostics and exports: private messages, teams, challenges, assertions and private replay links require explicit handling.
- Server-supplied rich HTML and commands: DOMPurify, safe navigation/read/poll actions, bounded payloads, CSS containment and CSP.
- Persisted team schemas/migrations and the versioned service worker: cache recovery must never erase saved teams or credentials.
- Dependency integrity, deployment headers and source/version provenance.

Vulnerabilities in Pokémon Showdown's server/login infrastructure should go to [Smogon's security process](https://github.com/smogon/pokemon-showdown/security).

## Deployment controls

`vercel.json` defines production CSP and security headers. The policy permits HTTP(S) requests and WS(S) connections for explicitly configured custom servers; normal browser mixed-content rules still apply. Scripts remain same-origin, frames/objects are blocked, and inline styles remain supported for React and room content. Development alone permits Vite's inline refresh preamble.

Both proxies reject browser cross-origin form submissions. Clients without an Origin header remain supported; this is not user authentication or a global rate limiter. Deployers must configure platform request/concurrency limits for their traffic and review abuse alerts. Never turn the upstream into a client-supplied URL. Never expose secrets through `VITE_` variables.

Dependency advisories gate CI and are reviewed by the owner. Keep fixes within compatible ranges where possible, review changes, and run the affected security/protocol/UI tests. See [release controls](docs/releases.md). The maintainer must verify remote private reporting, branch protection and secret-scanning settings; the existence of this file does not enable those settings.
