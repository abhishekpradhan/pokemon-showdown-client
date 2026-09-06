# Controlled real-server integration

Run from the repository root with supported Node 22.13+ in the Node 22 LTS line, or Node 24 LTS:

```sh
npm run test:integration
```

The runner clones the official server at [6b4bc34e44cc2541929cc4b8fff96e756ab3f268](https://github.com/smogon/pokemon-showdown/tree/6b4bc34e44cc2541929cc4b8fff96e756ab3f268) into a disposable temporary directory. It installs the reviewed [test runtime lock](../scripts/local-server-dependencies/README.md), builds the server, and runs this application's actual `ProtocolClient` over loopback SockJS WebSockets. Git/npm network access is needed only for setup. To reuse a prepared disposable checkout at that exact pin, set `ARENA_PS_TEST_DIR=/tmp/arena-controlled-showdown-parity`; its runtime-lock hash must match. The updated integration has been run on Node 24.19.0. Node 26 is not supported.

The test config binds `127.0.0.1` on an ephemeral port, disables guest signature checking and IP checks, and disables REPL, filesystem logging, backdoors, ratings, replay autosave and upstream requests. Battles run without command throttling; the profile scenario enables the upstream guest queue and restores fast mode afterward. The inherited `local-server-guard.cjs` rejects external socket connections and all `fetch` calls in the server and every worker. A separate negative test exercises three socket signatures and fetch, before any network access. Login/replay routes point to loopback and the external login service remains disabled. Do not reuse this config for hosting, provide deployment credentials to the test process, or turn it into public matchmaking/chat traffic.

The profile regression seeds a known avatar, occupies the guest command queue, and sends an avatar change followed by both user-details query spellings. Exempt `/cmd userdetails` must expose the previous avatar before the change; queued `/query userdetails` must return the new avatar afterward. This exercises actual server timing without replacing queue methods or timers. A separate `/language french` command confirms the server's `updateuser` metadata contract.

The runner terminates clients and the server process group on success, failure, exit or termination signals. The running server has a 120-second deadline; the isolated stress process has a separate 30-second timeout. Setup/build time is outside that runtime deadline and bounded by the CI job. The bootstrap creates one private temporary tournament room and grants a local guest room authority. The only publication stub replaces the replay backend; battle, privacy and tournament commands still go through the real server handlers.

## Real protocol coverage

- Guest handshakes, real formats, exact identity acknowledgements, structured PM challenge/acceptance, an unrated Gen 9 random battle, legal request IDs, resolved choices and authoritative winner events.
- A deterministic Cyclizar/Shed Tail battle: both team previews and the additional mid-turn forced switch must be answered before turn 2. The original negative harness that skipped this request failed, so this is a required behavior check.
- An active doubles connection dropped with a request outstanding, followed by fresh identity and complete room/request snapshots. A disconnected private choice is rejected instead of queued; new explicit target choices resolve after reconnect.
- Doubles `+1/+2` targets; Gen 6 triples edge-target rejection, legal adjacency and `shift` resolving as `swap`; four-seat multi `p3` Helping Hand at ally `-1`; four-seat free-for-all `p3` attacking opponent `p1` at `-1`. Each player owns six private roster entries and the correct one-, two- or three-slot request.
- Four-seat invitations accept through public `/accept` for `p3` and direct `/acceptbattle` for `p4`; both seats must receive their own request and resolve their choices. The public alias dispatches the server's stored invitation action.
- Private tournament creation, both signup acknowledgements, pairing, challenge/acceptance, a real battle and tournament completion.

`gen9doublescustomgame` and `gen6triplescustomgame` are official formats. Multi and free-for-all use two named test-only formats extending the official Gen 9 Custom Game rules with the simulator's `multi`/`freeforall` game types. They test the official simulator and actual four-player invitation flow; they are not claims that identical formats are available in the public ladder. Rotation is not covered because no supported upstream format/action was identified.

## Authentication and replay boundaries

The temporary HTTP provider exercises the real OAuth helper through token refresh, two serialized concurrent refreshes, old-token rejection, a fresh challenge assertion, revocation, expiry and local token removal. The provider's account, token and signature are synthetic; this verifies the published HTTP/storage lifecycle, not real registered identity, browser popup behavior or a cryptographic signature. Official-provider account approval and logout must still be checked separately with a consenting registered account.

Focused authentication regressions additionally defer grants/assertions and inject old-account profile updates before and after `/trn`. Only the requested named identity completes that attempt; unrelated updates preserve its timeout and errors, rejected or cancelled attempts cannot appear successful, and a replacement attempt rejects the previous identity acknowledgement. The account-dialog regression checks this interaction and focus restoration in the browser.

The legacy `/api/replay` adapter makes an actual HTTP request to the loopback provider using `act=uploadreplay`, `serverid`, `id`, `log` and `password`. Assertions preserve the private replay identifier, require `no-store`, exclude unrelated cookies/authorization, and reject cross-origin requests and redirects before publication. The modern server's real `/hidereplay` and `/savereplay` handlers pass hidden status and a generated password to an in-process `addreplay` backend stub. The server's returned URL then passes through the actual client replay parser without losing its private suffix. No replay is published externally and no production replay database is involved.

These contracts come from the pinned server's `server/rooms.ts` `uploadReplay` and the MIT-licensed official client's `oldclient/client.js` `uploadReplay`: modern servers upload and return the authoritative URL; legacy clients upload through `action.php`. No invented replay endpoint or guessed popup URL is tested.

## Recorded corpus and longer sessions

The integration writes `test-results-local-corpus.json` with twelve synthetic player-perspective recordings. To deliberately refresh the checked-in corpus after reviewing a successful integration run:

```sh
node scripts/record-local-corpus.mjs
npx vitest run src/protocol/recorded-corpus.test.ts
```

The recorder accepts battle-scoped synthetic local traffic, excludes authentication/global frames and HTML, and normalizes numeric room IDs. Retained protocol lines are otherwise verbatim, with exact upstream provenance in `src/test/fixtures/protocol-corpus.json`. The twelve regressions feed the actual parser/store/engine, check field and private-request ownership, and replay each initialization to verify replacement rather than duplicated history. Never import a public or user recording into this fixture: request payloads contain private teams.

The integration also runs `node scripts/test-session-stress.mjs`, which can run alone without a server. One warmup and three measured deterministic sessions each process 13,963 frames: sustained messages and named HTML updates in two rooms, 320 transient room/PM pairs, 320 user cards, 200 reconnect snapshots and 320 failed joins followed by successful recovery. Assertions bound chat/log history, raw protocol logs, retained rooms and user cards; successful rooms leave no empty error entries, failures retain at most the last 32, and recovery removes its failure.

The benchmark uses actual application stores in an isolated 256 MiB V8 heap, forcing GC while session state remains alive. Regression budgets are 48 MiB additional retained heap, 16 MiB growth across repeated sessions and 2,500 ms per 500-message batch at p95. These deliberately broad budgets catch regressions across CI machines; they are not product latency targets. On 2026-09-06, Node 24.19.0 retained 8.68–8.70 MB against a 7.63 MB warm baseline, with −5,000 bytes repeat growth and 21.19–21.97 ms batch p95. Browser DOM/GPU memory, background-tab throttling, audio, and hours of live battle-engine traffic are outside this synthetic benchmark.

## Evidence and pin review

`test-results-local-server.json` contains the exact server/source revisions, source-dirty marker, runtime-lock hash, transport, scenario checks and embedded stress measurements. The required CI integration job uploads this report. Standalone stress metrics also appear in `test-results-session-stress.json`. Generated reports are local artifacts, not source fixtures.

The prior approved baseline used server `2f5b273925862ac242b419086c1e7a8868b51da1` and passed four original workflow groups on clean client `6cce11bda6b21aae72ed61e66c3fd975754da1e3` under Node 24.20.0. The current pin retains all four groups and adds reconnect, four layouts, private replay, local OAuth and session bounds; the expanded run passed on 2026-09-06. This comparison does not imply that new scenarios passed against the old pin. The new upstream commit raises its runtime minimum to Node 22 and TypeScript target to ESNext.

The original upstream runtime lock's audit reported four findings: one critical (`websocket-driver`), one high (`mysql2`), and two moderate (`uuid` and its `sockjs` dependency path). Advancing the source pin alone does not fix that lock. The separately reviewed runtime resolution upgrades compatible ranges and overrides only SockJS's UUID dependency; its final runtime audit reported zero on 2026-09-06. It is distinct from the shipped app lock and does not claim that all upstream optional/development dependencies are free of advisories. See the [runtime rationale and exact audit command](../scripts/local-server-dependencies/README.md).

Update the source pin and runtime lock through review, preserve upstream license attribution, compare wire contracts and rerun all existing scenarios. Never remove network guards, relax expected protocol errors or downgrade the transport to silence an audit.
