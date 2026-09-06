# Attribution and distributed source

Showdown Arena is licensed under AGPL-3.0-or-later; see [LICENSE](../LICENSE). It originated as a fork of the [official Pokémon Showdown client](https://github.com/smogon/pokemon-showdown-client), by Guangcong Luo and contributors. Keep applicable upstream notices on copied or adapted code and fixtures. Contributors license their changes under the project license.

The maintained [`@pkmn` project](https://github.com/pkmn/ps) supplies the client engine/protocol/data packages; `@pkmn/dex` and `@pkmn/img` supply game data and image resolution. These package licenses are recorded in the installed packages and the locked dependency inventory. React, TanStack Router, Radix UI, Zustand, DOMPurify, Lucide and development/test tools carry their own notices. Every build emits `/third-party-licenses.json` with package/version/SPDX metadata and `/THIRD_PARTY_NOTICES.txt` with available installed runtime license/notice texts. The metadata gate detects new/missing expressions for review; it is not a substitute for reading license terms.

Sprites, trainer icons, battlefield images and cries generally load from `play.pokemonshowdown.com` or a configured mirror. Room-authored images can originate elsewhere. A package's software license does not automatically grant rights to every external media asset it locates. Do not copy new external media into a release without recording its source and applicable permission/license. The bundled application icons and committed screenshots are maintained in this repository; screenshots can include externally owned game artwork.

Pokémon and Pokémon character names are trademarks of Nintendo. This project is not affiliated with or endorsed by Nintendo, Creatures, GAME FREAK, or Smogon. It remains a client for services operated by others.

## Matching source

`/build-info.json` identifies the version, source revision, repository and license of the built client. Public deployments should point `VITE_SOURCE_URL` at their matching fork and make that revision available. A local modified checkout is development evidence, not proof that the committed tree exactly reproduces its uncommitted changes. Release only an identified reviewed commit and retain its build instructions/lockfile.

When importing upstream regression fixtures, record the source path/revision and retain applicable notices; sanitize private player/account/team data. The audited comparison revision is listed in [compatibility](compatibility.md). Resolve unclear redistribution or media permissions before including the material.
