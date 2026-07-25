# Security Policy

## Reporting a vulnerability

Report security issues privately to the repository owner rather than opening a
public issue. Include reproduction steps, the affected route or module, browser
and version, and whether it affects production, preview deployments, or local
development only.

Please allow time for a fix before public disclosure.

## Scope

The security-sensitive surfaces of this client are:

- **`api/action.ts`** — the login proxy. Request bodies carry passwords and
  assertions. It forwards to a fixed, server-side-configured upstream, never
  logs bodies, and marks responses `no-store`. Anything that could turn it into
  an open proxy, cache a credential, or leak a body is in scope.
- **`src/compat/login-server.ts`** — assertion handling. Assertions are
  single-use credentials; they must not be persisted or logged.
- **`src/compat/protocol-client.ts`** — the socket. The protocol log redacts
  `challstr` and `/trn` assertions, and is off by default in production.
- **Chat and battle log rendering** — server-supplied text is rendered as text.
  Introducing HTML rendering without sanitisation would be a vulnerability.
- **`src/compat/team-store.ts`** — team data in `localStorage`.

Out of scope: vulnerabilities in the Pokémon Showdown server or its login
service. Report those to [Smogon][smogon].

  [smogon]: https://github.com/smogon/pokemon-showdown/security

## Deployment notes

- Never commit a `.env` file. `PS_LOGIN_SERVER` is server-side only; anything
  prefixed `VITE_` is compiled into the client bundle and is public.
- `vercel.json` sets `nosniff`, `X-Frame-Options: DENY`, a referrer policy, and
  `no-store` on `/api/*`. Keep those when changing the config.

## Source availability

This project is licensed under AGPL-3.0-or-later. If you deploy a modified
version publicly, you must offer users the corresponding source for the version
they are interacting with. The Settings screen carries a source link — point it
at your fork.
