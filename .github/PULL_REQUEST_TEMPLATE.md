## Behavior

<!-- Describe the concrete problem, resulting behavior and linked issue/audit acceptance criteria. -->

## Evidence

- [ ] `npm run check` (includes API/E2E typechecking and unit tests)
- [ ] `npm run check:licenses`
- [ ] `npm run build` (includes bundle budgets/provenance)
- [ ] Relevant desktop/mobile, accessibility and production tests
- [ ] `npm run test:integration` for changed protocol/battle/tournament workflows
- [ ] Visual changes reviewed with before/after screenshots and intentional baseline updates

<!-- List the commands/results and any real limitations. For protocol changes include affected formats, transition fixtures, and controlled real-server evidence. The live handshake smoke alone does not validate a battle. -->

## Compatibility and maintenance

- [ ] Failure, cancellation, reconnect and storage migration behavior considered where affected
- [ ] Regression demonstrates the prior failure, including mock rejection when applicable
- [ ] Privacy/security-sensitive data is absent from logs, screenshots and fixtures
- [ ] Documentation, compatibility status and changelog match the final change
- [ ] Upstream attribution, dependency notices and deployed source link preserved

<!-- Document remaining limitations or why a checklist item is not applicable. -->
