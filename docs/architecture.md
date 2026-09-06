# Architecture

Showdown Arena is a Vite/React browser application connected directly to a Pokémon Showdown-compatible server. Zustand owns client/room state; TanStack Router owns the visible route. `@pkmn/client` derives battle mechanics from protocol, and `@pkmn/data`, `@pkmn/dex` and `@pkmn/img` supply game data and asset lookup.

The [September audit](project-audit-2026-09-05.md) and [July architecture review](architecture-review.md) are historical snapshots. Their findings describe the code at those dates. Consult [implementation status](implementation-status.md), [compatibility](compatibility.md) and current tests for present behavior.

## Ownership

| Directory | Responsibility |
| --- | --- |
| `src/compat/` | Wire framing/transport, OAuth/guest assertions, packed/text teams, notifications |
| `src/protocol/` | Route protocol frames to global state or the owning room |
| `src/rooms/` | Chat, PM and battle room records and lifecycle helpers |
| `src/battle/` | Engine loading, protocol projection, sound |
| `src/data/` | Lazy game-data access and sprite resolution |
| `src/stores/` | Session, selection, rooms, team persistence and display preferences |
| `src/screens/`, `src/components/` | Routed surfaces, decisions, accessibility and reusable controls |
| `src/styles/` | Semantic tokens, surface styles and responsive/reduced-motion rules |
| `src/pwa.ts`, `public/sw.js` | Offline installation, update consent and bounded cache recovery |
| `api/`, `server/proxy.ts` | Fixed-upstream guest assertion and replay Request handlers |
| `server/dev-api.ts` | Node adapter using those same handlers in Vite dev/preview |
| `server/build-artifacts.ts` | Offline asset manifest and source/dependency provenance |
| `e2e/production/` | Built callback/header/proxy/PWA verification |

## Network and trust boundaries

The socket goes straight from the browser to the selected battle server. HTTP endpoints have separate ownership: guest assertions use `/api/action`; registered OAuth uses the configured provider; replay uploads use `/api/replay`; replay downloads, ladder data, sprites/audio and embedded room media contact their configured hosts. See [self-hosting](self-hosting.md) and [privacy](privacy.md).

The APIs accept only specified form fields, reject cross-origin browser requests, bound incoming UTF-8 bytes and outgoing responses, and apply deadlines. They do not forward cookies, arbitrary authorization headers, or upstream response headers. Production responses are inert text with `no-store`. Rate/concurrency enforcement belongs to the hosting platform; the fixed upstream and origin checks are not a general authentication system.

Server HTML passes through DOMPurify with a bounded payload/element count. Safe room/battle navigation and information/poll commands remain interactive; arbitrary account, moderation and battle commands do not. CSS layout is contained by the renderer. CSP permits required external requests/media and custom sockets, but forbids foreign scripts, embedded frames and objects. OAuth callback code is an external same-origin script and clears its query URL after handing the result to its opener.

## State and lifecycle

Room records own chat and battle views. Protocol-derived mechanics belong to the battle engine; local action drafts belong to the client and are submitted against the current request. A visible route, server session and background notification are distinct concepts. Cancellation, reconnect, server change and logout must invalidate work from the previous session. Persistent schemas are versioned and validated before use; failed saves must remain visible and recoverable.

Game data/engine and routed screens are separate chunks. Failure to load a chunk must offer retry/recovery; it must not silently become invented game data. The build's offline manifest preloads local application resources, including team editing and the dex, once installation succeeds. A worker serves its own matching shell, retains at most one previous version for older tabs, and never caches OAuth/API responses. [Offline contract](offline.md).

## Testing and release evidence

Use pure/unit tests for parsers, choices, persistence and failure transitions; browser tests for real input, focus, layout and accessibility; production tests for the built shell and HTTP boundaries. Fixture-based tests should compare the documented upstream behavior and include negative cases that the mock rejects. The opt-in public smoke checks only a guest handshake; controlled battle evidence is needed for mechanics and tournament transitions.

CI checks TypeScript across app/API/browser-test code, lint, dependency advisories/licenses, bundle budgets, desktop/mobile/browser flows, macOS visual baselines and production boundary tests. [Release checklist](releases.md) defines the separate deployed smoke and source-revision checks.
