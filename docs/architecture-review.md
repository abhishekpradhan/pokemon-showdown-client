# Architecture Review — July 2026

A top-down review of the stack and architecture, written before the next round
of UX and feature work. The goal it is measured against: **a modern,
independently hosted open-source client on Vercel that talks to real Pokémon
Showdown servers.**

## Verdict

Three calls, argued below:

1. **The deployment architecture is right. Do not migrate to Next.js.**
   A realtime WebSocket client with no server-side data of its own is exactly
   what a static SPA plus serverless functions is for. SSR would complicate the
   socket lifecycle and render nothing useful.

2. **The hand-rolled battle/protocol layer is the weak floor. Replace it with
   `@pkmn/client`.** Every protocol bug shipped so far — wrong side
   assignment, opponent HP shown as exact, boosts wiped by requests, and
   spectating being broken today — is the same root cause: 2,500 lines of
   ours re-deriving state that a maintained engine already derives correctly.

3. **The UX problems are a model problem before they are a polish problem.**
   The app has four competing answers to "what do I have open?". Until there
   is one session model, screen-level polish will keep feeling rough.

## Where the codebase stands

| Layer | Size | State |
| --- | --- | --- |
| `compat/battle-adapter.ts` | 1,160 lines | Handles 39 of ~150 protocol messages |
| `stores/arena-store.ts` | 1,103 lines | One store: connection, login, formats, search, rooms, chat, battles, choices, teams, errors |
| `compat/protocol-client.ts` | 263 lines | Solid: framing, reconnect, send queue |
| Shell bundle | ~190 kB gz | Dex lazy at 345 kB gz, learnsets lazy at 417 kB gz |
| Tests | 46 unit, 86 e2e, live smoke | Protocol handshake, layout, a11y, touch all gated |

### Evidence that the battle layer is the wrong floor

The bug history is the argument. Each of these shipped, looked plausible, and
was only caught by playing live battles:

- Side assignment defaulted to p1 until a `|request|` arrived, so as p2 the
  opponent's nameplate was populated from our own Pokémon.
- The opponent's percentage HP was rendered as exact (`100/100`).
- Each turn's `|request|` rebuilt the team and erased our own stat boosts,
  while the opponent's (never rebuilt) persisted.
- **Spectating is broken right now.** `BattleRoomMode` has a `'spectator'`
  value that nothing ever assigns for a live room — only replays hardcode it.
  Joining a battle via *Watch* renders the watcher as player 1: player-waiting
  copy in the action deck, fabricated exact HP for whichever side happens to
  be p1, no spectator affordance at all.

These are not four bugs; they are one design decision — re-deriving battle
state by hand — producing a bug class. Message coverage (39/~150) means the
class keeps paying out: end-of-turn effects, Future Sight, Wish, forme changes
mid-turn, doubles positions, and ~110 other messages currently render as
nothing.

`@pkmn/client` (with `@pkmn/protocol`) is the maintained extraction of the
official client's battle engine — the same lineage as the `@pkmn/dex` data we
already adopted. It consumes raw protocol and maintains complete battle state:
sides, positions, volatiles, field, spectator perspective included. We keep
our React views and our choice builder; we delete our projection.

Cost: pre-1.0 API (0.7.x), estimated +40–60 kB gz (verify in the spike), and a
migration. Benefit: the entire bug class closes, spectating and doubles fall
out correct, and ~900 lines of our most defect-dense code are deleted.

### Evidence that the store shape is the second floor

`arena-store.ts` keys **seven parallel maps** by room id (`rooms`, `battles`,
`choiceSessionByRoom`, `choiceDraftByRoom`, `choiceErrorByRoom`,
`battleModeByRoom`, `lastRequestByRoom`) and dispatches the protocol inside a
~300-line `switch` embedded in state updates. Every new feature must thread
all seven maps correctly or leak state across rooms. This is the shape that
bred the side-assignment and request-wipe bugs.

The fix is structural, not a library change: a **room registry** — one
`Room` union (`ChatRoom | BattleRoom | PmRoom`) owning its own state — and a
**protocol router** that dispatches lines to the owning room. Zustand stays;
the slices become per-domain (session, directory, rooms, battles, teams).

### Evidence that the UX model is the third floor

"What do I have open?" is currently answered by four different surfaces:

1. The session sidebar (battles + rooms)
2. The mini room rail on the home screen ("Open activity")
3. The notifications popover (lists "recent sessions")
4. Per-screen joined-room lists (Rooms screen)

Pokémon Showdown's own model is one thing: **a room tab bar**. Users bring
that mental model. The redundant surfaces are why the app reads as
"non-intuitive or unnecessary" even where individual screens are fine. The
rework is: one persistent session strip (tabs), fixed app surfaces (Battle,
Teams, Ladder, Replays, Settings) as destinations, everything else deleted.

## The stack, layer by layer

| Layer | Current | Considered | Call |
| --- | --- | --- | --- |
| Framework | React 19 + Vite 7 SPA | Next.js App Router | **Keep SPA.** See below. |
| Hosting | Vercel static + functions | — | **Keep.** Already the target shape. |
| Login proxy | Node serverless fn | Edge runtime | **Move to Edge.** Pure fetch pass-through; cuts cold start. |
| Routing | TanStack Router | file-based routes | **Keep as is.** Working; convention migration is churn without payoff. |
| State | Zustand | Redux/Jotai | **Keep Zustand, reshape.** The problem is shape, not library. |
| Battle state | Hand-rolled adapter | `@pkmn/client` | **Replace.** The headline change. |
| Game data | `@pkmn/dex` `data` `img` | — | **Keep.** Adopted earlier, correct. |
| Styling | Layered token CSS | Tailwind v4, CSS-in-JS | **Keep.** Tokens + per-surface files are tested (layout, a11y, touch). Revisit only if a full design-system overhaul demands it. |
| Data fetching | `fetch` + abort | TanStack Query | **Keep fetch.** Three HTTP endpoints total; Query is overhead here. |
| Animation | `motion` | CSS only | **Keep, audit usage.** 41 kB gz for current usage is heavy; candidates to go CSS. |
| Testing | Vitest + Playwright + axe + live smoke | — | **Keep, add transcript replay tests** (below). |
| Compiler | — | React Compiler | Optional, later. Auto-memoization; low risk, low urgency. |

### The Next.js question, answered directly

What Next.js would buy: SSR/RSC, file routing, image optimization, ISR,
middleware. What this app is: a persistent-WebSocket client whose entire
meaningful state lives in a live session with a third-party server.

- There is nothing to server-render — no crawlable content, no per-request
  data of ours. The interesting state does not exist until the socket opens.
- SSR complicates exactly the thing that must be robust (socket lifecycle,
  stores bound to it).
- Image optimization is counterproductive on pixel-art sprites served from
  PS's CDN.
- API routes are not a differentiator — Vercel serves our `api/` functions in
  a Vite repo identically.

Verdict: migrating would be modernity theater. If we later want crawlable,
sharable replay pages or a marketing page with OG images, add those as
prerendered pages alongside the SPA — that is additive, not a rearchitecture.

## Target architecture

```
        WebSocket (psim or custom server)
                    │
         protocol-client (keep)
                    │
            protocol router          ← one dispatcher, replaces switch-in-store
                    │
             room registry           ← Room = ChatRoom | BattleRoom | PmRoom
              │           │
      ChatRoom state   BattleRoom → @pkmn/client Battle   ← replaces adapter
                    │
             view stores (zustand slices)
                    │
        one session strip + fixed surfaces (React)
```

## Plan

Phased so every step ships green and the UX rework starts from a floor that
does not move.

**Phase 0 — Transcript safety net (small).**
Capture full battle logs (singles, doubles, a spectated join, a replay) as
fixtures. One test: feed each through the projection, snapshot the final
state. This is the harness that makes the next two phases safe, and it
outlives them.

**Phase 1 — Protocol router + room registry (mechanical).**
Split `arena-store` into slices behind unchanged component APIs; collapse the
seven maps into `Room` objects; move the protocol `switch` into a router.
No behavior change intended; existing 132 tests plus Phase 0 fixtures hold.

**Phase 2 — Battle engine swap (the payoff).**
Spike `@pkmn/client` against the Phase 0 fixtures first (API fit, bundle
cost). Then: `BattleRoom` owns a `@pkmn/client` Battle; our views read from
it; the adapter's projection (~900 lines) is deleted; the choice builder
stays. **Spectating works as the acceptance test** — join a live battle via
Watch and see it correctly from a spectator's seat. Doubles positions come
along for free.

**Phase 3 — One session model (the UX unlock).**
Persistent room tabs; delete the mini rail, the sessions-in-notifications,
and the per-screen joined lists. Then screen-by-screen polish rides on the
existing layout/a11y/touch gates.

**Phase 4 — Missing table-stakes features.**
Challenge/accept flow, teambuilder set editor (dex-backed search), battle
timer from `|inactive|`, sanitized rich chat, replay save/share. Each lands
on the new floor instead of the old one.

## Explicitly not doing

- Next.js / RSC migration — argued above.
- tRPC or GraphQL — we own no backend beyond a proxy.
- Monorepo split — 7 k lines does not need workspace overhead.
- Component-library swap — Radix primitives are fine and accessible.
- CSS framework adoption mid-rework — the token system is tested; churn now
  would fight Phase 3.

## Risks

- `@pkmn/client` is pre-1.0. Mitigation: Phase 2 opens with a fixture-driven
  spike before any wiring; if it fails the fit test, fallback is keeping the
  adapter and continuing to grow coverage — the phases before and after do
  not depend on the swap.
- Bundle growth from the engine. Mitigation: measure in the spike; the dex
  precedent (lazy chunk) applies if needed.
- Phase 1 is a large mechanical diff. Mitigation: it is deliberately
  behavior-neutral and the full suite plus transcript fixtures gate it.
