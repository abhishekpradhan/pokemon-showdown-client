# Changelog

## 1.1.0 — 2026-09-05

This release addresses the September 2026 project audit. Its release notes record the verified revision, CI results and deployment evidence.

- Strengthen authentication, transport, team portability/persistence and protocol lifecycle behavior; see the implementation status for exact acceptance evidence.
- Add supported battle/editor/community workflow improvements with explicit capability and compatibility behavior.
- Replace unbounded app caching with a versioned offline manifest, update consent and cache repair that preserves local teams.
- Bound/test production proxies, add CSP and safe interactive room-content rules, and update vulnerable dependencies.
- Check API/browser-test TypeScript, desktop/mobile/browser/visual and production paths; enforce license/advisory/bundle gates.
- Publish current compatibility, privacy, self-hosting, contribution/release documentation and matching-source/dependency build metadata.

Existing local teams migrate to a versioned, recoverable library. Export a complete backup before downgrading to an older client. See [release checklist](docs/releases.md) and [implementation status](docs/implementation-status.md) for the verification record and explicit support limits.

## 1.0.0 — existing baseline

The repository declared version 1.0.0 before this release process was introduced. Its source history contains the initial independent client, engine integration, teams, room/replay/ladder surfaces, sound, notifications, PWA and tournament UI. No historical release date or tag is inferred here.
