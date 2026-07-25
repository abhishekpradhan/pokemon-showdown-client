/**
 * End-to-end smoke test against a real Pokémon Showdown server.
 *
 * Opt-in (LIVE_PS_TESTS=1) because it needs network and touches a live
 * service. Run it before releasing; the mocked suites cannot catch a change
 * in the real handshake.
 *
 * The previous version sent `/trn <name>` with no assertion and then checked
 * for "an |updateuser| frame". The server sends an unnamed |updateuser| on
 * connect, so that check passed even though the name was rejected — which is
 * how a completely broken login shipped green. This version performs the real
 * assertion handshake and requires a *named* confirmation.
 */

if (process.env.LIVE_PS_TESTS !== '1') {
  console.log('Skipping live PS smoke test. Set LIVE_PS_TESTS=1 to run it.');
  process.exit(0);
}

if (!globalThis.WebSocket) {
  throw new Error('This Node.js runtime does not provide WebSocket (needs Node 22+).');
}

const host = process.env.VITE_PS_SERVER_HOST || 'sim3.psim.us';
const port = Number(process.env.VITE_PS_SERVER_PORT || 443);
const prefix = process.env.VITE_PS_SERVER_PREFIX || '/showdown';
const secure = (process.env.VITE_PS_SERVER_SECURE || 'true') !== 'false';
const loginServer = process.env.PS_LOGIN_SERVER || 'https://play.pokemonshowdown.com/action.php';
const url = `${secure ? 'wss' : 'ws'}://${host}:${port}${prefix}/websocket`;

const name = `ArenaSmoke${Math.floor(Math.random() * 100000)}`;
const userid = name.toLowerCase().replace(/[^a-z0-9]/g, '');

const checks = {
  challstr: false,
  assertion: false,
  named: false,
  formats: false,
  lobby: false,
};

const fail = message => {
  console.error(`FAIL: ${message}`);
  console.error(`checks: ${JSON.stringify(checks)}`);
  process.exit(1);
};

const socket = new WebSocket(url);
const timeout = setTimeout(() => fail('timed out after 25s'), 25_000);

socket.addEventListener('open', () => console.log(`connected  ${url}`));
socket.addEventListener('error', () => fail(`unable to connect to ${url}`));

socket.addEventListener('message', async event => {
  for (const line of String(event.data).split('\n')) {
    if (line.startsWith('|challstr|')) {
      checks.challstr = true;
      const challstr = line.slice('|challstr|'.length);

      // The step the client was missing: names must be signed by the login
      // server before the simulator will accept them.
      const response = await fetch(loginServer, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ act: 'getassertion', userid, challstr }),
      });
      const assertion = (await response.text()).trim();
      if (!assertion || assertion.startsWith(';') || assertion.includes('<')) {
        fail(`login server refused an assertion for a fresh guest name: ${assertion.slice(0, 80)}`);
      }
      checks.assertion = true;
      console.log(`assertion  ok (${assertion.length} chars)`);

      socket.send(`|/trn ${name},0,${assertion}`);
      socket.send('|/join lobby');
    }

    // Must be the *named* confirmation: `|updateuser|<name>|1|...`.
    // The unnamed one arrives on connect and proves nothing.
    if (line.startsWith('|updateuser|')) {
      const [, rawName, named] = line.split('|').slice(1);
      if (named === '1' && rawName.replace(/^[^A-Za-z0-9]/, '') === name) {
        checks.named = true;
        console.log(`named      ${rawName.trim()}`);
        // The main server locks accounts from datacenter IPs (the '\u203d'
        // group symbol). A locked account cannot join the lobby, so from CI
        // that check can never pass — waive it rather than fail on
        // infrastructure the test does not control. The handshake checks
        // above are the ones that catch client regressions.
        const group = rawName.charAt(0);
        if (group === '\u203d' || group === '!') {
          checks.lobby = true;
          console.log('lobby      waived (account locked from this IP — datacenter runner)');
        }
      }
    }

    if (line.startsWith('|nametaken|')) fail(`server rejected the name: ${line}`);
    if (line.startsWith('|formats|')) checks.formats = true;
    if (line.startsWith('|init|chat')) checks.lobby = true;
  }

  if (Object.values(checks).every(Boolean)) {
    clearTimeout(timeout);
    socket.close();
    console.log('\nLive PS smoke test passed:', JSON.stringify(checks));
    process.exit(0);
  }
});
