# Contributing

Bug reports, protocol compatibility reports, documentation fixes and focused pull requests are all welcome. Before a substantial change, read [docs/compatibility.md](docs/compatibility.md) and [docs/architecture.md](docs/architecture.md), and open an issue first for broad redesigns so the scope is agreed before the work.

## Setup

Use Node 24 (`nvm use`) or Node 22.13+, and the committed lockfile:

```sh
npm ci
npx playwright install chromium firefox webkit   # browser tests; add --with-deps on Linux
npm run dev
```

Copy `.env.example` to `.env.local` to change servers or endpoints. Shell variables override env files, and Vite must be restarted after changes. Keep credentials out of `VITE_` variables, and never commit or post environment files, OAuth tokens, private replay URLs or private-message transcripts.

## Validation

Before opening a PR: `npm run check` (typecheck, lint, Prettier check, unit tests). For UI changes also `npm run test:e2e -- --project=chromium`. CI runs the full browser matrix, macOS visual baselines, and the production and integration checks; [docs/testing.md](docs/testing.md) describes each tier and how to run it locally.

`npm run format` applies the project's Prettier style: two-space indentation, single quotes and 110-column lines. Screenshot baselines are compared on macOS; review the diff images before updating them with `npm run test:visual -- --update-snapshots`, and never update a baseline to hide a regression.

## Protocol changes

Test against what the official client actually does. When fixing a protocol bug, first make the mock reject the wrong behaviour, then add a regression for the real transition, covering singles and doubles, player and spectator, and affected generations where relevant. For connection, authentication or protocol changes also run `npm run test:integration`. Never use rated public battles or public chat as test traffic. [docs/testing.md](docs/testing.md) has the details, including the recorded protocol corpus and the pinned server.

## Scope and style

Keep each PR to one behaviour, with the reproduction, user impact and tests in the description. Match the surrounding TypeScript and token-based CSS, use dex data instead of guessing mechanics, subscribe to state slices rather than whole stores, keep network and room lifecycle ownership explicit, and preserve keyboard, reduced-motion and mobile behaviour.

[@abhishekpradhan](https://github.com/abhishekpradhan) reviews pull requests, with particular attention to protocol, deployment and data-migration changes. This is a volunteer project; [SUPPORT.md](SUPPORT.md) sets expectations for review and triage times.

## License and community

Contributions are licensed under AGPL-3.0-or-later. Include attribution and license information for any copied upstream code, fixtures or assets; [docs/attribution.md](docs/attribution.md) explains what is already tracked. Follow the [code of conduct](CODE_OF_CONDUCT.md), and report security issues privately through [SECURITY.md](SECURITY.md).
