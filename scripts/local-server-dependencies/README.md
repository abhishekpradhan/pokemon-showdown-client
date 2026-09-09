# Isolated upstream test runtime

This private package exists only for the disposable, loopback-only server used by `npm run test:integration`. It is not bundled, deployed or installed as an application dependency. The MIT-licensed upstream source remains pinned at [6b4bc34e44cc2541929cc4b8fff96e756ab3f268](https://github.com/smogon/pokemon-showdown/tree/6b4bc34e44cc2541929cc4b8fff96e756ab3f268); its original lock is available at that revision. The runner copies this manifest and lock into the temporary checkout, verifies the source revision, installs with `npm ci --omit=dev --omit=optional --ignore-scripts`, then runs only esbuild's required platform-binary installer before building.

All six direct runtime dependency ranges match the pinned upstream manifest. The reviewed lock resolves:

| Package | Version |
| --- | --- |
| esbuild | 0.25.12 |
| mysql2 | 3.24.3 |
| preact | 10.29.8 |
| preact-render-to-string | 6.7.0 |
| sockjs | 0.3.24 |
| ts-chacha20 | 1.2.0 |
| websocket-driver (transitive) | 0.7.5 |
| uuid (SockJS override) | 11.1.1 |

The only range override is `sockjs → uuid@11.1.1`. SockJS 0.3.24's `lib/transport.js` imports `require('uuid').v4()`; UUID 11 retains that CommonJS API and fixes the reported buffer-boundary advisory. The real SockJS handshake, disconnect/reconnect, battle and tournament integration validates that override under Node 24.19.0. Do not accept npm's proposed downgrade to old SockJS to remove a transitive advisory.

The untouched upstream runtime audit reported four findings: [websocket-driver](https://github.com/advisories/GHSA-mp7j-qc5w-4988), [mysql2](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), and [UUID](https://github.com/advisories/GHSA-w5hq-g745-h8pq), including the SockJS dependency path. This reviewed runtime lock reported zero on 2026-09-06 using:

```sh
npm audit --omit=dev --prefix scripts/local-server-dependencies
```

The checked-in lock SHA-256 is `b5fcedeb12ec17f831f4171a4d0353a1aabb3f171c16ea3ef81e4a484111504e`, also recorded in integration evidence and the temporary installation marker. This does not change or clear advisories in upstream's full optional/development dependency tree. Runtime isolation remains required even when the audit is clear. The app's own dependency audit is separate.

Review updates with the [controlled integration procedure](../../docs/testing.md). Keep this manifest private, the source pin explicit, dependency integrity hashes committed, the disposable checkout constraint intact and the server's external network guard enabled.
