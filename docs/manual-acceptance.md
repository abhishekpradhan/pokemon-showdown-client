# Manual release acceptance

Record the deployed version and `build-info.json` source revision, date, OS/browser versions and device model with every result. Use a dedicated account and private test rooms. Record only pass/fail observations; do not publish passwords, tokens, callback URLs, private room IDs or unredacted protocol logs. A skipped row remains unverified.

## Registered account

Tracked in [#13](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/13).

1. Open the official Pokémon Showdown website and sign in directly to the dedicated account. Open Arena's account dialog and select **Sign in with Pokémon Showdown**. Review the official authorization page and authorize the production origin.
2. Confirm Arena waits for the battle server's named-user acknowledgement, then shows the expected account. Cancel a fresh authorization attempt and check that another account cannot appear from a stale popup.
3. Choose an avatar and server language. Wait for confirmation; reload and reconnect. Verify the name, intended joined rooms and confirmed preferences return without repeated room rejoins.
4. Log out in Arena and reload. Verify that Arena stays logged out. The official site's own session is separate; Arena logout must not imply otherwise.
5. Reauthorize. If testing provider revocation, use the dedicated account's official authorization controls, then confirm Arena reports an actionable expired/revoked-session recovery and can sign in again.
6. Record real production observations separately from controlled refresh/rotation tests. Do not change clocks or extract live provider tokens to simulate token ageing.

## Physical phones and assistive technology

Tracked in [#12](https://github.com/abhishekpradhan/pokemon-showdown-client/issues/12). No physical phones were available during the 1.2 implementation. Playwright's mobile Chromium and desktop WebKit are emulation, not an iPhone or Android hardware pass.

| Workflow | iPhone / Safari | Android / Chrome | VoiceOver / Safari | NVDA / Firefox or Chrome |
| --- | --- | --- | --- | --- |
| Navigation, 200% zoom/large text, theme, reduced motion | Unverified | Unverified | Unverified | Unverified |
| Account dialog, keyboard/IME, validation, Escape/focus return | Unverified | Unverified | Unverified | Unverified |
| Team search/import, sample preview/apply/undo, EV suggestions/manual edit/save/reload | Unverified | Unverified | Unverified | Unverified |
| Singles/doubles/triples target and switch controls, four-player owners, turn announcements | Unverified | Unverified | Unverified | Unverified |
| Avatar search/selection/confirmation, language, background upload/removal | Unverified | Unverified | Unverified | Unverified |
| Background/resume, reconnect, orientation and audio pause | Unverified | Unverified | Unverified | Unverified |
| Installed offline restart and consented upgrade preserving saved teams | Unverified | Unverified | Unverified | Unverified |

For screen readers, check names/roles/states, logical heading and focus order, dialog trapping/return, focus after navigation, choice/error announcements and absence of repeated turn chatter. For phones, include real soft-keyboard resizing and rotation during input, touch targets without hover, background/resume, poor connectivity, storage eviction and installation. Do not enable assistive software in another person's active browser session without coordinating its use.

## Long sessions and slow devices

`npm run test:stress` runs deterministic high-volume traffic and verifies bounded room/chat/log/profile/error state plus measured retained heap and frame processing time after warmup. It is a repeatable regression guard, not a physical-device benchmark. On real hardware, keep an unrated test battle and chat room open through background/resume and reconnect, then repeat editing and navigation. Record interaction latency and any accumulating playback, listeners, stale choices or focus loss. Use a dedicated test environment for generated traffic; never load-test public Showdown.
