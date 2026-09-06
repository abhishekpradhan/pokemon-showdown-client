# Offline use and updates

After the production worker successfully installs, it caches the app shell, bundled JavaScript/CSS, local team editor, game data, manifest/icons and source/license inventory. This is a several-megabyte download subject to browser storage availability. Initial use still requires a network connection; an interrupted or quota-limited installation does not promise offline availability. Check the installation state in Settings.

Offline users can open existing local teams, edit/save them in available browser storage and export a backup. Network battles, naming/OAuth, remote ladder/replay requests, sharing and external room media require connectivity. Uncached sprite/audio requests may fail gracefully. Private browsing and some embedded browsers may not retain worker caches or local data.

## Consistent releases

Each build generates a manifest and identity shared by its shell and worker. Installation rejects a shell from a different deployment. Navigations use the installed version's shell; OAuth callbacks and API requests are never cached as app documents. A completed update waits for the user to apply it, or for all older tabs to close, instead of interrupting a game.

Applying an update reloads the tab. Finish live battles and ensure edits are saved first. The cache retains the active build and one previous build for older tabs, then removes earlier Arena caches. Close/reload old tabs when updating repeatedly; indefinitely running tabs across multiple releases are not supported. Unrelated applications' caches are left alone.

## Recovery

1. Reconnect to the network and check for updates in Settings.
2. If a file remains stale or missing, use **Repair app cache**. This removes only Arena app caches/worker registration and reloads; it does not erase teams or tokens.
3. If local team data itself is corrupt, use the team's storage recovery/backup options. Export recoverable data before clearing site data.
4. Report persistent failures with the build revision, browser and sanitized error. Never share tokens or private teams in a public report.

Automated worker tests cover callback/API exclusion, matching installation, quota failure, offline editor resources, previous-version retention and cleanup. Production browser tests cover online callback followed by offline app/editor use. Release checks should also include an actual prior-to-next deployment upgrade and a real mobile installation.
