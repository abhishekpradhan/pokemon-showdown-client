# Privacy, local storage and network use

Showdown Arena stores its local teams, editor preferences and server selection in browser storage. A configured OAuth sign-in stores a provider token and its metadata so the browser can request fresh assertions. Tokens are credentials: never paste them into reports, shared screenshots, console snippets or `VITE_` configuration. Logout clears the client's saved OAuth authorization; account/provider session controls are separate.

## Where requests go

| Data or request | Destination |
| --- | --- |
| Battle decisions, sent teams, chat, PMs and server commands | Selected battle server over its WebSocket |
| Guest name/challenge assertion request | This deployment's `/api/action`, then configured login server |
| Registered authorization and token/assertion exchange | Configured OAuth provider; passwords are entered there |
| Replay upload after choosing save/share | Modern battle server uploads and returns the saved URL; legacy `/api/replay` forwards to the configured login service |
| Replay URL download | The requested replay host |
| Ladder lookup | Configured ladder host; it can differ from the battle server |
| Sprites, icons and cries | Configured asset host, official Showdown by default |
| Images/backgrounds in room HTML | Hosts chosen by the room content author, limited by sanitizer/CSP |
| App files, dependency inventory and build metadata | This deployment and its hosting infrastructure |

Requests expose normal network information such as IP address to their destination and intermediaries. Room-authored images can contact third parties when displayed. The app does not add an analytics service. Hosting providers and connected services may keep their own operational logs under their policies. The proxies do not log request bodies or cache credential/replay responses.

The bundled Pokédex is distributed with the app. Sprites/audio are generally loaded externally. Local edits stay in this browser until an action sends a team or exports/shares data. A replay save can publish battle information: review the visibility and resulting URL, especially for private games.

## Retention, backup and removal

Teams and preferences persist until removed in the app or through browser site-data controls. Export a backup before clearing site data, moving browsers, using a temporary/private session or testing a storage migration. Browser storage can be unavailable or evicted; a local client is not an off-device backup service. Keep exported private teams somewhere appropriate for you.

Client cache repair removes only generated app resources and service-worker registrations, not localStorage teams, credentials or preferences. Clearing all browser site data is broader and removes those records too. Offline caches contain this app's files and game data, not OAuth responses, API results or arbitrary third-party media.

Detailed diagnostic logs can include private information. Use the separate share-safe export, inspect its preview, and remove anything sensitive before posting. The bug/protocol forms are public. [Private vulnerability reporting](../SECURITY.md) is separate.

Self-hosted forks must update this notice when adding analytics, synchronization, different data services or storage. See [self-hosting](self-hosting.md) for endpoint ownership.
