# Controlled real-server integration

Run `npm run test:integration` with Node 22.13+ within Node 22 LTS, or Node 24 LTS. The runner clones the official server at **2f5b273925862ac242b419086c1e7a8868b51da1** into a disposable temporary directory, installs its locked runtime dependencies, builds it and runs two instances of this application's actual `ProtocolClient` over loopback SockJS WebSockets. Git/npm network access is needed for setup. To reuse an already prepared disposable checkout at that exact pin, set `ARENA_PS_TEST_DIR=/tmp/arena-controlled-showdown`.

The test-only config binds `127.0.0.1` on an available ephemeral port, disables guest signature checking, throttling and IP checks, and disables REPL, filesystem logging, backdoor access, ratings, replay autosave and upstream requests. `local-server-guard.cjs` is inherited by every worker and rejects external socket connections/fetch. Login/replay destinations additionally point to loopback, and the login service is disabled. This configuration is only for a disposable local test process; never use it for hosting. The runner terminates the server process group in success/failure cleanup and has a 120-second runtime deadline.

The initial bootstrap only creates a private temporary chat room and grants one already connected guest room authority. All challenge, battle and tournament actions then go through real client/server commands. Assertions cover:

- Two guest handshakes, real formats and acknowledged identities.
- Modern structured PM challenge, acceptance and an unrated Gen 9 random battle.
- Six-Pokémon simulator requests, nonzero request IDs, legal choices, a resolved turn and authoritative forfeit/winner events.
- A deterministic Gen 9 Custom Game with two team-preview choices and Cyclizar using Shed Tail: the harness must answer its additional forced-switch request before turn 2 can resolve.
- Private tournament creation, signup, pairing, challenge/acceptance, another real battle and the final tournament result.

Successful evidence is written to ignored `test-results-local-server.json` and uploaded by the required CI job. Local verification on 2026-09-05 passed all assertions on supported Node 24.19.0 (also passed on Node 26.6.0 during investigation, without extending support to that line). This proves protocol interoperability for these workflows; browser rendering, OAuth provider behavior, replay publishing, doubles and reconnect remain separate tests. Do not turn this test into public matchmaking or public chat traffic.

The pinned upstream test server has its own dependency lock outside the shipped application's dependency tree. The initial production-only upstream install reported four advisories (two moderate, one high, one critical); the application lock reported zero after remediation. The test server's runtime isolation and temporary lifecycle do not eliminate the need to review/update the pin and its dependencies. Install only in a disposable CI job without deployment credentials, keep the runtime network guard, and do not reuse this server as a public service.

Update the pin through a reviewed change, retaining upstream source/license attribution and checking changed wire contracts. The confirmed replay contract at this pin is `server/rooms.ts` `uploadReplay`: modern servers upload themselves and return an authoritative URL. Legacy clients use `act=uploadreplay`, `serverid`, `id`, `log` and `password` at the configured login server's `action.php`, as documented by official client `oldclient/client.js` `uploadReplay`. The local `/api/replay` adapter implements that legacy contract; no invented `/api/replays/upload` API is assumed.
