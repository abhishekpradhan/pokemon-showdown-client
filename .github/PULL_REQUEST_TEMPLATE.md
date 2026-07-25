## Summary

<!-- What changes for the person using the client, and why. -->

## Verification

- [ ] `npm run check` (typecheck, lint, unit tests)
- [ ] `npm run test:e2e`

If this touches `src/compat/`, `api/`, or anything else on the protocol path:

- [ ] `LIVE_PS_TESTS=1 npm run test:live`
- [ ] Played a real battle against a live server

<!-- Say how you verified it. "Tests pass" is not sufficient on its own for
     protocol changes: the suites are mocked, and a mock that shares your
     assumption will keep confirming it. -->

## Regression coverage

- [ ] If this fixes a bug, a test now fails without the fix

<!-- For protocol bugs that usually means teaching e2e/mock-ps.ts to reject the
     wrong behaviour too. -->

## Screenshots

<!-- For UI changes. Before and after, if you changed something that existed. -->

## Licence

- [ ] AGPLv3 attribution and source-availability link remain intact
