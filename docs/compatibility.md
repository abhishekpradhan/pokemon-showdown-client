# Compatibility and support contract

This is an independent client, not a promise to reproduce every screen of the official client. Server-side rules and validation remain authoritative. Before publishing a release, maintainers record the exact tested source revision and supported workflows in its release notes. The historical [implementation status](implementation-status.md) and [1.2 parity record](parity-completion.md) distinguish implemented features from external acceptance.

The comparison baseline for the September 2026 audit is the official client at `ac7d535b` (2026-08-22) and this project's audited revision `f48e68fc`. Protocol/data dependency versions are pinned by `package-lock.json`; the build publishes an inventory. The baseline is a reference for regression expectations, not an automatic claim of compatibility with every future server change.

| Workflow | Support contract | Required release evidence |
| --- | --- | --- |
| Guest naming | Supported through signed assertions | Named handshake, denial, timeout, reconnect |
| Registered login | Supported when a provider client ID is configured for the origin | Popup success/cancel/block, stale session rejection, refresh/logout races |
| Matchmaking/challenges | Supported for advertised client-capable formats | Team selection, rejection, cancellation, accept/decline, real controlled battle |
| Battle decisions | Server request drives available mechanics and legal choices | Singles/doubles/triples/multi/free-for-all, forced switch/preview/targets, affected generations and modifiers |
| Unmodeled layouts/formats | Must be visibly gated rather than shown as a supported playable view | Capability-gate fixtures and recovery to supported formats |
| Spectating | Supported; unrevealed information remains unknown | p1–p4/spectator projection, public/private HP, joining/rejoining mid-battle |
| Team building/import/export | Local workflow; server validates format legality | Lossless supported fields, generation-aware editor, file/backup round trips, failed saves/migration |
| Chat and PMs | Supported within server capabilities | Navigation, unread state, PM reopen/deep link, formatting and safe interactive content |
| Room-specific HTML | Supported safe subset | Representative intros/polls plus malicious CSS/command/large-payload fixtures |
| Tournaments | Server-driven room UI; supported formats follow battle capabilities | Signups, challenge/accept, bracket updates and elimination/round-robin fixtures |
| Ladders | Public/configured endpoint; not inferred solely from socket host | Loading, paging/search where offered, empty/error and custom endpoint |
| Replays | Text/URL loading, playback, download and server-confirmed sharing | Private URLs, upload errors, seeking, long logs, imported metadata |
| Personal preferences | Public avatars, translated server messages, local backgrounds; Arena interface is English | Server acknowledgement/reconnect, bounded storage/failures, readable themes |
| Audio/notifications | Optional; browser permissions and autoplay rules apply | Separate levels, music focus/visibility/end lifecycle, keyboard/pointer unlock, unavailable audio and background notification behavior |
| Offline | Local app/team tools after installation completes | Offline restart/editor/save/export; failed installation and upgrade recovery |
| Browser access | Current stable Chrome/Edge, Firefox and Safari; Android Chrome/iOS Safari | Chromium, mobile emulation, Firefox and WebKit flows; real-device release spot checks |
| Accessibility | Keyboard, labeled controls, visible focus, reduced motion and light/dark contrast | Axe plus manual keyboard/screen-reader review for changed workflows |

The official account provider's registration/recovery website remains the place for account administration. Server moderation tools and all community-specific commands are not automatically client features. Background push and packaged desktop clients are not release requirements. Offline live play, authentication or replay upload is not supported.

Rotation remains explicitly unsupported until an upstream playable format/request protocol exists ([#14](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/14)). Physical device and full screen-reader checks are tracked as unverified in the [manual matrix](manual-acceptance.md).

## Upstream drift ownership

The maintainer in CODEOWNERS reviews protocol/data dependency updates and the scheduled public handshake result. A new upstream protocol or mechanic should get a fixture, an explicit capability decision, updated UI/tests and a compatibility entry. Do not silently assume that a successful handshake validates every battle mechanic.

A release is supported only for the workflows recorded as verified in its release notes. Any incomplete matrix item is documented as partial or unavailable with a specific user-facing restriction; it must not be hidden behind a generic claim of full official-client parity.
