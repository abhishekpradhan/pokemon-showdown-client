# Releases and rollback

[@abhishekpradhan](https://github.com/abhishekpradhan) cuts releases and triages upstream compatibility drift and dependency advisories. Versions follow semantic versioning: a change to persisted data or externally supported configuration that needs migration is a major release with explicit notes, new features are minor releases, and compatible fixes are patch releases. The latest published version is the supported one.

## Prepare

1. Choose the version and update `package.json`, the lockfile and [CHANGELOG.md](../CHANGELOG.md). Update [compatibility](compatibility.md) if the supported workflows changed.
2. Make sure `npm ci`, `npm run check`, `npm run check:licenses`, `npm run audit:dependencies`, `npm run build`, the browser, mobile and visual tests, and `npm run test:production` pass. Fix advisories, new license expressions and bundle-budget changes rather than bypassing the gates.
3. Test the current and previous team-storage schemas: lossless imports and exports, interrupted migration, failed saves and recovery. Any storage change ships with a backup/export path and migration and rollback instructions, and a deployment rollback must never silently corrupt a newer schema.
4. Run `npm run test:integration` and keep its report; record extra controlled evidence for changed login, reconnect and replay workflows. The public guest smoke is advisory infrastructure evidence, not proof that a battle works: investigate its latest failure before releasing. See [testing](testing.md).
5. Review keyboard, light/dark, reduced-motion and mobile changes and the actual visual diffs. Check that release evidence and committed fixtures contain no private data.

## Publish and verify

Create the tag and GitHub release at the reviewed commit, describing behaviour, tests, migration and known partial features, and deploy that exact revision. Build provenance uses the hosting commit SHA (or the local Git revision) and the configured source repository; `/build-info.json`, the Settings → About display and the public source tree must agree.

Run the deployed checks from [self-hosting](self-hosting.md): static callback routing and headers, guest sign-in and OAuth where registered, a controlled battle with a reconnect, the replay endpoints, and a worker update from the previous version. Offline team editing must work after installation. Keep the previous deployment ready while verifying, and link CI and deployment evidence in the release notes rather than claiming unrun tests.

After confirming the deployed source revision, run the guest-proxy check against the deployment (replace the origin for another installation):

```sh
LIVE_PS_TESTS=1 LIVE_APP_URL=https://showdown-arena.vercel.app npm run test:live
```

A failure blocks the release: a successful direct-provider smoke cannot substitute for a failed deployed `/api/action` request. The check uses an ephemeral guest, sends no chat or matchmaking commands, and requires a signed assertion plus the simulator's named acknowledgement. It does not replace the registered OAuth, controlled battle, replay and offline/update checks above.

## Rollback

Restore the previous immutable deployment, verify its source metadata and live connection, and record the affected version and recovery steps in the release. Browser workers only activate a new app version after its manifest is installed, so users can apply the rollback or repair app caches without losing teams. Consider storage compatibility first: if the older client cannot read the current schema, prefer a forward fix and preserve exports and recovery records.
