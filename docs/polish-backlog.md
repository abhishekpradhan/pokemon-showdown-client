# Modern Client Polish Backlog

## UI/UX

- Tighten the battle decision hierarchy around timer, active Pokemon, move risk, and switch availability.
- Replace temporary panel copy with real state labels as protocol wiring lands.
- Add a compact battle layout for laptops where the field, controls, and log all remain visible.
- Define empty, loading, offline, reconnecting, invalid choice, and locked-choice states.

## Accessibility

- Keep all interactive targets at least 44px where layout allows.
- Preserve visible focus rings and skip-link behavior.
- Verify color contrast for type buttons, HP bars, status chips, and disabled states.
- Add keyboard flows for format selection, battle choices, chat entry, dialogs, and navigation.

## Visual QA

- Expand Playwright smoke coverage for home, direct battle route, teambuilder, settings, and mobile.
- Add deterministic visual snapshots after the UI stabilizes and CI runs on one OS/browser target.
- Add layout checks for horizontal overflow and critical control visibility.

## Codebase

- Replace demo adapters in `modern-client/src/compat/` with typed wrappers around PS protocol, battle, team, replay, and dex logic.
- Move large surfaces toward route-level code splitting once real parity screens are implemented.
- Keep protocol, room, battle, team, and preferences state isolated from presentational components.
