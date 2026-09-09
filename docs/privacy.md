# Privacy, local storage and network use

Showdown Arena keeps your teams, editor preferences and server selection in browser storage. Signing in with OAuth stores a provider token and its metadata so the browser can request fresh assertions; that token is a credential, so keep it out of reports, screenshots and `VITE_` configuration. Logging out clears the client's saved OAuth authorisation; the provider's own account session is separate.

## Where requests go

| Data or request | Destination |
| --- | --- |
| Battle decisions, sent teams, chat, PMs and server commands | Selected battle server over its WebSocket |
| Guest name/challenge assertion request | This deployment's `/api/action`, then configured login server |
| Registered authorization and token/assertion exchange | Configured OAuth provider; passwords are entered there |
| Replay upload after choosing save/share | Modern battle server uploads and returns the saved URL; legacy `/api/replay` forwards to the configured login service |
| Replay URL download | The requested replay host |
| Ladder lookup | Configured ladder host; it can differ from the battle server |
| Sprites, icons, cries and optional battle music | Configured asset host, official Showdown by default |
| Sample sets requested in the teambuilder | Official `play.pokemonshowdown.com/data/sets/` (no account credentials sent) |
| Personal background image selected in Settings | Stays in browser IndexedDB; never uploaded |
| Images/backgrounds in room HTML | Hosts chosen by the room content author, limited by sanitizer/CSP |
| App files, dependency inventory and build metadata | This deployment and its hosting infrastructure |

Requests expose normal network information such as IP address to their destination and intermediaries. Room-authored images can contact third parties when displayed. The app does not add an analytics service. Hosting providers and connected services may keep their own operational logs under their policies. The proxies do not log request bodies or cache credential/replay responses.

The bundled Pokédex is distributed with the app. Sprites/audio are generally loaded externally. Local edits stay in this browser until an action sends a team or exports/shares data. A replay save can publish battle information: review the visibility and resulting URL, especially for private games.

## Retention, backup and removal

Personal background images are limited to one image up to 1 MB and can be removed in Settings. Sample-set responses are held in a bounded in-memory cache; they are not a cloud copy of your teams.

Teams and preferences persist until removed in the app or through browser site-data controls. Export a backup before clearing site data, moving browsers, using a temporary/private session or testing a storage migration. Browser storage can be unavailable or evicted; a local client is not an off-device backup service. Keep exported private teams somewhere appropriate for you.

Client cache repair removes only generated app resources and service-worker registrations, not localStorage teams, credentials, preferences or your IndexedDB background image. Clearing all browser site data is broader and removes those records too. Offline caches contain this app's files and game data, not OAuth responses, API results or arbitrary third-party media.

Detailed diagnostic logs can include private information. Use the share-safe export, inspect its preview, and remove anything sensitive before posting; the bug and protocol forms are public. Security reports go through [SECURITY.md](../SECURITY.md).

A self-hosted fork that adds analytics, synchronisation, other data services or storage must update this notice. See [self-hosting](self-hosting.md) for which endpoint each setting controls.
