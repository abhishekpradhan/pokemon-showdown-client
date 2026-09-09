# Offline use and updates

Once the production service worker has installed, it caches the app shell, the bundled JavaScript and CSS, the team editor, game data, the manifest and icons, and the source and license inventory. That is a download of several megabytes, subject to the browser's storage limits, and it needs a network connection the first time. An interrupted or quota-limited installation does not promise offline availability; Settings shows the installation state.

Offline, you can open existing local teams, edit and save them, and export a backup. Network battles, naming and OAuth, ladder and replay requests, sharing and external room media need connectivity. Uncached sprite and audio requests fail gracefully. Private browsing and some embedded browsers may not keep worker caches or local data.

## Consistent releases

Each build generates a manifest and identity shared by its shell and worker, and installation rejects a shell from a different deployment. Navigations use the installed version's shell; OAuth callbacks and API requests are never cached as app documents. A completed update waits for you to apply it, or for all older tabs to close, instead of interrupting a game.

Applying an update reloads the tab, so finish live battles and save edits first. The cache keeps the active build and one previous build for older tabs, then removes earlier Arena caches. Close or reload old tabs when updating repeatedly; a tab left running across several releases is not supported. Other applications' caches are left alone.

The first upgrade from 1.0 clears its unversioned legacy caches; close or reload other 1.0 tabs after applying it. Later releases keep the current and previous versioned caches.

## Recovery

1. Reconnect to the network and check for updates in Settings.
2. If a file stays stale or missing, use **Repair app cache**. This removes only Arena's app caches and worker registration and reloads; it does not erase teams or tokens.
3. If local team data itself is corrupt, use the team's storage recovery and backup options. Export recoverable data before clearing site data.
4. Report persistent failures with the build revision, browser and sanitised error.

Worker and production tests cover callback and API exclusion, matching installation, quota failure, offline editor resources, previous-version retention, consent before activation and successive updates; see [testing](testing.md). Release checks add a real hosted upgrade from the previous deployment.
