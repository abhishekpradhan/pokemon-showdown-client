# Attribution and source

Showdown Arena is licensed under AGPL-3.0-or-later; see [LICENSE](../LICENSE). It started as a fork of the [official Pokémon Showdown client](https://github.com/smogon/pokemon-showdown-client) by Guangcong Luo and contributors and is now an independent rewrite. Contributors license their changes under the project license, and upstream notices stay on any copied or adapted code and fixtures.

## Upstream code

Three pieces of the official client survive, adapted from MIT-licensed files at upstream commit `ac7d535b28574ea3b48d5a4d1fbf6ca399abf469`:

- `src/teams/stat-guesser.ts` adapts `BattleStatGuesser` from `battle-tooltips.ts`, with its author and license notice kept in the source.
- `src/preferences/avatars.ts` uses the numeric trainer aliases from `battle-dex-data.ts`. The public trainer picker uses the upstream public range rather than reserved custom avatars.
- `src/battle/music.ts` follows the music loop points in `battle-animations.ts`.

[UPSTREAM_NOTICES.txt](../UPSTREAM_NOTICES.txt) carries the notice for all three, and every build includes it in `/THIRD_PARTY_NOTICES.txt`. The same upstream commit is the comparison baseline recorded in [compatibility](compatibility.md).

## Dependencies

The [`@pkmn` project](https://github.com/pkmn/ps) supplies the battle engine, protocol and data packages; `@pkmn/dex` and `@pkmn/img` supply game data and image resolution. React, TanStack Router, Radix UI, Zustand, DOMPurify, Lucide and the development and test tools carry their own notices. Every build emits `/third-party-licenses.json` with package, version and SPDX metadata, and `/THIRD_PARTY_NOTICES.txt` with the installed runtime license and notice texts. `npm run check:licenses` flags new or missing license expressions for review; it is not a substitute for reading license terms.

## Media

Sprites, trainer icons, battlefield images and cries load from `play.pokemonshowdown.com` or a configured mirror, and room-authored images can come from anywhere. A package's software license does not grant rights to the external media it locates, so no new external media enters a release without its source and permission recorded. The application icons and committed screenshots are maintained in this repository; screenshots can include externally owned game artwork.

Sample sets are requested from the official client publisher's `data/sets/{format}.json` only when opened; the UI links the source and distinguishes curated analyses from usage samples. Trainer images and optional music stream from the official asset host and are not relicensed by this project's code license. Personal background images stay local and remain the user's content.

Pokémon and Pokémon character names are trademarks of Nintendo. This project is not affiliated with or endorsed by Nintendo, Creatures, GAME FREAK, or Smogon. It is a client for services operated by others.

## Matching source

`/build-info.json` identifies the version, source revision, repository and license of the built client, and Settings → About links to it and to the source repository; together they satisfy the AGPL's network-source requirement. Public deployments should point `VITE_SOURCE_URL` at their matching fork and make that revision available. Release only an identified, reviewed commit, and keep its build instructions and lockfile.

The `modified` marker covers hosting configuration too. Vercel rewrites `vercel.json` while materialising its deployment settings, so hosted builds report `applicationSourceModified` and `deploymentConfigurationModified` separately. A release needs an identified revision with unchanged application source. A checkout without Git is conservatively reported as modified.

When importing upstream regression fixtures, record the source path and revision, keep applicable notices, and remove private player, account and team data. Resolve unclear redistribution or media permissions before including the material.
