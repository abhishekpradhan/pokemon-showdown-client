# Contributing

Thanks for helping out. This is a standalone client for Pokémon Showdown
servers — it is not the official client and does not track it.

## Getting set up

```bash
npm ci
npm run dev
```

Requires Node 20+ (22 recommended — the live smoke test uses the built-in
`WebSocket`).

## Before opening a pull request

```bash
npm run check     # typecheck + lint + unit tests
npm run test:e2e  # browser tests
```

CI runs the same commands plus a production build. Lint runs with
`--max-warnings 0`; warnings are errors here.

## The one rule that matters

**Protocol compatibility is the constraint everything else bends around.** We
do not run a server. If the client stops speaking the wire protocol correctly,
it stops working entirely, and no amount of interface polish compensates.

So, for anything touching `src/compat/`:

- Say in the PR how you verified it. "Tests pass" is not enough on its own —
  the suites are mocked, and a mock that agrees with a wrong assumption will
  agree with it forever. That is exactly how a completely broken login once
  shipped green.
- Run the live smoke test:

  ```bash
  LIVE_PS_TESTS=1 npm run test:live
  ```

- If you change the handshake, matchmaking, or choice submission, actually play
  a battle against a real server and say so.

When you fix a protocol bug, make the mock in `e2e/mock-ps.ts` reject the wrong
behaviour too. A test that could not have failed is not coverage.

## Style

There is no separate style guide; match the surrounding code. A few things
that are specific to this repo:

- **Never guess at game data.** Move types, species typings, sprite filenames
  and the type chart come from `src/data/dex.ts` and `src/data/sprites.ts`,
  which wrap `@pkmn`. String-matching a move name to infer its type is how
  "Knock Off" ended up rendering as a Normal-type move.
- **CSS is layered.** `src/styles/tokens.css` owns colour, spacing and motion;
  each surface owns one file; `src/styles.css` is imports only and its order is
  the cascade order. Do not hardcode a colour — if a token is missing, add one.
- **Subscribe to slices.** Components select the store fields they use via
  `useShallow`. Subscribing to the whole store re-renders the app on every
  protocol frame.
- Comments should explain why, especially where the protocol is surprising.

## Licence

AGPL-3.0-or-later. By contributing you agree your work is licensed under it.

If you deploy a modified version publicly, the AGPL requires you to offer users
the corresponding source. Keep the source link in Settings pointing at your
fork.
