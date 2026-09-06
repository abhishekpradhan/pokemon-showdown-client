# Roadmap

The [September audit](project-audit-2026-09-05.md) is the historical evidence-backed backlog. [Implementation status](implementation-status.md) records delivered changes and remaining integrated verification separately. The [1.2 parity work](parity-completion.md) and [GitHub acceptance backlog](https://github.com/abhishekpradhan/pokemon-showdown-client/issues) give each remaining item concrete completion criteria.

The release priorities are player identity and saved-data correctness; valid battle decisions and known information; reliable chat/replay/tournament workflows; keyboard/mobile accessibility; and enforced production/offline/security/open-source quality. Compatibility and negative failure cases accompany each feature rather than following a visual redesign later.

## Maintained workstreams

| Workstream | Owner | Completion evidence |
| --- | --- | --- |
| Protocol, authentication and reconnect | Repository maintainer / future consenting domain owner | Transition fixtures and controlled real-server verification |
| Battle rendering/choices and generation support | Repository maintainer | Supported request corpus and capability gating |
| Team portability and persistence | Repository maintainer | Round-trip fixtures, migration/recovery and editor flows |
| Chat, replay and community workflows | Repository maintainer | End-to-end lifecycle and privacy/security regression tests |
| Accessibility and browser support | Repository maintainer | Browser/mobile/axe plus reviewed keyboard/visual evidence |
| Dependencies, hosting, offline and releases | Repository maintainer | Advisory/license/build gates, deployed smoke and provenance |

Good first contributions include isolated reproduction fixtures, clearer recovery messages, keyboard-label fixes and documentation corrections with verified screenshots or commands. Broader protocol or storage changes should be split around specific invariant/transition tests and reviewed before expansion.

A rewritten framework, server-side rendering, background push, packaged desktop shell or cloud account/team synchronization is not required merely to appear modern. Adopt new infrastructure when an agreed user workflow needs it and its ownership/privacy/support costs are clear.

## Current acceptance backlog

- [#11: Team, battle, preference and quality parity release](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/11).
- [#12: Physical devices and assistive technology](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/12), using the [manual matrix](manual-acceptance.md).
- [#13: Dedicated registered-account production acceptance](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/13).
- [#14: Rotation, pending a playable upstream protocol](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/14).

The repository maintainer owns these items and may accept focused contributions. Close issues only when their acceptance evidence exists; an unavailable device or upstream feature is not a test pass.
