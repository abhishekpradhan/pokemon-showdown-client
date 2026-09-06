# Release and rollback process

The maintainer in CODEOWNERS owns releases, upstream compatibility drift and dependency/security triage. Versions use major/minor/patch changes: breaking persisted-data or externally supported configuration changes require explicit migration notes; feature releases are minor, compatible fixes are patch releases. The latest published stable version is supported; do not imply support for every historic tag.

## Prepare a concrete release

1. Choose the intended version and update `package.json`, lockfile and CHANGELOG. Record exact commit and tested upstream/dependency versions. Keep the historical audit intact and update the separate implementation-status/compatibility documents.
2. Ensure `npm ci`, `npm run check`, `npm run check:licenses`, `npm run audit:dependencies`, `npm run build`, relevant browser/mobile/visual tests and `npm run test:production` pass. Review advisory fixes, new license expressions and bundle-budget changes instead of bypassing the gates.
3. Test current and previous team-storage schema fixtures, lossless imports/exports, migration interruption, failed save and recovery. Provide a backup/export path and migration/rollback instructions for changed storage. A deployment rollback must not silently corrupt a newer schema.
4. Run `npm run test:integration` and retain its [pinned local-server evidence](local-integration.md). Record additional controlled evidence for changed login, reconnect and replay publishing workflows. The public guest smoke is advisory infrastructure evidence, not proof that a battle works. Investigate its latest failure before releasing; maintainers should subscribe to GitHub Actions failure notifications.
5. Review keyboard/light/dark/reduced-motion/mobile changes and actual visual diffs. Check private data is absent from release evidence and committed fixtures.

## Publish and verify

Create the version tag/release at the reviewed commit, describing behavior, tests, migration and known partial features. Deploy that exact revision. Build provenance uses the hosting commit SHA (or the local Git revision) and the configured source repository. Verify `/build-info.json`, the Settings source/version display and the public source tree agree.

Run the deployed smoke from [self-hosting](self-hosting.md): static callback routing and headers, guest/OAuth where registered, controlled battle/reconnect, replay endpoints and an old-to-new worker update. Offline team editing must work after installation. Keep the previous deployment ready while verifying. Update release notes with links to CI and deployment evidence rather than claiming unrun tests.

## Rollback

Restore the previous immutable deployment, verify its source metadata and live connection, and communicate the affected version/recovery steps in the release record. Browser workers only activate a new app version after their manifest is installed; users can apply it or repair app caches without clearing teams. Consider storage compatibility before rollback; preserve exports/recovery records and prefer a forward fix if the older client cannot read the current schema.

## Repository controls to verify remotely

The files in this repository cannot enable host settings. Before a public release, verify private vulnerability reporting, appropriate branch rules/required reviews, required CI statuses, restricted deployment credentials and secret scanning where available. At minimum require both Node quality checks, dependency advisories, supported-browser flows, visual baselines and production boundary/budget checks. Use least-privilege deployment credentials and review changes to workflows/CODEOWNERS. Record any unavailable setting and its operational alternative.
