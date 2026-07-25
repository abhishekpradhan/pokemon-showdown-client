# Showdown Arena

A modern, standalone battle client for [Pokémon Showdown][ps] servers.

It speaks the Showdown wire protocol, so it connects to the public server — or
any PS-compatible one — and plays real, rated battles. It is not a server: it
talks to one.

Play rated ladder battles, challenge players directly, spectate live games,
review replays, chat in the full room directory, and build teams in a
dex-backed editor — in the browser.

Built with React 19, TypeScript and Vite, with battle state maintained by
[`@pkmn/client`](https://github.com/pkmn/ps), the maintained extraction of the
official client's engine. Deploys to Vercel as static assets plus two small
Edge functions (login and replay-upload proxies).

  [ps]: https://pokemonshowdown.com/

---

## Quick start

```bash
npm ci
npm run dev
```

That's it — the client connects to `sim3.psim.us` by default. Open
<http://localhost:5173>, pick a name, and queue for a battle.

To point at your own server, copy `.env.example` to `.env.local` and edit it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :5173, with the login proxy wired up |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build on :4173 |
| `npm run check` | Typecheck + lint + unit tests |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests: flows, layout, accessibility |
| `npm run test:live` | Handshake smoke test against a **real** server |

`test:live` is opt-in via `LIVE_PS_TESTS=1` because it touches a live service.
Run it before releasing — the mocked suites cannot catch a change in the real
handshake.

## How it connects

Two separate channels, and the difference matters:

**Battles and chat** go over a WebSocket straight from the browser to the
battle server. No proxy, nothing in the middle.

**Logging in** goes through `/api/action`, a same-origin endpoint this project
provides. Showdown's login server (`action.php`) sends no CORS headers, so a
browser on any other origin cannot call it directly. Both the Vite dev server
and [`api/action.ts`](api/action.ts) forward to it, so development and
production share one code path.

The handshake itself:

1. Server sends `|challstr|`.
2. Client asks the login server to sign the name — `act=getassertion` for an
   unregistered name, `act=login` with a password for a registered one.
3. Client sends `/trn <name>,0,<assertion>`.
4. Server confirms with `|updateuser|`.

Step 2 is not optional. A `/trn` without an assertion is rejected with
*"Your authentication token was invalid."*

## Layout

```
api/          Edge functions (login + replay-upload proxies)
src/
  battle/     @pkmn/client engine wrapper and view projection
  compat/     Wire protocol: framing, requests/choices, teams, login
  protocol/   The router: frames → global handlers or owning room
  rooms/      The registry: ChatRoom | PmRoom | BattleRoom
  data/       Pokédex, sprites, type chart (@pkmn)
  stores/     Client state (zustand)
  screens/    Routed surfaces
  components/ Shared UI
  styles/     Layered CSS — tokens first, one file per surface,
              touch.css last (it must outrank per-surface sizing)
e2e/          Playwright specs and the mock server
scripts/      Live smoke test
```

### Game data

Species, moves, items, abilities, the type chart and sprite resolution come
from [`@pkmn`][pkmn], the maintained extraction of Showdown's own data. The
client does not guess at game facts.

The dataset is large, so it loads as its own chunk after the app shell
(~150 kB gzipped) rather than blocking first paint. Learnsets are a further
lazy chunk, fetched only if something asks for them.

  [pkmn]: https://github.com/pkmn/ps

## Deploying

Push to a Vercel project. `vercel.json` covers the build, the SPA rewrite and
security headers; no dashboard configuration is required.

The one setting worth knowing is `PS_LOGIN_SERVER`, a server-side variable that
sets which login server `/api/action` forwards to. It defaults to the official
one.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `npm run check` must pass, and
anything touching `src/compat/` should say how it was verified against a real
server.

## Licence and attribution

AGPL-3.0-or-later — see [LICENSE](LICENSE).

This project began as a fork of the [official Pokémon Showdown client][client]
by Guangcong Luo and contributors, and remains AGPL-licensed accordingly. The
interface has since been rewritten; what carries forward is protocol
compatibility.

Pokémon and Pokémon character names are trademarks of Nintendo. This project is
not affiliated with or endorsed by Nintendo, Creatures, GAME FREAK, or Smogon.

  [client]: https://github.com/smogon/pokemon-showdown-client
