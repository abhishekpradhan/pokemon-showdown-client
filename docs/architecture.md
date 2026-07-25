# Architecture

Why the client is put together the way it is. For how to run it, see the
[README](../README.md). For the July 2026 top-down review and the phased
modernization plan (battle-engine swap, room registry, session model), see
[architecture-review.md](architecture-review.md).

## The shape of the problem

This is a thin client for a stateful server we do not control. That single fact
drives most decisions:

- **The protocol is the contract.** Everything else is replaceable; wire
  compatibility is not.
- **The server is the source of truth.** The client projects server state for
  display. It never simulates battles, and it must not invent facts the server
  did not send.
- **Traffic is a firehose.** Battle events, lobby chat and roomlists arrive
  continuously. Anything on the render path pays that cost repeatedly.

## Layers

```
  screens/ components/     React surfaces
        stores/            client state (zustand)
        compat/            wire protocol
        data/              game data (@pkmn)
```

Dependencies point downward. `compat/` knows nothing about React; `data/` knows
nothing about the protocol.

### `compat/` — the protocol

- `protocol-client.ts` — WebSocket lifecycle, framing, reconnect backoff, and a
  send queue so messages composed while offline are not lost.
- `login-server.ts` — the `action.php` handshake.
- `battle-adapter.ts` — projects protocol messages into the battle state the UI
  renders, and builds `/choose` commands.
- `team-store.ts` — import/export of packed and exported team formats.

### `data/` — game facts

Wraps [`@pkmn`][pkmn], the maintained extraction of Showdown's own data.

The client used to infer game facts from strings — move types from move names,
sprite filenames from species names. This cannot be made correct by adding
special cases, because the underlying mappings are arbitrary: "Knock Off" is
Dark, `Pikachu-Original` is `pikachu-original.gif`, `Urshifu-Rapid-Strike` is
`urshifu-rapidstrike.gif`. Look it up or do not show it.

`effectiveness()` returns `null` rather than `1` when the dex has not loaded, so
callers can hide a hint instead of rendering a wrong one.

  [pkmn]: https://github.com/pkmn/ps

### `stores/` — client state

`arena-store.ts` holds connection, rooms, battles and teams;
`workspace-store.ts` holds display preferences.

Components subscribe to slices with `useShallow`. Subscribing to the whole
store re-renders the entire tree on every protocol frame.

## Decisions worth knowing

### The login proxy

Showdown's login server sends no `Access-Control-Allow-Origin` header, so a
browser on any origin other than `play.pokemonshowdown.com` cannot call it.
A standalone client therefore *has* to proxy it — this is not a convenience.

`/api/action` is that proxy: a serverless function in production, a Vite proxy
in development, one code path in the client. Its upstream is fixed server-side,
so it is not an open proxy, and it never logs request bodies because they carry
passwords and assertions.

Battle traffic does **not** go through it — the WebSocket connects directly.

### Loading the dex

The dataset is ~1.8 MB (345 kB gzipped) and learnsets another 3.2 MB. Blocking
first paint on that is unacceptable, and bundling it into the shell is worse.

`loadDex()` fires at boot and resolves into module state; accessors return
`undefined` until it lands. Because a battle can open before the chunk
resolves, the store keeps the last raw `|request|` per room and re-derives when
the dex is ready. Learnsets stay a separate lazy chunk — do not name them in
`manualChunks`, or Rollup flattens both into one 5 MB download.

### HP is asymmetric

The server tells you your own exact HP (`155/281`) and only a percentage for
the opponent. `PokemonSet` models this directly: `hp` is always a percentage,
`currentHp`/`maxHp` are present only for your own side in a battle you are
playing — spectating and replays get percentages for both, because that is all
those logs contain. Showing a fabricated exact number would be a lie, and
"100/100" reads exactly like one.

### Requests describe a side, not a battle

`|request|` carries your species, HP, moves and PP. It carries no stat stages,
volatiles or Terastallization — those are only ever learned from protocol
lines. So `battleFromRequest` merges rather than replaces: rebuilding the team
wholesale from each turn's request erased your own boosts while the opponent's,
never rebuilt from a request, persisted.

### Which side is ours

`playerSide` comes from `|player|` matched against the logged-in username,
because that arrives before the switches that populate the field, whereas the
first `|request|` may not. A stale assumption here does not fail loudly — it
quietly renders the opponent's nameplate from our own Pokémon.

### Styling

Layered plain CSS. `styles/tokens.css` owns the palette and scales; each
surface owns a file; `styles.css` is imports only and its order is the cascade
order.

There is no CSS framework. Tailwind was a dependency for a while without a
single utility class being used, while its reset fought the hand-written rules.

The stylesheet previously contained two complete design systems stacked on top
of each other, which is worth remembering: the failure mode was not dead code,
it was rules that *half*-applied. A leftover responsive rule from the abandoned
layout silently broke the battle inspector at laptop widths.

## Testing

Four tiers, and the distinction matters:

| Tier | Runs against | Catches |
| --- | --- | --- |
| Vitest | pure functions | parsing and state-projection logic |
| Playwright | `e2e/mock-ps.ts` | UI flows and regressions |
| `layout` + `a11y` specs | rendered pages | collapsed layout, overflow, contrast, landmarks, tap sizes |
| `test:live` | a **real** server | handshake drift |

`layout.spec.ts` and `a11y.spec.ts` exist because CSS breaks silently: the
page still renders, nothing throws, and only a person looking at the right
screen notices. Both were written after changes of exactly that kind shipped,
and both caught real bugs the moment they were added.

The mock must reject what a real server rejects. When it did not — it accepted
`/trn` with no assertion — a client that could not log in at all shipped with a
green suite, and the live smoke test agreed, because it only checked that
*some* `|updateuser|` arrived rather than a named one.

The lesson generalises: a mock encodes your assumptions, so it confirms your
mistakes. When fixing a protocol bug, teach the mock to fail on it.

## Known gaps

- No battle animations or sound; the field renders state, not choreography.
- Doubles/VGC target selection works but is not visually mapped to positions.
- The teambuilder edits sets as text and does not validate against format
  rules — the server rejects invalid teams at match time.
- `applyBattleProtocolLine` covers switches, damage, status, stat stages,
  volatiles, hazards, weather, terrain, reveals and end conditions — the
  messages that change what the field shows — but not all ~150. Adopting
  `@pkmn/client` for complete battle state is the natural next step.
- Chat renders as plain text; no HTML messages, no `/raw` support.
- No challenge/accept flow: matchmaking is ladder search only.
- Tournaments are not implemented.
- The teambuilder has no set editor beyond text import/export.
