# Showdown Arena project audit

Audit date: 5 September 2026. Local revision: `f48e68fc1b72ef1394b279996ec9f4e3e4bb8aa1`.

The project has a credible foundation, but it is not yet a dependable replacement for the original client. The biggest gaps concern preserving teams, completing legal battle choices, recovering sessions, and making supported functionality explicit. Visual polish matters, but these correctness issues should lead the next release.

This report contains **72 grouped backlog items** covering confirmed defects, missing upstream functionality, and project maturity improvements. It is a broad audit, not a claim that every possible protocol interaction has been certified. Priorities reflect user impact; an optional upstream feature need not be copied if the project deliberately excludes it and communicates that scope.

## Scope and evidence

The review covered the tracked application, protocol and engine adapters, persistence, API handlers, configuration, tests, CI, documentation, and contribution policies. Parallel reviews examined battle correctness, product parity, and open-source/security readiness. Targeted probes exercised actual code without modifying application behavior.

The reproducible feature comparison uses local `upstream/master` at [`ac7d535b28574ea3b48d5a4d1fbf6ca399abf469`, 22 August 2026](https://github.com/smogon/pokemon-showdown-client/tree/ac7d535b28574ea3b48d5a4d1fbf6ca399abf469). Both the original client and newer upstream panels were consulted. This is a pinned comparison, not a claim that upstream stopped changing on that date.

| Check | Result | Practical limit |
| --- | --- | --- |
| TypeScript and ESLint | Passed | API and E2E TypeScript are outside the checked TS projects; both are linted. |
| Unit suite | 74 passed across 12 files | Existing coverage misses reproduced request, persistence, and keyboard failures. |
| Production build | Passed | Largest emitted chunks: dex 1.82 MB raw / 345 kB gzip; learnsets 3.20 MB / 417 kB gzip. These are chunk sizes, not a measured first-load total. |
| Browser suite | 116 passed, desktop and mobile, including visual baselines | Used installed Chromium build 1234 through a temporary config; repository requested build 1217 was initially unavailable. Original tests and expectations were unchanged. This does not establish Firefox/Safari behavior. |
| Manual browser inspection | Home, teams, mock battle and 390px mobile view rendered | Mock fixtures, not live rated battles. A mobile overlap was visible despite passing layout tests. |
| Targeted probes | Reproduced lossy team import/export, double keyboard dispatch, incomplete choices, transport races, a null-storage boot crash and incorrect offline shell selection | Some requests and browser services are synthetic; additional recorded server transcripts and production-browser checks should establish their combinations and frequency. |
| npm dependency audit | 11 affected package entries: 1 critical, 7 high, 1 moderate, 2 low | Advisory presence is not proof that an exploitable path exists in this application. See SEC01. |

The browser mock replaces every WebSocket, including Vite's HMR socket. Inspection captured JSON parse errors in `/@vite/client` when it received Showdown frames. These are test-harness errors, not evidence of an application production crash; the tests currently do not fail on them. See Q03.

Not exercised: live rated battles, a real registered-account OAuth grant, private replay upload, installed-PWA upgrade/offline behavior, real-device Safari/Firefox, screen-reader sessions, or load/soak tests. Remote branch protections, private vulnerability reporting, security scanning settings and deployed environment configuration were not inspected. No application fixes, deployment changes, public issues, or messages to other users were made.

## Existing strengths to preserve

- React/TypeScript with useful domain types, a room registry, and an upstream-derived battle engine.
- Unit, flow, accessibility and screenshot tests, plus a scheduled opt-in live handshake check.
- A lockfile, Dependabot, production build CI, and documented local development commands.
- DOMPurify-backed rich HTML handling, fixed upstream proxy targets, several security headers, and an OAuth UI that keeps passwords on Showdown's origin.
- License and attribution, a source link in the running app, contribution/security/conduct documents, CODEOWNERS, and structured issue/PR templates.
- Working starting points for singles/doubles, team editing, chat/PMs, spectating, replay loading, ladder display, sound, tournaments, notifications and installability. Several are partial; they should not be described as completely absent.

## What should lead the work

1. **Protect player data and identity:** T01–T03, S01–S06, SEC01–SEC02.
2. **Make every advertised battle choice completable:** B01–B08 and B13, with authoritative rejection/reconnect behavior.
3. **Repair ordinary workflows:** U01, S08–S10, C01–C02, D01 and D04.
4. **Enforce those guarantees:** Q01–Q05, plus PWA and production-path coverage.
5. **Expand competitive information, team tools and discovery:** B09–B12, T04–T08, C03–C07, D02–D03, R01–R04.
6. **Publish clear support and maintenance commitments:** O01–O07, alongside measured accessibility/performance work.

## Feature coverage compared with upstream

| Area | Current state | Main remaining gap |
| --- | --- | --- |
| Guest and registered identity | Guest assertion flow and OAuth implementation | Cancellation, timeout and reconnect races; deployment setup; account workflows. |
| Singles | Basic play works in fixtures | Preview eligibility, submitted-choice locking, rejection recovery, revival. |
| Doubles/VGC | Multiple active slots and target picker exist | Reserve exhaustion, Commander, preview ordering, transformed targeting. |
| Older generations and alternative game types | Formats can appear in selectors | Gen-aware editing, modifier correctness, triples/multi/FFA, explicit supported-format boundaries. |
| Battle information | HP, types, boosts, basic tooltips and narration | Contextual stats/PP/moves, accurate effectiveness, complete event narration and timers. |
| Teambuilder | Local CRUD and text/packed import/export | Lossless fidelity, drafts, IVs/details, format legality, organization and complete backups. |
| Matchmaking/challenges | Basic search and direct challenges | Compatible per-format teams, outgoing status/cancel, richer challenge options. |
| Rooms/PMs | Directory, chat feed, user cards, tabs | PM lifecycle, unread/delivery correctness, roster, discovery, moderation and composition tools. |
| Tournaments | Signups banner and tree bracket | Correct incoming challenge state/team upload, full tournament lifecycle and round-robin. |
| Spectating/replays | Join battle and paste URL/log viewer | Complete battle browser, replay discovery, addressable replays, turn/speed/viewpoint controls. |
| Ladder | Format table | Server-correct lookup, arbitrary player search, broader metrics and results. |
| Settings/accessibility | Theme, sound, notifications; axe/layout checks | Complete keyboard behavior, touch inspection, visibility/preferences, device/browser coverage. |
| PWA | Manifest and shell worker | Correct shell selection, upgrades, bounded caches and verified offline contracts. |
| Open source | Core policies/templates/checks exist | Accurate docs, release process, reporting contacts, support/compatibility policy and enforced gates. |

## Backlog guide

**P1:** address before the next release advertised as dependable for affected workflows. **P2:** core parity, usability or engineering work after/alongside those repairs. **P3:** planned expansion or maturity work, with explicit product decisions.

**Reproduced** means a browser or targeted code probe demonstrated the behavior. **Source-confirmed** means the implementation establishes the issue, but the complete live interaction was not exercised. **Parity gap** identifies an absent/partial product workflow; manual server commands may still provide some underlying capability. **Improvement** is a recommendation, not an assertion of a proven failure.

Source references below use repository paths and one-based lines at the audited revision. They may shift after fixes.

## Battle correctness and information

### B01 · P1 · Repair team-preview selection and ordering

**Reproduced / parity gap.** Preview reuses the switching bench, which disables `pokemon.active`. Feeding the checked-in player preview fixture makes Garchomp active before the battle starts, so that lead cannot be selected. When explicit size fields are absent, the choice builder defaults to one selected Pokémon and ignores game type, `|teampreview|` count and Illusion requirements; it already honors `chosenTeamSize` and `maxChosenTeamSize` when supplied.

Evidence: `src/screens/battle-screen.tsx:261`, `src/components/team-bench.tsx:21`, `src/battle/engine.ts:134`, `src/compat/battle-adapter.ts:433`; upstream `play.pokemonshowdown.com/src/battle-choices.ts:650`.

Done when preview has request-specific eligibility, ordered selection/deselection/reordering, visible progress and confirmation, and fixtures cover singles, VGC brought subsets, doubles leads and full-team order.

### B02 · P1 · Complete doubles replacement when reserves run out

**Reproduced.** With `forceSwitch:[true,true]` and only one healthy reserve, selecting it leaves `complete:false` and no command. The remaining slot cannot choose a used, active or fainted Pokémon, and no pass is offered. Pass filling handles only `forceSwitch:false`.

Evidence: `src/compat/battle-adapter.ts:595`, `:669`; upstream `battle-choices.ts:235`, `:373` handles reserve exhaustion.

Done when legal replacement/pass combinations complete, including choosing which empty position receives the sole reserve.

### B03 · P1 · Support Revival Blessing requests

**Reproduced.** The request type does not model `reviving`, and the bench and choice validator reject the fainted Pokémon that the move requires selecting.

Evidence: `src/compat/battle-adapter.ts:126`, `:672`, `src/components/team-bench.tsx:21`.

Done when revival requests expose the correct eligible fainted targets and submit valid choices without weakening ordinary switch validation.

### B04 · P1 · Handle Commander and unavailable active slots

**Reproduced.** A commanding Tatsugiri produces an empty draft instead of a leading pass. Normalization keeps non-null active entries regardless of `commanding` or fainted status; automatic passes only recognize null entries.

Evidence: `src/compat/battle-adapter.ts:412`, `:589`; upstream `battle-choices.ts:363`, `:676`.

Done when Commander, fainted/absent actives and one-survivor doubles requests skip only the positions that cannot act.

### B05 · P1 · Lock a submitted request against additional choices

**Reproduced.** Submitting the same single move twice with `activeIndex:0` succeeds twice and produces `/choose move 1, move 1|2`. Controls are still enabled while waiting, and the builder does not reject completed drafts.

Evidence: `src/screens/battle-screen.tsx:127`, `:247`, `src/compat/battle-adapter.ts:630`, `:684`.

Done when the UI, store and builder all reject further actions on the submitted `rqid`, including rapid clicks, keyboard repeats and stale UI events.

### B06 · P1 · Model rejection, cancellation and submitted-choice recovery

**Source-confirmed.** `callback` and `sentchoice` are unhandled. Errors do not repair the pending request/draft; every request starts a new draft. Undo sends `/undo`, while local reset does not cancel the server's choice. Trapped/disabled callbacks and cancellation restrictions are not fully represented.

Evidence: `src/protocol/router.ts:588`, `:654`, `src/stores/arena-store.ts:837`, `:850`.

Done when drafting, submitted, cancellation-pending, rejected and synchronized states are explicit; authoritative callbacks, `sentchoice`, stale `rqid`, `maybeTrapped` and `maybeDisabled` have fixtures.

### B07 · P1 · Make Z/Max move controls and targeting reflect the request

**Source-confirmed.** Z availability is inferred only from move 1. An eligible later move cannot expose the toggle. The deck displays base moves even after a modifier is selected, and ongoing Dynamax is missed when `maxMoves` exists but `canDynamax` is false. Base disabled/target information can then drive transformed choices.

Evidence: `src/components/move-controls.tsx:15`, `src/compat/battle-adapter.ts:460`, `:581`, `src/screens/battle-screen.tsx:108`.

Done when names, availability, power, targets and per-move legality use the selected/current transformation, with old-generation and ongoing-Dynamax fixtures.

### B08 · P1 · Declare and enforce supported battle formats

**Source-confirmed / parity gap.** UI perspectives only model p1/p2; p3/p4 player lines fall into the p1 branch. Targets are hardcoded to two positions on each side, and triples shift has no control. Generic format discovery can present capabilities the client cannot reliably play.

Evidence: `src/compat/battle-adapter.ts:78`, `:397`, `src/rooms/types.ts:89`, `src/battle/engine.ts:161`, `src/protocol/router.ts:549`.

Done when unsupported formats are clearly identified before play. Full support requires game-type/controlled-side/partner models, position-aware targets and adjacency, triples shift, and multi/FFA tests. Do not use format visibility as evidence of compatibility.

### B09 · P2 · Restore competitive battle intelligence

**Source-confirmed / parity gap.** Projection drops known moves/PP, request stats, earlier items and condition counters; the UI also lacks calculated speed ranges. Tooltips show base stats; effectiveness and move facts are largely static and can mislead with known Levitate/Air Balloon, dynamic moves or a chosen doubles target. Stellar Tera is treated as ordinary replacement defensive typing.

Evidence: `src/battle/engine.ts:105`, `:192`, `src/components/battle-tooltip.tsx:114`, `src/compat/battle-adapter.ts:465`, `src/screens/battle-screen.tsx:101`; compare upstream `battle-tooltips.ts`.

Done when projection retains public/own knowledge, contextual calculations are generation-aware, unknown facts remain unknown, and combatant/bench inspection works on keyboard and touch.

### B10 · P2 · Distinguish unrevealed Pokémon from an incomplete roster

**Reproduced.** A synthetic transcript with `|teamsize|p2|6` and one revealed Pokémon has engine `totalPokemon=6` but known `team.length=1`; roster pips report one of one remaining. This affects formats such as random battles where the full roster is not revealed upfront.

Evidence: `src/battle/engine.ts:170`, `src/components/battle-field.tsx:140`.

Done when total slots, known members and fainted members are separate and unrevealed slots remain visible without invented species.

### B11 · P2 · Use one authoritative timer model

**Source-confirmed.** `inactive` updates separate room state without feeding the engine; the next projected line can overwrite `battle.timerOn`. The timer chip counts down while enabled without consistently modeling submitted/ended decisions.

Evidence: `src/protocol/router.ts:521`, `src/battle/engine.ts:219`, `src/components/battle-timer.tsx:12`.

Done when the chip and controls agree and accurately handle running, waiting, paused, submitted and ended states, player identity and available total/turn clocks.

### B12 · P2 · Complete narration and battle presentation

**Source-confirmed / parity gap.** The text parser omits many protocol events, discards damage sources and describes weather upkeep as starting weather. A burst replaces one `lastEvent` repeatedly, so the rendered presentation may show only the final event. Spectating has no pause/turn navigation/viewpoint controls and move animation remains minimal.

Evidence: `src/compat/battle-text.ts:14`, `:28`, `:58`, `src/protocol/router.ts:574`, `:707`, `src/components/battle-field.tsx:80`.

Done when key events and causes are understandable from the UI, ideally using upstream battle-text behavior, and presentation has an event queue with speed/skip/reduced-motion controls. Full move animation and music can follow correctness and readable narration.

### B13 · P1 · Handle closing an active player battle correctly

**Source-confirmed.** Tab close immediately sends `/leave` and hides the room. `cantleave` and `allowleave` are not handled, so the view can disagree with server membership during an active battle.

Evidence: `src/components/session-tabs.tsx:35`, `src/stores/arena-store.ts:469`; upstream old-client battle leave handling.

Done when player/spectator/ended states differ appropriately, server refusal remains visible, and leaving/forfeiting has clear consequences and authoritative completion.

## Teams and persistence

### T01 · P1 · Make team import, export and save lossless

**Reproduced.** `Pikachu (M) @ Light Ball` imports with species `M`. Gender/happiness are not roundtripped, including happiness zero. Every editor save passes structured data through this lossy text conversion. Legacy packed ability codes become literal ability names. Hidden Power type, Poké Ball and Dynamax/Gigantamax fields are absent from the model/packing.

Evidence: `src/compat/team-store.ts:9`, `:100`, `:127`, `:160`, `:171`, `:187`, `src/screens/team-workspace.tsx:76`.

Done when upstream team-format fixtures roundtrip semantically across supported generations, nicknames, gender, zero IVs/happiness and special fields. Persist structured sets directly; text export should not be a lossy internal save boundary.

### T02 · P1 · Preserve drafts and report save outcomes truthfully

**Source-confirmed.** Component-local drafts disappear on navigation/team selection/New/duplicate. Duplicate uses the persisted team rather than visible edits. A failed new-team import/save can reload the previously active team, discarding the invalid draft. Empty/incomplete sets cannot be saved as drafts.

Evidence: `src/screens/team-workspace.tsx:30`, `:54`, `:68`, `:79`, `:90`, `:222`, `src/compat/team-store.ts:260`.

Done when dirty state and save state are explicit, incomplete drafts survive navigation/reload, failed saves preserve input, duplicate uses a clearly chosen version, and destructive operations have undo/recovery.

### T03 · P1 · Validate and recover local storage

**Reproduced / source-confirmed.** Team storage is parsed and cast without validation. Executing the actual storage/boot functions with valid JSON `null` produced `TypeError: Cannot read properties of null (reading 'length')` before the error boundary can mount. Quota/permission errors are swallowed, so saving can appear successful but disappear on reload. There is no cross-tab reconciliation.

Evidence: `src/compat/team-store.ts:295`, `:306`, `src/stores/arena-store.ts:220`.

Done when versioned schemas/migrations validate each record, malformed records are quarantined with recovery export, saves return a durable outcome, and concurrent tabs do not silently overwrite one another. Preserve an empty library intentionally rather than reintroducing the sample team on reload.

### T04 · P1 · Use format-aware data and complete learnsets

**Source-confirmed / reproduced data comparison.** SetEditor hardcodes Gen 9; `formatId` only appears in a hidden announcement. Direct learnset keys omit inherited moves: installed data comparisons excluded Raichu's Volt Tackle and Gallade's Shadow Sneak. Universal restriction is also inappropriate for permissive formats such as Hackmons.

Evidence: `src/components/set-editor.tsx:45`, `:57`, `:96`, `:278`.

Done when generation/mod defaults, inheritance and allowed overrides are correct, suggestions do not erase out-of-filter values, and old-generation/permissive-format fixtures cover species, items, abilities and moves.

### T05 · P2 · Complete the set editor

**Parity gap.** Missing UI includes IVs/DVs, actual calculated stats, gender, shiny, happiness, Hidden Power and applicable Dynamax/Gigantamax/form details. There is no straightforward clear-move option. Species changes clear ability rather than selecting an appropriate default.

Evidence: `src/components/set-editor.tsx:158`, `:225`, `:233`.

Done when supported formats expose relevant details and stat tools, preserve uncommon sets, support clearing choices, and provide efficient keyboard editing and sensible optional spread presets.

### T06 · P2 · Separate draft checks from authoritative format legality

**Source-confirmed / parity gap.** `validateTeamForFormat` performs generic checks, not tier bans, learnability, clauses or generation/team-size legality. The UI lacks upstream's explicit server validation flow.

Evidence: `src/stores/arena-store.ts:632`, `src/compat/team-store.ts:245`; upstream `panel-teambuilder-team.tsx:25`.

Done when a user can save any incomplete draft and separately validate a team against the selected server/format, receiving actionable per-set errors before matchmaking. Label local warnings accurately.

### T07 · P2 · Add library organization, migration and complete backup/restore

**Parity gap.** The library is a flat list with basic CRUD. There is no search/folder/sort/reorder, bulk operations, trash, full-library export, upstream migration or share/cloud-team workflow. The parser understands multi-team headers, but the import dialog invokes the single-team parser.

Evidence: `src/screens/team-workspace.tsx:113`, `:144`, `src/compat/team-store.ts:203`; compare upstream `panel-teambuilder.tsx`.

Done when full upstream backups preserve names/formats and supported organization, portable export/restore is reliable, and a large library can be searched and organized. Cloud synchronization/sharing is an optional later product commitment.

### T08 · P2 · Surface all imported slots and use canonical sprites

**Source-confirmed.** Import retains more than six sets but renders only six; validation merely warns and saving preserves hidden data. Team previews construct gen5 sprite filenames manually despite existing sprite helpers.

Evidence: `src/screens/team-workspace.tsx:116`, `:156`, `:243`, `:272`, `src/compat/team-store.ts:285`.

Done when slot limits reflect the format or overflow is explicitly visible, and sprite resolution handles forms/shiny/gender/new species with meaningful loading/failure fallbacks.

## Connections, identity and session lifecycle

### S01 · P1 · Guard every socket callback by connection identity

**Reproduced.** Reconnect creates a replacement socket before the old asynchronous `close` callback arrives. The old callback clears the new socket reference and restarts reconnect; subsequent commands queue despite a healthy connection. The test socket closes synchronously and misses this race.

Evidence: `src/compat/protocol-client.ts:186`, `:200`, `:211`, `src/compat/protocol-client.test.ts:19`.

Done when stale open/message/error/close callbacks cannot affect a new connection, with asynchronous and out-of-order socket tests, reconnect backoff/jitter and clear connection reasons.

### S02 · P1 · Scope and classify offline commands

**Reproduced.** Queue `/utm private-test-team`, switch servers, and open the replacement socket: it receives the old private team. The untyped queue survives server change and flushes at socket open, before authentication/room synchronization. Stale choices and assertions can cross the same boundary.

Evidence: `src/compat/protocol-client.ts:166`, `:217`, `:240`.

Done when queues belong to a server/session, expire obsolete requests, exclude replay of auth/battle-sensitive operations across transitions, and distinguish retryable messages from commands that need renewed user intent or current server state.

### S03 · P1 · Cancel stale authentication operations

**Source-confirmed.** Popup login and silent resume perform multiple awaits without checking whether logout, server change or a new challenge superseded them. A delayed refresh can save a token after logout; a delayed assertion can send `/trn` and re-establish the identity.

Evidence: `src/protocol/router.ts:140`, `src/stores/arena-store.ts:416`, `:455`.

Done when identity operations have an attempt/session ID and cancellation, and logout/reconnect/server-switch/overlap tests prove that late responses cannot change the current session or restore cleared credentials.

### S04 · P1 · Separate OAuth authorization from server confirmation timeouts

**Source-confirmed.** The eight-second timer starts before the user finishes provider authorization. It reports failure/re-enables submission while the popup listener/poller remains active and can succeed later.

Evidence: `src/stores/arena-store.ts:249`, `:413`, `src/compat/ps-oauth.ts:126`.

Done when interactive authorization has an appropriate cancellable lifecycle and the short confirmation timeout begins only after submitting the assertion. Closing a popup or superseding an attempt must clean up listeners/timers.

### S05 · P2 · Coordinate token refresh across browser tabs

**Source-confirmed risk.** Multiple tabs can refresh the same aged token without coordination. A losing request may clear or overwrite the winning replacement in shared storage.

Evidence: `src/protocol/router.ts:145`, `src/compat/ps-oauth.ts`; the [provider documentation](https://github.com/smogon/pokemon-showdown-loginserver/blob/master/OAUTH.md) describes replacement-token refresh.

Done when refresh is coordinated, stale results use compare-before-write/clear, and tabs synchronize login/logout and replacement tokens without exposing credentials in diagnostic messages.

### S06 · P2 · Bind OAuth callbacks to the exact attempt

**Improvement based on missing checks.** The message handler checks origin but not `event.source === popup`; polling checks origin without restricting callback pathname. There is no per-attempt callback nonce. This review did not demonstrate account compromise.

Evidence: `src/compat/ps-oauth.ts:150`, `:161`, `public/oauth.html`.

Done when callback source/path/attempt are bound, credentials are removed from the URL after transfer, and callback-specific cache/referrer behavior is tested. Use the provider's documented OAuth-like protocol rather than assuming unsupported standard OAuth/PKCE features.

### S07 · P1 · Reconcile room state and reset servers atomically

**Source-confirmed.** Reinitialization keeps prior engine/history/request/draft/result state while appending the replayed history. Reset-to-default does not clear the rooms/directories/challenges that ordinary server change clears, and reconnect autojoins retained foreign rooms. Feeding a full transcript twice did not universally corrupt engine state; duplication and stale lifecycle state remain the confirmed concern.

Evidence: `src/protocol/router.ts:347`, `:545`, `src/stores/arena-store.ts:352`, `:366`, `:978`.

Done when both server-change directions share one teardown path and rejoin applies a reconciled authoritative snapshot, with no duplicate history, foreign commands, or stale pending choices.

### S08 · P2 · Derive unread and focused state from the visible UI

**Source-confirmed.** Room focus is not cleared when navigating away; hidden tabs can mark messages read. Conversely `init` and battle requests overwrite `activeRoomId` even when the user views something else. Unread counts and focused audio can follow the wrong session.

Evidence: `src/screens/room-screen.tsx:40`, `src/screens/battle-screen.tsx:55`, `src/protocol/router.ts:288`, `:360`, `:633`, `src/rooms/registry.ts:105`.

Done when only the visible, foreground conversation clears unread, and protocol state updates do not silently change view focus.

### S09 · P1 · Give PMs a local open/close/reload lifecycle

**Source-confirmed.** Reloading a missing `pm-*` route never creates the conversation and waits indefinitely. Closing marks it disconnected; reopening an existing PM does not reconnect it. Rejoin incorrectly sends `/join pm-*`; incoming messages reuse the disconnected record.

Evidence: `src/screens/room-screen.tsx:48`, `:63`, `src/stores/arena-store.ts:469`, `:702`, `src/protocol/router.ts:287`.

Done when opening/reloading/reopening a PM creates or restores a local conversation, new incoming messages follow a defined restoration rule, and local PM operations emit no fictitious room join/leave commands.

### S10 · P2 · End failed joins with the server's explanation

**Source-confirmed.** `noinit` stores a global error but does not create a failed room record. The missing-room screen ignores that error and changes from a spinner to “Still trying,” even after refusal.

Evidence: `src/protocol/router.ts:373`, `src/rooms/registry.ts:72`, `src/screens/room-screen.tsx:71`, `src/components/joining-state.tsx:19`.

Done when missing/private/full/denied rooms show a terminal, specific result with appropriate retry or back actions, including direct URLs.

## Chat, users and notifications

### C01 · P2 · Reconcile outgoing messages with server echoes

**Source-confirmed.** PMs are appended optimistically and again on echo; battle chat also appends locally while server chat is rendered independently. Pending/failed delivery is not represented and the input clears immediately, including when a command has merely entered an offline queue.

Evidence: `src/stores/arena-store.ts:503`, `:890`, `src/protocol/router.ts:277`, `src/screens/room-screen.tsx:82`.

Done when an acknowledged message appears once, pending/rejected delivery is clear, unsent drafts survive failures, and reconnect/retry does not duplicate or misattribute messages. Check ordinary chat, PMs, `/me`, commands and server errors separately.

### C02 · P2 · Repair chat scrolling and history access

**Source-confirmed.** Scrolling keys off `chat.length`: new messages pull readers to the bottom until the 200-message cap, then the constant length stops autoscroll entirely.

Evidence: `src/screens/room-screen.tsx:51`, `src/rooms/registry.ts:6`, `:104`.

Done when the feed follows only readers already near the bottom, shows a new-message marker otherwise, and remains correct past retention limits and named HTML updates. Define useful history/search/export behavior without unbounded memory.

### C03 · P2 · Preserve safe upstream room HTML interactions

**Source-confirmed / parity gap.** The sanitizer removes non-HTTP(S) links, including relative internal navigation; data attributes are disabled, while command delegation recognizes only `button[value]`. Upstream room content using `data-href`, `data-cmd`, forms and preview controls loses behavior.

Evidence: `src/components/chat-html.ts:41`, `:44`, `src/components/chat-feed.tsx:74`; compare upstream chat rendering.

Done when real room intros, polls, help pages and internal links work through a small, explicitly supported safe adapter. Keep sanitization and command/layout trust decisions explicit; do not simply allow every upstream attribute.

### C04 · P2 · Add room rosters and social safety workflows

**Parity gap.** Rooms show a user count but no searchable/rank-sorted roster. Cards offer Challenge and Message only. Ignore/unignore, PM/challenge blocking, report/help, room authority and moderation shortcuts are absent as UI workflows, though some server commands may work manually.

Evidence: `src/screens/room-screen.tsx:97`, `:113`, `src/components/user-card.tsx:112`.

Done when users can find room members and manage unwanted interactions; staff controls are permission-aware and report/help routes have clear destinations.

### C05 · P2 · Represent profiles and presence accurately

**Source-confirmed / parity gap.** `userdetails.rooms === false` loses its offline meaning when converted to an empty array, and the card falls back to “Online.” Returned rooms are not shown; live-battle links and useful account/rating data are missing.

Evidence: `src/protocol/router.ts:328`, `src/components/user-card.tsx:106`.

Done when online/offline/unknown are distinct, failed lookups can retry, and available rooms, spectatable battles and supported profile/rating information are actionable.

### C06 · P2 · Complete everyday chat composition

**Parity gap.** A single-line input lacks command/user completion, input history, multiline/per-room drafts, formatting help, message search, timestamps preferences, highlights and per-room mute. Formatting uses a flat regex subset of upstream syntax.

Evidence: `src/screens/room-screen.tsx:147`, `src/components/chat-feed.tsx:22`; compare upstream `panel-chat.tsx` input history/completion/highlights.

Done when keyboard chat workflows and drafts survive room switches, supported formatting is documented, and real upstream formatting fixtures cover links, nested syntax and action messages.

### C07 · P2 · Make notifications and preferences useful across devices

**Source-confirmed / parity gap.** Persistent preferences only cover theme and two booleans. Desktop notifications focus the window rather than the relevant room; constructor failures are swallowed and permission state is not exposed. Enabling notifications is conflated with the choice to display in-app challenge details.

Evidence: `src/stores/workspace-store.ts:6`, `src/compat/desktop-notify.ts:23`, `src/screens/app-root.tsx:186`, `src/screens/settings-screen.tsx:73`.

Done when permission/unsupported/denied states are clear, notification activation opens the relevant session, muting interruptions leaves challenges accessible, and users can separately control useful volumes, animation, timestamps, highlights, privacy and visibility preferences. Language/avatar/account controls can be scoped separately; background push is a separate product commitment from desktop notifications.

## Matchmaking, discovery and tournaments

### D01 · P2 · Complete direct challenge workflows

**Source-confirmed / parity gap.** Outgoing state and `cancelChallenge` exist but are not exposed. Incoming acceptance and user-card challenges reuse one global team/format, with no per-challenge compatible team selector. Challenge eligibility and rich `/challenge` PM metadata are incomplete; those PM payloads are discarded. Ladder browsing also changes the matchmaking format.

Evidence: `src/screens/home-screen.tsx:202`, `:218`, `src/stores/arena-store.ts:678`, `:712`, `:734`, `src/protocol/router.ts:285`, `src/screens/ladder-screen.tsx:169`.

Done when incoming and outgoing challenges have clear format/team context, status, cancellation and error handling, and rich challenge metadata is represented. Add per-format remembered teams, privacy/custom rules/best-of options and multiple searches only where supported and wanted.

### D02 · P2 · Build an actual live-battle directory

**Source-confirmed / parity gap.** Home displays at most 12 results, refreshes on connection/mount, and links “Browse rooms” to the chat-only directory. Empty results keep showing a loading message. There is no useful format/player/rating filter, refresh/pagination or direct battle-ID entry.

Evidence: `src/screens/home-screen.tsx:26`, `:28`, `:139`, `:152`, `src/screens/rooms-screen.tsx:30`.

Done when players can find and open a battle by opponent/format/ID, refresh stale results, browse beyond the first page and distinguish loading, empty, offline and failed states. Keep chat-room and battle-room types distinct even when test data mixes them.

### D03 · P2 · Expand room discovery and remembered sessions

**Parity gap.** The directory filters only the public room list. It lacks join-by-name/URL, private room entry, favorites/autojoin, recent rooms and subroom navigation. The search placeholder promises battles that the directory does not render.

Evidence: `src/screens/rooms-screen.tsx:23`, `:73`, `src/stores/arena-store.ts:329`.

Done when users can intentionally join known rooms and resume selected sessions after reload, while private/denied room results remain truthful. Remember preferences separately from live socket membership and account identity.

### D04 · P1 · Finish tournament challenge and bracket lifecycles

**Source-confirmed / parity gap.** `challengeBys` is treated as an incoming challenge, but actually names eligible challengers; actual `challenged`/`challenging` fields are discarded. Challenge/accept sends `/tour` commands without selecting/validating/uploading a team. Only tree brackets render, table/round-robin data does not, and completed tournaments disappear.

Evidence: `src/components/tournament-banner.tsx:54`, `:58`, `:76`, `src/protocol/router.ts:405`, `src/rooms/types.ts:48`, `src/screens/room-screen.tsx:134`; upstream `panel-chat-tournament.tsx:438`, `:498`, `:506`.

Done when a recorded tournament completes join → compatible team selection → `/utm` → challenge/accept/cancel → battle → next round → results. Support choosing opponents, watching bracket battles, displaying errors and round-robin tables. Tournament functionality exists today, but signups/bracket visibility does not prove playable parity.

## Replays and ladder

### R01 · P2 · Make replays addressable and navigable by battle turns

**Parity gap.** Replay review requires pasting a URL/log; there is no replay search, player/format history, recent/bookmarked collection or persistent replay route. Playback advances raw protocol lines at a fixed interval, with no turn jump, speed, viewpoint swap, full narration/chat or export/embed workflow.

Evidence: `src/screens/replays-screen.tsx:63`, `:77`, `:145`, `src/router.tsx:44`; compare upstream `replay-embed.ts` and replay site.

Done when a saved replay opens directly from a shareable address, survives reload, and supports turn-based controls, viewpoint and speed with accurate metadata/privacy context. Search, bookmarks and export can follow the addressable playback core.

### R02 · P2 · Normalize replay URLs and bound playback work

**Source-confirmed.** String suffix replacement appends `.log` to the whole URL, mishandling query/hash inputs. Fetches lack cancellation/timeouts/size limits. Each cursor change creates an engine and processes the full prefix, producing growing work over a replay.

Evidence: `src/screens/replays-screen.tsx:55`, `:86`, `src/battle/engine.ts:240`.

Done when URL parsing preserves legitimate private-replay identifiers, errors are recoverable, loading can cancel, and large logs use incremental state/checkpoints or another measured strategy with input bounds.

### R03 · P2 · Preserve authoritative replay upload results

**Source-confirmed risk.** One global `replayStatus` represents every battle save. Async results can be attached to the current status rather than their originating request. Popup handling infers a public official URL from wording/room ID instead of preserving the returned URL; configured custom replay hosts still produce official success links.

Evidence: `src/stores/arena-store.ts:905`, `:937`, `:952`, `src/protocol/router.ts:253`, `api/replay.ts:10`.

Done when saves are correlated per room/attempt, returned URLs and private identifiers are preserved, uploads to configured hosts link to those hosts, and simultaneous/retried/failed saves have tested outcomes. Real private-upload behavior remains an integration validation item.

### R04 · P2 · Complete ladder lookup and server integration

**Source-confirmed / parity gap.** Rankings are tied to a static host and sliced to 100 rows. There is no arbitrary-user/prefix search, expanded results, full useful rating metrics/provisional status, or custom-server ladder path. Refresh state derives from selected format rather than the request, so reloading can look idle and errors remain stale during retry.

Evidence: `src/screens/ladder-screen.tsx:18`, `:48`, `:55`, `:65`; upstream `panel-ladder.tsx:89`, `:194`.

Done when rankings reflect the connected server, players can look up themselves beyond the first page, relevant metrics are explained, and loading/revalidating/error/empty states remain distinct.

## Interaction, accessibility and visual polish

### U01 · P1 · Fix duplicate combobox keyboard handling

**Reproduced.** The root and portal share the same key handler; React portal bubbling invokes it twice. With A/B/C, one ArrowDown moves A → C, and one Enter calls the selection callback twice. Grouped visual order can also differ from keyboard order.

Evidence: `src/components/searchable-select.tsx:108`, `:130`, `:177`, `:206`.

Done when each keystroke causes exactly one action, traversal follows rendered order, and grouping, disabled options, Home/End, Escape and focus return have interaction tests. This affects selectors throughout the application.

### U02 · P2 · Verify usable touch, keyboard and assistive-technology flows

**Observed / improvement.** In the inspected 390px spectator view the lower trainer badge overlaps the Pokémon nameplate/type area, although there is no horizontal overflow. Hover-based competitive information has no equivalent touch inspector; tooltip markup is not linked to its trigger by an accessible description. Axe checks alone cannot establish complete access.

Evidence: `src/components/battle-field.tsx:92`, `src/styles/battle.css:263`, `src/components/battle-tooltip.tsx:66`; [390px mock spectator screenshot](media/audit-mobile-2026-09-05.png).

Done when singles/doubles/preview/modal states work on small screens, landscape, browser zoom and software-keyboard resize; primary controls remain reachable and information does not overlap. Test full keyboard and screen-reader journeys, focus restoration/announcements, theme control semantics, reduced motion, and touch inspection. Define the supported browser/device policy and test it.

### U03 · P1 · Make startup and action failures recoverable

**Source-confirmed.** Rejected dex/engine load promises are retained permanently and boot calls do not handle rejection. Dependent screens can wait indefinitely. Clipboard controls report success before the promise resolves, and shared errors are not consistently visible where the failing action occurred.

Evidence: `src/data/dex.ts:23`, `src/battle/engine.ts:35`, `src/main.tsx:12`, `src/screens/replays-screen.tsx:52`, `src/screens/team-workspace.tsx:129`, `src/screens/settings-screen.tsx:176`.

Done when failed chunks can retry, errors are scoped to the initiating operation, loading has useful recovery states, and clipboard/storage/network failure produces truthful feedback without destroying work. Add route-level recovery around utilities so a failure need not remove every active battle surface.

### U04 · P2 · Support stable URLs and navigation state

**Parity gap.** Individual teams, selected ladder formats, replays and user/help/server-generated pages have no addressable route. Original-style battle/room URLs require translation; utility state generally disappears on reload.

Evidence: `src/router.tsx:8`, `src/navigation.ts`, `src/components/command-bar.tsx`.

Done when supported content can be linked/bookmarked, old-client links resolve intentionally, back/forward navigation restores useful state, and unknown routes provide a helpful recovery page. Coordinate with T02/S09 rather than persisting live socket objects.

### U05 · P2 · Refine onboarding, hierarchy and consistency around real tasks

**Observed / improvement.** The shell has a coherent starting style, but sparse home/team states occupy large empty panels; dense battle information and tiny/truncated bench labels compete at smaller widths. First-run defaults select OU and a two-Pokémon sample team. Public-facing login copy exposes environment-variable names, and legacy errors still ask users to enter passwords despite the OAuth UI.

Evidence: `src/stores/arena-store.ts:202`, `:210`, `:281`, `src/screens/app-root.tsx:272`, `src/screens/home-screen.tsx`, `src/styles/battle.css`, `src/styles/teams.css`.

Done when first-time players have a clear name → format/team → battle path, samples are explicitly labeled and useful, empty states teach the next action, and production users receive actionable language while deployment details stay in operator documentation. Establish consistent spacing/type/control tokens, fit important labels, and review busy/sparse/loading/error states in light and dark themes. Preserve the recognizable battle experience rather than restyling it at the expense of information.

## Security, privacy and dependencies

### SEC01 · P1 · Triage and update vulnerable dependencies

**Verified scan.** `npm audit --json` reports 11 affected package entries, all with fixes available at audit time. This warrants prompt dependency maintenance, not an assertion that the running client has 11 exploitable vulnerabilities.

| Severity | Packages |
| --- | --- |
| Critical | `seroval` |
| High | `brace-expansion`, `browserslist`, `js-yaml`, `nanoid`, `postcss`, `vite`, `ws` |
| Moderate | `dompurify` |
| Low | `@babel/core`, `esbuild` |

The lockfile contains `seroval@1.5.2`. Its advisory concerns untrusted `fromJSON()` deserialization with plugins and is patched in 1.5.3. This is a static SPA rather than TanStack Start; no application call to the affected API was found, so server-code-execution reachability was not established. [Seroval advisory](https://github.com/advisories/GHSA-mv8w-475r-vwqw).

`dompurify@3.4.12` is also affected by an advisory patched in 3.4.13; the reported condition concerns in-place sanitization with a removing hook, while this application sanitizes strings. Update it, but do not describe the advisory as reproduced chat XSS. [DOMPurify advisory](https://github.com/advisories/GHSA-55q2-fjhq-7xh7).

Done when reviewed lockfile updates clear or explicitly document accepted advisories, runtime/build-only paths are distinguished, and protocol/UI/security regression checks pass. Avoid an unreviewed forced major-version update.

### SEC02 · P1 · Make diagnostic exports safe to share

**Source-confirmed.** Redaction targets challenge/assertion strings only. Protocol logs can include PMs, uploaded teams, private room IDs and replay payloads/passwords, while issue templates ask for “redacted” logs. Credential redaction is not privacy redaction.

Evidence: `src/stores/arena-store.ts:296`, `:926`, `.github/ISSUE_TEMPLATE/bug.yml:26`, `.github/ISSUE_TEMPLATE/protocol.yml:9`.

Done when a separate share-safe export omits or masks sensitive content by default, previews exactly what will be copied, includes useful version/request context, and has fixtures for all credential/private-data message forms. Keep detailed local diagnostics available under clear labeling.

### SEC03 · P2 · Bound and test proxy inputs and failures

**Source-confirmed / improvement.** APIs read the full body before checking string length, which does not bound incoming memory or UTF-8 bytes. Action/content-type validation and abuse controls need a documented policy. Upstreams are fixed server-side; these are not arbitrary-destination open proxies.

Evidence: `api/action.ts:38`, `api/replay.ts:24`.

Done when byte-counted bounded reads, supported methods/actions/content types, upstream timeouts and failure responses are tested. Apply appropriate origin/rate protections for each deployment while preserving legitimate OAuth and custom-server flows. Never log credentials/bodies as an observability shortcut.

### SEC04 · P2 · Define the rich-content boundary and add CSP

**Improvement based on missing controls.** Security headers exist, but no CSP. Sanitized HTML permits broad styles/classes/command values, regex filters presentation properties, and any clicked slash command is dispatched. DOMPurify is present; no unsanitized-HTML exploit was demonstrated.

Evidence: `vercel.json:24`, `src/components/chat-html.ts:32`, `:71`, `src/components/chat-feed.tsx:74`.

Done when a tested CSP supports required custom sockets/assets/OAuth, embedded HTML cannot escape its layout boundary, consequential commands have an intentional trust policy, and malicious/large/escaped CSS fixtures are covered. Keep compatibility improvements in C03 tied to these constraints.

### SEC05 · P2 · Publish accurate storage and network disclosures

**Source-confirmed.** Settings says nothing leaves except battle-server traffic, but OAuth/login/replay/ladder/sprite/audio and embedded external-image requests occur. It says the site hosts no game data despite bundling the dex, and implies all rankings come from the connected server despite the fixed ladder endpoint.

Evidence: `src/screens/settings-screen.tsx:52`, `:226`, `src/screens/ladder-screen.tsx:18`, `src/main.tsx:12`.

Done when the notice explains actual endpoints, local tokens/teams/preferences, external room media, retention/backup/deletion and deployment-specific behavior. Review source attribution and legal wording separately from technical privacy facts; this audit is not a legal determination.

## PWA, offline operation and upgrades

### PWA01 · P1 · Prevent callback pages replacing the offline shell

**Reproduced in isolation.** Every successful same-origin navigation response is cached under `/`, including `/oauth.html`. Executing the actual worker with mocked fetch/cache events confirmed that a callback navigation replaced `/` and a subsequent offline navigation returned callback HTML instead of the client. The HTML is static: this establishes incorrect shell selection, not token exfiltration. A production-browser regression test is still needed.

Evidence: `public/sw.js:43`.

Done when only verified SPA documents populate the shell cache, callback/API routes are excluded, and online login followed by offline restart still opens the intended app shell.

### PWA02 · P2 · Implement cache retention and upgrade recovery

**Source-confirmed.** Fixed `v1` asset caches retain all visited hashed build assets indefinitely. Cache writes are not attached to the fetch event lifetime; there is no explicit deployment/update lifecycle or recovery affordance.

Evidence: `public/sw.js:9`, `:31`, `:48`.

Done when a versioned asset manifest/retention policy bounds storage, writes are awaited appropriately, updates do not mix incompatible versions, and stale/missing chunks have a tested recovery path without deleting users' teams.

### PWA03 · P2 · Define and verify what works offline

**Improvement / unverified behavior.** An installable shell does not guarantee the lazy teambuilder/dex/engine chunks or external sprites are available offline. Realtime battles necessarily depend on connectivity, but local teams should have a clear useful offline contract.

Evidence: `public/sw.js`, `public/manifest.webmanifest`, `src/main.tsx:16`, `src/data/dex.ts:25`.

Done when installability and icons are checked on supported platforms; offline teams/drafts/backup behave as documented; disconnected battles show recovery state; and cache quota, first offline launch and deployment upgrades are tested against a production build. Background push and desktop packaging can remain explicit non-goals unless demanded.

## Testing, architecture and performance

### Q01 · P1 · Enforce mobile and visual regressions in CI

**Source-confirmed.** CI runs only Chromium and excludes all “visual baseline” tests. The mobile project exists but is never run, and committed screenshots are Darwin-specific. Accessibility is run twice for Chromium rather than extending coverage.

Evidence: `.github/workflows/ci.yml:70`, `playwright.config.ts:27`, `e2e/visual.spec.ts-snapshots/`.

Done when stable CI-platform baselines and mobile flows gate changes; run Firefox/WebKit according to the support policy. Keep screenshot tolerances intentional, expand meaningful states, and upload actual traces/screenshots/error output—current failure artifacts target `playwright-report/` despite no HTML reporter being configured.

### Q02 · P1 · Exercise the production paths

**Source-confirmed.** E2E starts Vite dev, whose proxies bypass the production API handlers; production service workers are disabled there. Green browser tests do not prove Edge functions, deployment headers, static OAuth routing or PWA behavior.

Evidence: `playwright.config.ts:10`, `vite.config.ts:22`, `src/main.tsx:16`, `api/action.ts`, `api/replay.ts`.

Done when direct API tests and production-build/deployment smoke checks cover callback routes, security headers, proxy limits/upstream failure, OAuth completion, replay save and offline/update behavior. A Vite preview alone still bypasses production Edge functions, so validate that boundary separately.

### Q03 · P1 · Test protocol transitions and make mocks expose failures

**Reproduced coverage gap.** All existing tests passed while targeted probes found invalid choices, lost team attributes, double keyboard events and socket races. The mock replaces HMR's socket too, generating ignored browser errors. Current battle fixtures are a small Gen 9 sample and tournament E2E stops at signups/bracket visibility.

Evidence: `e2e/mock-ps.ts:31`, `src/compat/protocol-client.test.ts:19`, `src/compat/__fixtures__/`, `e2e/smoke.spec.ts:273`.

Done when mocks intercept only the intended socket, unexpected page errors fail tests, server rejects are modeled, and meaningful tests cover the P1 acceptance scenarios. Add differential upstream choice/team fixtures, malformed/out-of-order frames, special generations/mechanics and asynchronous reconnect. Use coverage thresholds for critical behavior if useful, rather than chasing a whole-repository percentage.

### Q04 · P2 · Expand controlled integration validation and surface live drift

**Source-confirmed.** The live smoke test validates guest handshake, formats and lobby access; it directly calls the login upstream, bypassing deployed proxies/client behavior. CI treats it as non-blocking and does not prove registered login, battles, reconnect or replay upload.

Evidence: `scripts/live-smoke.mjs:34`, `:62`, `.github/workflows/ci.yml:88`.

Done when a controlled local PS server or consenting test environment runs actual end-to-end battle/tournament flows, recorded transcripts cover upstream changes, and a non-blocking public-service failure has a maintained alert/release-review path. Do not run unsolicited rated battles or publish chat messages as routine CI.

### Q05 · P1 · Typecheck API and browser test code

**Source-confirmed.** TS project includes cover only `src` and configuration files. API and E2E TypeScript are not typechecked, although ESLint already covers them.

Evidence: `tsconfig.app.json:21`, `tsconfig.node.json:14`, `eslint.config.js:33`.

Done when appropriate TS projects check API runtime types and browser-test code and the normal `check`/CI entrypoints include them. Ensure runtime data is validated too; static types do not validate server payloads or localStorage.

### Q06 · P2 · Bound resource use and separate lifecycle ownership

**Source-confirmed / improvement.** Closing/deinitializing rooms only marks them disconnected; their engines/full raw logs remain for the app lifetime. Each battle line copies the growing raw array and can reproject full state. Rendering rich chat repeatedly sanitizes unchanged messages; replay work grows with the full processed prefix. The 1,049-line store and 731-line router still combine many domains, and engine exceptions are swallowed.

Evidence: `src/stores/arena-store.ts:474`, `:1001`, `src/protocol/router.ts:368`, `:545`, `:639`, `src/battle/engine.ts:71`, `src/components/chat-feed.tsx:94`.

Done when rooms/engines have disposal and bounded archival policies; frames batch state updates where appropriate; stable sanitized content is reused; long battles, busy chat and large libraries have measured memory/latency budgets. Separate authentication, transport, room lifecycle, teams, requests and replay uploads around clear interfaces. Prefer focused refactoring over a framework migration; local privacy-safe diagnostics are sufficient before adding hosted telemetry.

## Open-source quality and operations

### O01 · P2 · Replace stale documentation with a current compatibility map

**Source-confirmed.** Architecture docs still say no sound/tournaments; both exist. Security guidance describes older password/text-only paths, and the historical review includes superseded “broken right now” statements. README describes broad capability without spelling out partial support.

Evidence: `docs/architecture.md:196`, `:204`, `docs/architecture-review.md`, `SECURITY.md:16`, `README.md:14`.

Done when historical documents are marked as such, current architecture/security/data-flow docs match code, and every major workflow has supported/partial/planned status with a tested upstream baseline. Remove or explicitly justify obsolete password APIs and contradictory errors.

### O02 · P1 · Make a clean contributor setup reproducible

**Source-confirmed.** Node “20+” is broader than locked tool requirements; `.nvmrc` and CI use 22. Browser installation is not part of onboarding. `.env.example` directs proxy variables into `.env.local`, but Vite config reads `process.env` before explicitly loading those files.

Evidence: `package.json:9`, `CONTRIBUTING.md:13`, `.nvmrc`, `package-lock.json:3061`, `:5403`, `.env.example:19`, `vite.config.ts:4`.

Done when declared Node support matches tested dependency constraints, a fresh clone has documented browser/setup commands, and env-file precedence works in dev/build/preview. Vite requires explicit loading for values used during config evaluation. [Vite environment configuration](https://vite.dev/config/#using-environment-variables-in-config).

### O03 · P2 · Consolidate server endpoints and document self-hosting

**Source-confirmed / parity gap.** WebSocket server configuration is separate from login/action/OAuth/replay/ladder configuration; `ServerConfig.loginServer` is not the endpoint used by login requests. OAuth defaults are official-only and custom replay success links point to the official host. “Dev and production share one code path” hides distinct proxy implementations.

Evidence: `src/compat/protocol-client.ts:9`, `src/compat/login-server.ts:11`, `src/compat/ps-oauth.ts:13`, `src/stores/arena-store.ts:952`, `README.md:64`.

Done when endpoint ownership/compatibility is explicit, configuration is validated together, and docs cover local servers, OAuth origin registration for local/preview/production, proxy hosting beyond Vercel, assets/replays/ladder, HTTPS and deployment troubleshooting. A container or one-command dev environment is optional if it materially reduces setup friction.

### O04 · P2 · Make reporting and maintenance ownership actionable

**Source-confirmed / improvement.** Security and conduct policies request private owner contact without an actionable private destination. CODEOWNERS exists but ownership is concentrated in one person. Remote reporting/settings were not checked.

Evidence: `SECURITY.md:5`, `CODE_OF_CONDUCT.md:29`, `CODEOWNERS`, `.github/ISSUE_TEMPLATE/config.yml`.

Done when security/conduct reports have maintained private contacts and fallback/escalation, response expectations and supported versions; contributors have a support/triage path, labels and clear review expectations. Add domain maintainers and succession guidance as the project grows. Verify remote branch protections/required reviews/private reporting separately before claiming they are enabled or absent.

### O05 · P2 · Establish releases, a public roadmap and compatibility ownership

**Improvement.** No tracked changelog, release checklist, current parity roadmap, migration policy or release tags were found in the local audit. Package version `1.0.0` does not by itself establish a supported compatibility contract.

Evidence: `package.json:3`, `.github/workflows/ci.yml`, tracked documentation and local tag inventory.

Done when versions/releases link to exact source commits, changes and known limitations; storage changes have backup/migration notes; releases validate supported workflows and deployment rollback; and a named maintainer owns upstream protocol/data drift. Define goals/non-goals and turn the backlog into small issues with acceptance criteria and contributor-friendly entry points.

### O06 · P2 · Maintain attribution and deployed source provenance

**Improvement; existing foundation present.** The project already includes AGPL licensing, upstream attribution, trademark/non-affiliation text and a source link. Improve traceability rather than treating licensing as absent.

Evidence: `LICENSE`, `README.md` license/attribution section, `src/screens/settings-screen.tsx:199`, `package.json`.

Done when distributed/deployed versions identify their matching source revision, dependency and external asset origins/licenses are inventoried, and copied upstream fixtures retain applicable notices. Keep contribution terms and asset-hosting assumptions understandable. Have a qualified reviewer resolve any uncertain legal obligations; no license violation is established by this audit.

### O07 · P2 · Strengthen CI supply-chain and contribution enforcement

**Improvement.** Dependabot and CI exist; explicit workflow token permissions, immutable action pins, dependency/license checks and enforceable bundle budgets do not. Bundle sizes are reported only. Contributor documentation does not yet define a complete production/browser/release validation path.

Evidence: `.github/dependabot.yml`, `.github/workflows/ci.yml:45`, `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`.

Done when least-privilege permissions and reviewed action/dependency update policies are explicit; security results have an owner; meaningful bundle/performance budgets and required checks protect releases; and contributors can run the same relevant checks locally. Confirm repository-hosted protections and secret-scanning settings rather than inferring them from files.

## Suggested delivery sequence

| Milestone | Included work | Exit criterion |
| --- | --- | --- |
| 1. Protect saved work and identity | T01–T03, S01–S06, SEC01–SEC02, U01/U03 | Lossless team corpus, recoverable saves, one keyboard event per action, scoped transport/auth operations, reviewed advisory remediation. |
| 2. Reliable supported battles | B01–B08/B13, S07, D04 | Every advertised request can complete; rejected/submitted/reconnected choices remain consistent; one real controlled tournament completes. |
| 3. Reliable daily workflows | S08–S10, C01–C02/C05, D01–D03, R03 | PM reopen/reload/echo/unread work; discovery/challenges have honest status; replay save results stay attached to their battle. |
| 4. Competitive and usability parity | B09–B12, T04–T08, C03–C07, R01–R04, U02/U04/U05 | Usable generation-aware teams, battle information, accessible touch/keyboard flows, useful replay/ladder/search tools. |
| 5. Release and maintenance readiness | PWA01–PWA03, Q01–Q06, O01–O07, SEC03–SEC05 | Production paths and supported browsers gated; offline/update behavior verified; current docs, release/source provenance, contacts and ownership published. |

Testing and documentation changes should accompany each milestone rather than wait for milestone 5. In particular Q01–Q03/Q05, O02 and PWA01 are early release work. These are dependency-based phases, not calendar estimates; establish effort after splitting the grouped items into reviewable changes.

## Verification matrix for future releases

| Workflow | Required scenarios |
| --- | --- |
| Identity/transport | Guest/OAuth, slow popup, cancel, logout mid-request, token expiry, two tabs, disconnect during choice, stale socket callbacks, server reset, offline queue scoping. |
| Battle requests | Singles/doubles, preview counts/order, reserve exhaustion, revival, Commander, trapped/disabled callbacks, sentchoice, undo, rapid repeat input, all advertised generation modifiers and game types. |
| Teams | Full upstream backup, gender/nicknames/legacy abilities, zero IV/happiness, special fields, incomplete draft, failed save/import, quota/denied/corrupt storage, migration, concurrent tabs, large library. |
| Social/tournaments | PM echo, close/reopen/deep link, unread after navigation/background, 200+ messages, failed joins, real HTML controls, offline profile, outgoing cancel, elimination and round-robin challenge/accept/team upload/completion. |
| Replays/ladder | Public/private/custom-host save, concurrent uploads, URL query/hash, long logs, turn/viewpoint/speed/reload, arbitrary-player lookup, stale/retry/empty/error states. |
| Browser/accessibility | Chromium/Firefox/WebKit as supported, small phone/landscape/software keyboard, 200–400% zoom, keyboard-only, screen reader, reduced motion, both themes, meaningful modal/tooltip/preview/doubles screenshots. |
| Deployment/PWA | Actual API handlers, body limits, upstream timeouts, callback and SPA routes, security headers, asset failures, install/offline/update/cache quota, deployment/source revision and rollback. |
| Performance | Burst protocol frames, multiple open/closed rooms, long battle/replay, active chat HTML, large team library, cold load on constrained network/device and resource cleanup. |

## Scope decisions and remaining validation

Decide whether the project targets a dependable casual singles client, a competitive singles/doubles replacement, or full upstream coverage. Publish exclusions such as multi/FFA, legacy generations, custom-server ecosystems, desktop packaging, cloud teams, full move animation/music or localization. Some are substantial investments; an explicit non-goal is better than an implicitly broken affordance.

Before claiming full parity, extend the pinned comparison into an inventory of upstream user stories and protocol/request variants, replay recorded transcripts through both clients, and perform real controlled integration tests. Validate deployed OAuth configuration, private replays, repository-hosted security settings, accessibility with assistive technology and long-session performance. Those are remaining evidence gaps, not presumed failures.

The practical objective is a client that preserves user work, tells the truth about server state, completes every supported workflow and is understandable to outside contributors. This audit provides the initial backlog and the evidence needed to start that work.
