# Architecture

Showdown Arena is a Vite/React single-page application that connects directly to a Pokémon Showdown-compatible server. Zustand owns client and room state; TanStack Router owns the visible route. `@pkmn/client` derives battle mechanics from the protocol, and `@pkmn/data`, `@pkmn/dex` and `@pkmn/img` supply game data and asset lookup.

## Ownership

| Directory                         | Responsibility                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `src/compat/`                     | Wire framing and transport, OAuth and guest assertions, packed/text teams, notifications |
| `src/protocol/`                   | Route protocol frames to global state or the owning room                         |
| `src/rooms/`                      | Chat, PM and battle room records and lifecycle helpers                           |
| `src/battle/`                     | Engine loading, protocol projection, sound and music                             |
| `src/teams/`                      | Set editor fields, official sample sets and EV/nature suggestions                |
| `src/replays/`                    | Replay parsing and metadata                                                      |
| `src/preferences/`                | Avatars, server languages and personal backgrounds                               |
| `src/data/`                       | Lazy game-data access and sprite resolution                                      |
| `src/stores/`                     | Session, selection, rooms, team persistence and display preferences              |
| `src/screens/`, `src/components/` | Routed surfaces, decisions, accessibility and reusable controls                  |
| `src/styles/`                     | Semantic tokens, surface styles and responsive/reduced-motion rules              |
| `src/pwa.ts`, `public/sw.js`      | Offline installation, update consent and bounded cache recovery                  |
| `api/`, `server/proxy.ts`         | Fixed-upstream guest assertion and replay Request handlers                       |
| `server/dev-api.ts`               | Node adapter that runs those same handlers in Vite dev and preview               |
| `server/build-artifacts.ts`       | Offline asset manifest and source/dependency provenance                          |
| `e2e/production/`                 | Built callback, header, proxy and PWA verification                               |

## Design decisions

Three calls from the July 2026 architecture review shaped the current code and still hold:

- **Stay a static SPA with serverless functions; no framework migration.** The app has no server-side data of its own: everything interesting exists only once the WebSocket opens. Server-side rendering would complicate the socket lifecycle and render nothing useful, so React and Vite on Vercel with two Edge handlers is the target shape rather than a stepping stone. If replay or marketing pages ever need to be crawlable, they can be prerendered alongside the SPA.
- **Derive battle state with `@pkmn/client`, not by hand.** The original hand-written adapter re-derived battle state from a fraction of the protocol and produced a whole class of bugs: wrong side assignment, fabricated exact HP, boosts wiped by requests, broken spectating. The maintained engine consumes raw protocol and keeps complete state for every side and viewpoint; the client keeps its React views and choice builder on top. Zustand stayed, reshaped into a room registry and a protocol router so that each room owns its own state.
- **Token-based CSS, with motion in CSS.** Layered semantic tokens and per-surface stylesheets were kept over Tailwind or CSS-in-JS because they were already tested for layout, accessibility and touch. The review flagged the animation library as a candidate for plain CSS; the client now ships no animation library, and reduced motion is honoured in the stylesheets.

The full review is preserved at the [`v1.2.0` tag](https://github.com/abhishekpradhan/pokemon-showdown-client/blob/v1.2.0/docs/architecture-review.md).

## Network and trust boundaries

The socket goes straight from the browser to the selected battle server. HTTP endpoints have separate ownership: guest assertions use `/api/action`; registered OAuth uses the configured provider; replay uploads use `/api/replay`; replay downloads, ladder data, sprites, audio and embedded room media contact their configured hosts. See [self-hosting](self-hosting.md) and [privacy](privacy.md).

The API handlers accept only specified form fields, require a same-origin `Origin` header (browsers send it on every POST; scripts must add it), bound incoming UTF-8 bytes and outgoing responses, and apply deadlines. They do not forward cookies, arbitrary authorization headers or upstream response headers. Production responses are inert text with `no-store`. Rate and concurrency limits belong to the hosting platform; the fixed upstream and origin checks are not an authentication system.

Server HTML passes through DOMPurify with a bounded payload and element count. Safe room and battle navigation and information/poll commands stay interactive; arbitrary account, moderation and battle commands do not. CSS layout is contained by the renderer. CSP permits the required external requests, media and custom sockets, and forbids foreign scripts, embedded frames and objects. The OAuth callback is an external same-origin script that clears its query URL after handing the result to its opener.

## State and lifecycle

Room records own chat and battle views. Protocol-derived mechanics belong to the battle engine; local action drafts belong to the client and are submitted against the current request. A visible route, a server session and a background notification are distinct concepts. Cancellation, reconnect, server change and logout invalidate work from the previous session. Persistent schemas are versioned and validated before use, and failed saves stay visible and recoverable.

Game data, the engine and routed screens are separate chunks. A chunk that fails to load offers retry or recovery; it never silently becomes invented game data. The build's offline manifest preloads local application resources, including the team editor and the dex, once installation succeeds. The service worker serves its own matching shell, retains at most one previous version for older tabs, and never caches OAuth or API responses. See [offline](offline.md).

## Testing

Pure unit tests cover parsers, choices, persistence and failure transitions; browser tests cover real input, focus, layout and accessibility; production tests cover the built shell and HTTP boundaries; and a pinned local server covers real battles, reconnects and tournaments. Fixture-based tests compare against documented upstream behaviour and include negative cases that the mock rejects. [Testing](testing.md) describes each tier and how to run it.
