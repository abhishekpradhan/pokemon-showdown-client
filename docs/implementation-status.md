# September 2026 audit implementation

The [audit](project-audit-2026-09-05.md) describes the original `f48e68fc` baseline. This document records the subsequent 1.1.0 candidate. Each of its 72 grouped findings has an implementation or an explicit supported-feature boundary below. This is not a claim of unrestricted parity with every official-client feature or every custom server.

## Changes by audit ID

| IDs | Result | Regression evidence |
| --- | --- | --- |
| B01–B04 | Ordered explicit preview confirmation, forced-switch passes, revival and Commander/unavailable slots | Battle adapter integration corpus and move-control tests |
| B05–B07 | Submitted-request locks, server-authoritative cancel/reject/sentchoice recovery; request-based Z/Max targeting and modifiers | Adapter, store and desktop/mobile battle workflows |
| B08 | Singles/doubles capability contract enforced in search/challenge/join and runtime game type; unsupported layouts explain the restriction | Capability fixtures; triples/rotation/multi/FFA remain unavailable |
| B09–B10 | Known moves/PP/stats/item/ability, contextual tooltips/effectiveness, unrevealed roster placeholders; no invented hidden information | Engine projection and information tests |
| B11–B12 | Timer model, semantic event narration, ordered presentation, turn playback/speed/viewpoint/skip, reduced motion, correctly paired sprites | Timer/text/engine tests and browser geometry checks |
| B13 | Closing an active player battle requires an explicit forfeit decision; cancel preserves the session | Store cancellation regression and browser tab-close flow |
| T01 | Lossless packed/text fields, structured saves, legacy ability slots and zero-valued fields | Round-trip team corpus |
| T02–T03 | Durable drafts; truthful failed saves; schema migration/recovery; quota/corruption/concurrent-tab guards | Storage failure, conflict and editor-remount tests |
| T04–T06 | Generation-aware inherited learnsets, IV/DV/stat/details editor, preserved custom entries; local draft checks separated from server validation | Dex/editor tests and validation popup routing |
| T07–T08 | Search/folders/sort/bulk operations, reorder, complete backups/import/recovery, all slots editable, canonical sprites/fallbacks | Team library/component/browser flows |
| S01–S02 | Socket generation guards, bounded replaceable read-only queue; sensitive offline actions fail rather than replay | Transport stale-event and offline/server-switch tests |
| S03–S06 | Cancellable auth operations, separate authorization/confirmation timeouts, atomic token record, cross-tab refresh lock, popup source/origin/path/nonce validation | Auth/OAuth race/cancellation/refresh/callback tests |
| S07 | Server reset clears session state; reconnect init replaces snapshots; closed battle engines released | Store reconnect and lifecycle fixtures |
| S08–S10 | Visible-route focus/unread, PM local reopen/deep links, explicit failed-join explanation and retry | Session regressions and desktop/mobile quality workflows |
| C01–C02 | Server-echo-only messages, retained failed-send drafts, stable reading position/new-message jump, searchable/exportable bounded 2,000-message history | Echo/history/store and browser flows |
| C03 | Safe official/relative links and room/poll/info commands; cached sanitized markup and contained layout | Sanitizer/interactive HTML/browser tests |
| C04–C05 | Searchable roster, ignore/unignore, PM/challenge blocking, staff-report path, offline presence and public room links | Presence/ignore/protocol and profile browser tests |
| C06 | Per-room drafts, multiline limits, Enter/Shift+Enter, input history and tab completion | Shared composer and failed-send/remount browser flows |
| C07 | Timestamps, highlights/mutes, volume/reduced motion, privacy/autojoin preferences; notification permission state and navigation/mobile-worker fallback | Settings/notification tests and browser preference persistence |
| D01 | Contextual challenge dialog, incoming/outgoing state and cancellation, explicit per-match team/format validation | PM protocol fixtures and challenge browser flow |
| D02–D03 | Live-battle directory/filter/rating/sort/paging/refresh, room-name/URL join, favorites/autojoin | Directory and navigation browser checks |
| D04 | Correct challenged/challenging states, team upload before challenge/accept, errors/results and round-robin bracket | Tournament fixtures plus complete controlled real-server tournament |
| R01–R02 | Addressable private/public replays, URL normalization, turn/step/speed/viewpoint, search/recent/bookmarks/import/export and bounded incremental playback | Replay adapter/engine/UI/browser tests |
| R03 | Per-battle concurrent upload tracking, authoritative private/custom URLs, deadlines, actual legacy upload contract | Upload URL/correlation regressions and shared proxy tests |
| R04 | Independent ladder format/query URL state, player lookup, metrics and custom-server ladder query | Ladder adapter/UI/browser fixtures |
| U01–U02 | Single keyboard dispatch, grouped-option order and focus, touch inspections/targets, semantic theme buttons, flexible mobile shell, reduced motion | Combobox tests, axe, keyboard, layout and visual browser gates |
| U03–U05 | Recoverable startup/action errors, drafts and room errors; stable content URLs/legacy redirects; direct name setup and no-team Random Battle entry | Startup/storage/session tests and direct-route browser checks |
| SEC01 | Compatible dependency updates and patched DOMPurify floor; advisory CI gate | npm audit reports zero affected dependencies in the shipped lockfile |
| SEC02 | Private protocol payloads removed at capture time; reviewable diagnostic export; clipboard failures reported | Credential/team/chat/private-ID redaction fixtures |
| SEC03–SEC04 | Shared actual API handlers, streamed byte/deadline bounds, origin/action restrictions, CSP, external callback script, safe rich-content policy | Production proxy, worker and sanitizer tests plus production browser checks |
| SEC05 | Accurate storage, network and service disclosures in Settings and PRIVACY | Documentation/source cross-check |
| PWA01–PWA03 | Correct versioned shell, OAuth/API exclusion, manifest-bounded current/previous caches, user-applied updates/repair, offline team/replay tools | Executable worker lifecycle tests and production offline workflow |
| Q01–Q03 | Required desktop/mobile/Firefox/WebKit/visual/production checks; real production handlers; mocks isolate simulator socket and all workflows fail on page errors | Full browser and release CI gates |
| Q04 | Pinned real upstream server harness with two ProtocolClient users, unrated battle and complete tournament; isolated loopback runtime and drift check | test:integration artifact and scheduled advisory live check |
| Q05–Q06 | API/server/E2E typecheck, bounded histories/queues/caches/closed rooms/profile cache, lazy data with recovery, build budgets | Normal typecheck/build plus lifecycle and long-log fixtures |
| O01–O03 | Current compatibility/architecture/contributor/self-hosting docs, tested LTS Node policy, aligned environment loading and endpoint inventory | Typecheck, build, production boundary and contributor CI |
| O04–O07 | Actionable maintainer/reporting policies, roadmap/release/rollback process, license/source build metadata, pinned least-privilege CI and required release gate | Repository settings, license inventory and release/deployment evidence |

## Verification record

- Integrated TypeScript/ESLint/unit checks passed with 175 tests in 27 files before the final browser-integration pass; the release record will carry the final count.
- The new six social/recovery workflows passed on desktop and mobile (12 checks).
- The pinned real-server run completed guest handshakes, a real unrated battle through turn 2, and a complete private tournament. See [local integration](local-integration.md). Its isolated upstream test dependencies are distinct from the shipped dependency lock.
- Production build and license inventory pass. Initial gzip bundle is within the 300 KiB gate; all shipped assets remain within the documented budgets.
- Private vulnerability reporting, Dependabot alerts/security fixes and secret push protection are enabled on the public repository.
- Full matching-browser matrix, reviewed visual baselines, production deployment/provenance and required-main checks are recorded in the release evidence after the candidate is committed.

## Explicit support limits

Triples, rotation, multi and free-for-all battle layouts are gated; arbitrary custom-server mechanics require an explicit capability implementation. The official provider handles account registration/recovery. Background push, a packaged desktop shell and cloud team sync are not provided. The client retains bounded local history, not a server chat archive. Replays cannot expose private information absent from their protocol log. Automated WebKit/mobile emulation does not replace testing every physical iOS/Android device or a full screen-reader conformance audit. These restrictions are published in [compatibility](compatibility.md), rather than being presented as completed unrestricted feature parity.
