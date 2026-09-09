# Changelog

All notable changes to Showdown Arena are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

In progress on the current branch.

### Added

- `npm run format` and a Prettier check inside `npm run check`.
- Route-aware page titles.

### Changed

- The codebase is formatted with Prettier.
- The CI advisory gate blocks only on high-severity advisories in shipped dependencies; `npm run audit:dependencies:all` reports every severity across the whole tree as an advisory step.
- CI jobs have timeouts.
- README and docs rewritten and consolidated; historical audit and review records left the tree (they remain readable at the `v1.2.0` tag).

### Fixed

- Light-theme contrast for the replay empty state, status callouts and danger buttons.
- Internal battle volatiles are no longer shown as status chips.

### Removed

- Dead password-login code.
- Unused dependencies.

## [1.2.0] - 2026-09-06

### Added

- Official sample sets in the team builder: preview the source, apply or undo, and keep the personal fields you already filled in.
- EV/nature spread suggestions from the upstream stat-guessing heuristic, with full manual control.
- Triples battles, including targeting and Shift.
- Four-player multi and free-for-all battles: per-seat ownership and targets, private rosters, spectator viewpoints, seat invitations and responsive fields.
- Trainer avatars confirmed by the server, twelve server-language choices, built-in and locally stored backgrounds, separate effects/notification/music volumes, and optional battle music that follows focus and visibility.

### Changed

- Sign-in waits for the server to acknowledge the requested named identity instead of settling on an unrelated profile update, and login failures stay visible.
- Upstream notices are distributed in [UPSTREAM_NOTICES.txt](UPSTREAM_NOTICES.txt) and the built `/THIRD_PARTY_NOTICES.txt`.

### Fixed

- Avatar sprite aliases; avatar changes are confirmed through the server's own-user details, including on servers that throttle commands.
- Preference acknowledgements no longer rejoin rooms, room errors no longer accumulate, mobile Settings no longer overflows, and images persist correctly on WebKit.

The interface is English; the language preference changes translated server messages. Rotation stays unsupported until the server offers a playable protocol ([#14](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/14)); physical-device and screen-reader acceptance ([#12](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/12)) and registered-account acceptance ([#13](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/13)) remain open.

## [1.1.1] - 2026-09-06

### Changed

- Matchmaking walks through connection, player name and team setup before offering Find battle, and formats with provided teams say so.
- Compact mobile navigation shows the current page or conversation and the player name; theme switching lives in Settings.
- Team editing gains compact roster navigation, a mobile library toggle, responsive save controls and undo after removing a Pokémon.
- Battle decisions keep focus on the next choice, with readable target choices, Back to moves and Change choice; spectator playback gives its space back to the field.
- Chat drafts grow with multiline text, tab completion follows the caret, and spoilers have accessible reveal controls.
- Replay loading sits in the first viewport, and Settings has direct section navigation.

### Fixed

- Focus and dismissal in the account, notification, search, selector and battle-details dialogs; modal controls stay above mobile navigation.
- Offline team editing is explained as a connection status instead of a transport error.
- Invalid room joins are validated, favourites use less space, and roster/history filters no longer leak across conversations.
- Replay search resets stale results and pages when filters change.

The [UX review](https://github.com/abhishekpradhan/pokemon-showdown-client/blob/v1.2.0/docs/ux-review-2026-09-06.md) records the findings behind this release.

## [1.1.0] - 2026-09-06

### Added

- Team library with folders, search, sort, bulk actions, complete backup/import/recovery, and a generation-aware set editor with learnsets, IVs/DVs and stats.
- Challenge dialog with per-match team and format validation; live-battle directory with filters, ratings and paging; room favourites and autojoin.
- Room rosters, ignore lists, PM/challenge blocking, user profiles and presence; timestamps, highlights, per-room drafts, multiline input, history and tab completion in chat.
- Tournament signups, challenges and brackets; ladder lookup with player search and custom-server ladders.
- Replays addressable by turn, with normalised URLs, search, bookmarks, import/export and reliable upload results.
- Content Security Policy, bounded API proxies, a share-safe diagnostic export, and a versioned offline manifest with update consent and cache repair.
- Compatibility, privacy, self-hosting, contributing and release documentation.

### Changed

- Local teams migrate to a versioned, recoverable library; export a backup before downgrading to an older client.
- Battle choices follow the server's request exactly: team-preview ordering, forced switches, Revival Blessing, Commander, Z/Max targeting, locked submitted choices and rejection recovery.
- Singles and doubles are supported; triples, rotation, multi and free-for-all are gated with an explanation (1.2.0 lifts all but rotation).
- Closing an active battle asks for an explicit forfeit.

### Fixed

- Lossless team import and export, truthful save failures, and validated, recoverable local storage.
- Socket callbacks guarded by connection identity, cancellable authentication, OAuth callbacks bound to their attempt, and token refresh coordinated across tabs.
- Duplicate combobox keyboard dispatch, recoverable startup errors, stable URLs and legacy redirects.
- Hosted guest sign-in on Vercel's Edge runtime.
- Vulnerable dependencies updated.

The [1.1.0 implementation record](https://github.com/abhishekpradhan/pokemon-showdown-client/blob/v1.2.0/docs/implementation-status.md) maps each finding of the [September 2026 audit](https://github.com/abhishekpradhan/pokemon-showdown-client/blob/v1.2.0/docs/project-audit-2026-09-05.md) to its change.

## [1.0.0]

The baseline before this changelog: the initial independent client with the `@pkmn/client` engine, teams, rooms, replays, ladder, sound, notifications, PWA installation and tournament UI. The repository declared version 1.0.0 without a tag or release date.

[Unreleased]: https://github.com/abhishekpradhan/pokemon-showdown-client/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/abhishekpradhan/pokemon-showdown-client/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/abhishekpradhan/pokemon-showdown-client/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/abhishekpradhan/pokemon-showdown-client/compare/f48e68fc1b72ef1394b279996ec9f4e3e4bb8aa1...v1.1.0
[1.0.0]: https://github.com/abhishekpradhan/pokemon-showdown-client/tree/f48e68fc1b72ef1394b279996ec9f4e3e4bb8aa1
