# Testing

Showdown Arena is tested in tiers, from unit tests to a real Pokémon Showdown server running on loopback. Every tier runs from the repository root on Node 24 (or 22.13+) after `npm ci`; browser tiers also need `npx playwright install chromium firefox webkit` once (add `--with-deps` on Linux).

## Tiers

| Command                                                          | What runs                                                                                              | What it covers                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                  | TypeScript for the app, API handlers and test code; ESLint with zero warnings; Prettier check; Vitest | Parsers, choices, persistence, failure transitions and the recorded protocol corpus                              |
| `npm run test:e2e`                                               | Playwright against `npm run dev` on :5173; projects `chromium`, `mobile` (Pixel 7), `firefox`, `webkit` | Real input, focus, layout, axe accessibility and every user workflow against a mocked simulator                 |
| `npm run test:visual`                                            | `e2e/visual.spec.ts` on the `chromium` and `mobile` projects                                           | Desktop and mobile screenshot baselines, recorded and compared on macOS                                          |
| `npm run test:production`                                        | Playwright against `npm run preview` on :4173; run `npm run build` first                               | Production headers and API boundaries, OAuth callback isolation under CSP, worker updates and offline editing    |
| `npm run test:integration`                                       | A pinned Pokémon Showdown server on loopback, plus the session stress run                              | Real handshakes, battles in every implemented layout, reconnects, tournaments, OAuth and replay contracts        |
| `LIVE_PS_TESTS=1 npm run test:live`                              | An opt-in guest handshake against a real server                                                        | Public protocol drift; advisory only                                                                             |
| `npm run test:stress`                                            | Deterministic high-volume sessions with no server                                                      | Bounded room, chat, log and profile state, retained heap and frame-processing time                               |
| `npm run check:licenses`                                         | License metadata of the locked dependencies                                                            | New or missing license expressions                                                                               |
| `npm run audit:dependencies`, `npm run audit:dependencies:all`   | npm advisories                                                                                         | High-severity advisories in shipped dependencies (blocking); every severity across the whole tree (advisory)      |

CI runs `check` and `check:licenses` on Node 22 and 24, the four browser projects on Ubuntu, the visual baselines on macOS, the production checks, the integration run and the dependency audit on every pull request and push to `main`, and requires all of them for a release. The live handshake runs on pushes to `main` and on the daily schedule, which otherwise runs only the audit.

Useful variations:

- `npm run test:e2e -- --project=chromium` runs one browser. Firefox and WebKit skip the visual spec automatically; CI passes `--grep-invert 'visual baseline'` on Linux so the macOS baselines are not compared there.
- `npm run test:visual -- --update-snapshots` rewrites baselines. Review the actual and diff images first, and never update a baseline to hide a regression.
- The browser tests replace every WebSocket with the mock in `e2e/mock-ps.ts`, and any page error fails the test.

## Protocol changes

Test against what the official client actually does, using fixtures from the pinned upstream baseline. When fixing a protocol bug, first change the mock so it rejects the wrong behaviour, then add a regression for the real transition. Cover singles and doubles, player and spectator, and affected generations where relevant. A mock that shares the same false assumption is not independent evidence.

For connection, authentication or protocol changes also run `npm run test:integration`. `LIVE_PS_TESTS=1 npm run test:live` is an extra public guest-handshake check when network access is available; it proves the handshake, not a battle. Never use rated public battles or public chat as automated test traffic.

### Recorded corpus

The integration run writes `test-results-local-corpus.json` with twelve synthetic player-perspective recordings. To refresh the checked-in corpus after reviewing a successful run:

```sh
node scripts/record-local-corpus.mjs
npx vitest run src/protocol/recorded-corpus.test.ts
```

The recorder keeps battle-scoped synthetic local traffic, drops authentication and global frames and HTML, and normalises numeric room IDs; retained lines are otherwise verbatim, with their provenance in `src/test/fixtures/protocol-corpus.json`. The twelve regressions feed the real parser, store and engine, check field and private-request ownership, and replay each initialisation to verify replacement rather than duplicated history. Never import a public or user recording into this fixture: request payloads contain private teams.

## The pinned server

`npm run test:integration` clones [smogon/pokemon-showdown](https://github.com/smogon/pokemon-showdown) at revision `6b4bc34e44cc2541929cc4b8fff96e756ab3f268` into a disposable temporary directory, installs the reviewed [runtime lock](../scripts/local-server-dependencies/README.md), builds the server and runs the application's real `ProtocolClient` over loopback SockJS WebSockets. Git and npm network access is needed only for setup. To reuse a prepared checkout at that exact pin, set `ARENA_PS_TEST_DIR` to a directory under the system temp directory; its runtime-lock hash must match.

The test configuration binds `127.0.0.1` on an ephemeral port, disables guest signature and IP checks, and disables the REPL, filesystem logging, backdoors, ratings, replay autosave and upstream requests. `scripts/local-server-guard.cjs` rejects external socket connections and every `fetch` call in the server and its workers; `npm run test:integration:guard` checks the guard itself before any network access. Two test-only formats extend the official Gen 9 Custom Game rules with the simulator's `multi` and `freeforall` game types; they exercise the real four-player invitation flow without claiming those formats exist on the public ladder. Do not reuse this configuration for hosting, give the test process deployment credentials, or point it at public matchmaking or chat.

The run covers:

- Guest handshakes, real formats, exact identity acknowledgements, structured PM challenges, an unrated Gen 9 random battle, legal request IDs, resolved choices and authoritative winner events.
- A deterministic Cyclizar/Shed Tail battle where both team previews and the mid-turn forced switch must be answered before turn 2.
- A doubles connection dropped with a request outstanding, followed by fresh identity and complete room and request snapshots; a disconnected choice is rejected rather than queued.
- Doubles, Gen 6 triples (edge-target rejection, adjacency, `shift`), four-seat multi and free-for-all targeting, per-seat private rosters, and seat invitations through `/accept` and `/acceptbattle`.
- Private tournament creation, signups, pairing, challenge and acceptance, a real battle and completion.
- A profile scenario that seeds an avatar, occupies the server's guest command queue and confirms avatar and language changes through the server's own user-details responses.
- The real OAuth helper against a temporary HTTP provider (refresh, concurrent refresh, old-token rejection, revocation, expiry) and the legacy `/api/replay` adapter plus the modern `/savereplay` and `/hidereplay` handlers, with no replay published externally.
- The session stress run, which processes tens of thousands of frames across rooms, PMs, user cards, reconnect snapshots and failed joins and asserts bounded state and retained heap.

The synthetic OAuth provider verifies the HTTP and storage lifecycle, not a real registered identity or the browser popup; those stay with [#13](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/13). `test-results-local-server.json` records the server revision, runtime-lock hash, transport, scenario checks and stress measurements, and CI uploads it; the report is a local artifact, not a source fixture.

### Bumping the pin

1. Change `revision` in `scripts/test-local-server.mjs` to the reviewed upstream commit.
2. Update `scripts/local-server-dependencies/package.json` and its lockfile so the direct runtime ranges match the new upstream manifest, keeping the `sockjs → uuid` override unless upstream no longer needs it. Run `npm audit --omit=dev --prefix scripts/local-server-dependencies` and record the result and the new lock SHA-256 in that directory's README.
3. Compare the wire contracts the scenarios depend on (for example `server/rooms.ts` `uploadReplay`), rerun `npm run test:integration`, and refresh the recorded corpus if protocol lines changed.
4. Keep the network guard, the expected protocol errors and the transport as they are; never relax them to silence an audit.

## Manual acceptance

Playwright's mobile Chromium and WebKit projects are emulation, not phones. Two checks stay manual and are tracked as open issues:

- [#12](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/12): physical iPhone and Android devices, and VoiceOver and NVDA sessions, across navigation, the account dialog, team editing, battle controls, preferences, background/resume and installed offline use.
- [#13](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/13): registered-account acceptance on the production login service, from official sign-in and avatar/language confirmation through logout and reauthorisation.

Record the build revision, date, OS and browser versions and device with every result, use a dedicated account and private rooms, and record only pass/fail observations. Rotation battles are gated until the server offers a playable protocol ([#14](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/14)).
