# Modern Client

The modern fork lives in `modern-client/`.

## Stack

- React and TypeScript
- Vite
- TanStack Router
- Tailwind CSS v4
- Radix Primitives
- Motion
- Zustand
- Vitest
- Playwright

## Local Development

```bash
npm --prefix modern-client ci
npm run modern:dev
```

## Verification

```bash
npm run modern:typecheck
npm run modern:lint
npm run modern:test
npm run modern:build
npm run modern:e2e
```

## Compatibility Boundary

The scaffold isolates PS compatibility work under `modern-client/src/compat/`.
The first production parity work should replace the demo adapters there with
imports or wrappers around battle, protocol, team, replay, and dex logic from the
existing client.
