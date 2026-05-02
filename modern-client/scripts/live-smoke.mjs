const enabled = process.env.LIVE_PS_TESTS === '1';

if (!enabled) {
  console.log('Skipping live PS smoke test. Set LIVE_PS_TESTS=1 to run it.');
  process.exit(0);
}

if (!globalThis.WebSocket) {
  throw new Error('This Node.js runtime does not provide WebSocket.');
}

const host = process.env.VITE_PS_SERVER_HOST || 'sim3.psim.us';
const port = Number(process.env.VITE_PS_SERVER_PORT || 443);
const prefix = process.env.VITE_PS_SERVER_PREFIX || '/showdown';
const secure = (process.env.VITE_PS_SERVER_SECURE || 'true') !== 'false';
const protocol = secure ? 'wss' : 'ws';
const url = `${protocol}://${host}:${port}${prefix}/websocket`;
const socket = new WebSocket(url);
const seen = {
  challstr: false,
  updateuser: false,
  lobby: false,
};

const timeout = setTimeout(() => {
  socket.close();
  throw new Error(`Timed out waiting for live PS smoke events: ${JSON.stringify(seen)}`);
}, 20_000);

socket.addEventListener('open', () => {
  console.log(`Connected to ${url}`);
});

socket.addEventListener('message', event => {
  const data = String(event.data);
  if (data.includes('|challstr|')) {
    seen.challstr = true;
    const name = `CodexGuest${Math.floor(Math.random() * 100000)}`;
    socket.send(`|/trn ${name}`);
    socket.send(`|/join lobby`);
  }
  if (data.includes('|updateuser|')) seen.updateuser = true;
  if (data.startsWith('>lobby') || data.includes('|init|chat')) seen.lobby = true;

  if (seen.challstr && seen.updateuser && seen.lobby) {
    clearTimeout(timeout);
    socket.close();
    console.log('Live PS smoke test passed.');
  }
});

socket.addEventListener('error', () => {
  clearTimeout(timeout);
  throw new Error(`Unable to connect to ${url}`);
});
