# Remaining parity implementation (1.2)

This follows the historical [September audit](project-audit-2026-09-05.md) and [1.1 implementation record](implementation-status.md). [Issue #11](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/11) tracks release acceptance. The exact shipped commit and CI/deployment evidence belong in the release notes.

| Area | Implementation | Verification |
| --- | --- | --- |
| Competitive sets | Explicit official sample lookup, trusted bounded/abortable requests, format/species matching, source preview, apply/undo and preserved personal/manual fields | Real-source schema and negative fixtures; all-browser editor persistence/undo flows |
| EV/nature inference | Pinned upstream MIT BattleStatGuesser, typed generation data, level-aware preview and guarded undo; clearly described as a heuristic | Offensive/defensive/low-level/older-generation cases and manual override workflows |
| Battle layouts | Triples adjacency and Shift; four-seat multi/FFA ownership, signed targeting, sprites, per-seat projection, invitations and requests | Engine/adapter corpus, desktop/touch geometry and controlled real-server choices/reconnect |
| Profile | Public trainer catalog with numeric alias resolution; actual server avatar/language acknowledgements, retry and reconnect reapplication | Store protocol transitions and browser selection/confirmation tests |
| Language | The official client's server-language preference with twelve choices and server/room-language semantics | Validated persisted settings and authoritative updateuser metadata; Arena's interface remains English |
| Appearance | Built-in backdrops and local PNG/JPEG/WebP upload up to 1 MB in IndexedDB, removal, errors/deadlines and readable solid controls | Upload/reload/remove and unavailable-storage/browser checks |
| Audio | Separate effects, notification and music volumes; master mute retains values; optional official battle music with one active stream, bounded cry cache and gesture/visibility/navigation/end lifecycle | Media lifecycle tests and settings persistence/browser verification |
| Reliability | Expected-identity OAuth acknowledgement and preserved login failures; no preference-ack room-rejoin loop; bounded room-error retention; expanded recorded protocol/long-session corpus; isolated OAuth/replay and real-server scenarios | Type/lint/unit/browser and controlled integration/stress gates |
| Maintainability | Extracted sample/spread/advanced editor, preference components, background persistence, audio lifecycle and local-server scenario modules | Focused ownership boundaries, source/attribution docs and unchanged release protections |

The integration-only server dependency lock is distinct from the shipped application's lock. See [local integration](local-integration.md) for its exact upstream pin, compatible overrides, loopback isolation and audit evidence.

## External acceptance and deliberate boundaries

- [Registered production account acceptance (#13)](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/13) needs the account owner to complete official sign-in. Controlled token rotation/expiry/revocation tests do not stand in for that observation.
- [Physical-device and screen-reader acceptance (#12)](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/12) needs available hardware and assistive-software testers. The [manual checklist](manual-acceptance.md) records the unverified matrix honestly.
- [Rotation (#14)](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/14) stays gated because the reviewed upstream simulator has no playable rotation protocol. Implementing a client-only rule would not make it work on the server.

These remaining items have owners and concrete acceptance criteria. Neither browser emulation nor a successful handshake proves full official-client parity. Account registration and password recovery remain on the official provider website. Cloud team synchronization, a packaged desktop client and background push are outside this standalone client release contract.
