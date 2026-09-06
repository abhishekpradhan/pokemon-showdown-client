# Contributing

Contributions should make this client easier to use while preserving Pokémon Showdown protocol compatibility. Read the [current compatibility map](docs/compatibility.md), [architecture](docs/architecture.md) and [roadmap](docs/roadmap.md) before a substantial change.

## Reproducible setup

Use Node 24 (`nvm use`), or Node 22 LTS from 22.13 onward. CI checks both 22.x and 24.x; Node 26 is not supported. Use the committed lockfile:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run dev
```

On Linux, `npx playwright install --with-deps chromium firefox webkit` also installs browser system dependencies. Copy `.env.example` to `.env.local` when customizing endpoints. Existing shell variables override env files; restart Vite after changes. Never post `.env.local`, an OAuth token, a private replay URL, or a raw private-message transcript.

## Validation before a pull request

```sh
npm run check
npm run check:licenses
npm run build
npm run test:e2e -- --grep-invert 'visual baseline'
npm run test:production
```

Screenshot baselines are maintained on macOS with the locked Playwright Chromium version. Run `npm run test:visual`; review actual/diff images before intentionally updating them using `npm run test:visual -- --update-snapshots`. CI gates those screenshots on `macos-15` and browser/mobile flows on Ubuntu. Never update snapshots merely to hide a regression.

`npm run audit:dependencies` checks current registry advisories. A new license or advisory requires maintainer triage; changing the lockfile is part of the change and must be reviewed. Bundle budgets are enforced by every build, covering startup gzip bytes and the entire offline asset set.

## Protocol changes

Use fixtures from the documented upstream baseline and record what the official client does. When fixing a protocol bug, change the mock so it rejects the incorrect behavior, then add a regression covering the real transition. Include singles/doubles, player/spectator and affected generations where relevant. A mock that agrees with the same false assumption is not independent evidence.

For connection/auth/protocol changes, run `npm run test:integration` for the [pinned loopback server](docs/local-integration.md) and retain the generated evidence. `LIVE_PS_TESTS=1 npm run test:live` is an additional public guest-handshake check when network access is available; report any infrastructure limitation. Do not use rated public battles or send public chat as automated tests. See the [release checklist](docs/releases.md).

## Scope, style and reviews

Keep PRs focused on one behavior or cohesive prerequisite, with reproduction, user impact, tests and remaining limitations. Discuss broad redesigns through an issue first. Match surrounding TypeScript and token-based CSS; use dex data instead of guessing mechanics. Subscribe to state slices, keep network/room lifecycle ownership explicit, and preserve keyboard, reduced-motion and mobile behavior.

The repository owner in [CODEOWNERS](CODEOWNERS) reviews protocol, deployment and data migrations. Reviewers check behavior, security boundaries, privacy-safe diagnostics and backward compatibility. Contributions and review times depend on maintainer availability; [SUPPORT.md](SUPPORT.md) documents triage expectations.

## License and community

Contributions are licensed under AGPL-3.0-or-later. Include attribution and license information for copied upstream code, fixtures and assets. Deployments should link to their matching source revision; see [attribution](docs/attribution.md). Follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and send security reports through [SECURITY.md](SECURITY.md).
