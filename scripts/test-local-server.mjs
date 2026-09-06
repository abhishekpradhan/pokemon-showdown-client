import assert from 'node:assert/strict';
import { execFileSync, fork } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { build } from 'esbuild';

// Updating this pin is a reviewed compatibility change, never a floating clone.
const revision = '2f5b273925862ac242b419086c1e7a8868b51da1';
const root = process.cwd();
const existing = process.env.ARENA_PS_TEST_DIR;
const directory = existing ? resolve(existing) : mkdtempSync(join(tmpdir(), 'arena-showdown-'));
assert(directory.startsWith(resolve(tmpdir()) + sep) || directory.startsWith('/tmp/'), 'The server must be a disposable temporary checkout.');
const run = (command, args) => execFileSync(command, args, { cwd: directory, stdio: 'inherit' });
if (!existsSync(join(directory, '.git'))) {
  run('git', ['init', '--quiet']);
  run('git', ['remote', 'add', 'origin', 'https://github.com/smogon/pokemon-showdown.git']);
  run('git', ['fetch', '--depth', '1', 'origin', revision]);
  run('git', ['checkout', '--detach', 'FETCH_HEAD']);
}
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim(), revision);
if (!existsSync(join(directory, 'node_modules/esbuild'))) {
  run('npm', ['ci', '--omit=dev', '--omit=optional', '--ignore-scripts']);
  // The sole necessary install script obtains esbuild's platform-specific binary.
  run(process.execPath, ['node_modules/esbuild/install.js']);
}
run(process.execPath, ['build']);
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
writeFileSync(join(directory, 'config/config.js'), `exports.port = ${port};
exports.bindaddress = '127.0.0.1';
exports.serverid = 'arenalocal';
exports.noguestsecurity = true;
exports.nothrottle = true;
exports.noipchecks = true;
exports.noNetRequests = true;
exports.nofswriting = true;
exports.backdoor = false;
exports.consoleips = [];
exports.repl = false;
exports.watchconfig = false;
exports.crashguard = false;
exports.logchat = false;
exports.autosavereplays = false;
exports.ratedtours = false;
exports.loginserver = 'http://127.0.0.1:1/';
exports.routes = {replays: '127.0.0.1:1', client: '127.0.0.1:1'};
exports.subprocesses = {network: 1, simulator: 1, validator: 1, verifier: 0, localartemis: 0, remoteartemis: 0, friends: 0, chatdb: 0, modlog: 0, pm: 0, battlesearch: 0, datasearch: 0};
`);
const modulePath = join(directory, 'arena-protocol.mjs');
await build({ entryPoints: [resolve('src/compat/protocol-client.ts')], bundle: true, platform: 'node', format: 'esm', outfile: modulePath, define: { 'import.meta.env': '{}' } });
const { ProtocolClient } = await import(pathToFileURL(modulePath).href);
globalThis.window = globalThis;
const server = fork(resolve('scripts/local-server-bootstrap.cjs'), [], {
  cwd: directory,
  env: { PATH: process.env.PATH, TMPDIR: tmpdir(), NODE_OPTIONS: `--require=${resolve('scripts/local-server-guard.cjs')}` },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  detached: process.platform !== 'win32',
});
let serverLog = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLog = (serverLog + chunk).slice(-30_000); });
const clients = [];
const evidence = [];
const deadline = setTimeout(() => { console.error('Local integration exceeded its 120-second limit.'); cleanup(); process.exit(1); }, 120_000);
function cleanup() {
  clearTimeout(deadline);
  clients.forEach(client => client.client.disconnect());
  try { if (process.platform === 'win32') server.kill(); else process.kill(-server.pid, 'SIGTERM'); } catch { /* already stopped */ }
}
function childMessage(type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error(`Server did not send ${type}.`)); }, 20_000);
    const onMessage = message => { if (message.type === type) { stop(); resolve(message); } };
    const onExit = code => { stop(); reject(new Error(`Local server exited ${code}.`)); };
    function stop() { clearTimeout(timer); server.off('message', onMessage); server.off('exit', onExit); }
    server.on('message', onMessage); server.on('exit', onExit);
  });
}
function participant(name) {
  const client = new ProtocolClient({ id: 'arenalocal', host: '127.0.0.1', port, prefix: '/showdown', secure: false, loginServer: 'http://127.0.0.1:1/' });
  const frames = [];
  const listeners = new Set();
  client.subscribe(event => { if (event.type === 'frame') { frames.push(event.frame); listeners.forEach(check => check()); } });
  const entry = { client, frames, send: (command, room = '') => assert(client.send(command, room), `Unable to send ${command.split(' ')[0]}`),
    wait(predicate, label, from = 0) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { listeners.delete(check); reject(new Error(`${name}: timeout waiting for ${label}. Last protocol: ${frames.slice(-3).map(frame => frame.raw).join('\n').slice(-2500)}`)); }, 20_000);
        function check() { const frame = frames.slice(from).find(predicate); if (frame) { clearTimeout(timer); listeners.delete(check); resolve(frame); } }
        listeners.add(check); check();
      });
    },
  };
  clients.push(entry);
  client.connect();
  return entry;
}
const line = (command, predicate = () => true) => frame => frame.lines.some(item => item.command === command && predicate(item.args));
async function playTurnAndFinish(alice, bob, room, from = 0) {
  const requests = await Promise.all([alice, bob].map(player => player.wait(frame => frame.roomId === room && line('request', args => !!JSON.parse(args.join('|')).active)(frame), 'battle request', from)));
  requests.forEach((frame, index) => {
    const request = JSON.parse(frame.lines.find(item => item.command === 'request').args.join('|'));
    assert(request.rqid > 0 && request.side.pokemon.length === 6, 'Real simulator must provide a full team and request ID.');
    [alice, bob][index].send(`/choose default|${request.rqid}`, room);
  });
  await Promise.all([alice, bob].map(player => player.wait(frame => frame.roomId === room && line('turn', args => Number(args[0]) >= 2)(frame), 'resolved turn', from)));
  alice.send('/forfeit', room);
  await Promise.all([alice, bob].map(player => player.wait(frame => frame.roomId === room && line('win', args => args[0] === 'ArenaBob')(frame), 'battle win', from)));
}
try {
  await childMessage('ready');
  const alice = participant('ArenaAlice');
  const bob = participant('ArenaBob');
  for (const [player, name] of [[alice, 'ArenaAlice'], [bob, 'ArenaBob']]) {
    await player.wait(line('challstr'), 'real server handshake');
    await player.wait(line('formats'), 'real format catalog');
    player.send(`/trn ${name},0,`);
    await player.wait(line('updateuser', args => args[0].trim() === name && args[1] === '1'), 'guest login');
    player.send('/utm null');
  }
  evidence.push('Two real protocol clients: handshake, format catalog and guest identity accepted.');
  alice.send('/challenge ArenaBob, gen9randombattle');
  await bob.wait(line('pm', args => args[0].trim() === 'ArenaAlice' && args[2] === '/challenge gen9randombattle'), 'incoming direct challenge');
  bob.send('/accept ArenaAlice');
  const initial = await alice.wait(frame => frame.roomId.startsWith('battle-') && line('init', args => args[0] === 'battle')(frame), 'unrated battle initialization');
  assert(!initial.lines.some(item => item.command === 'rated'), 'Direct challenge must be unrated.');
  await playTurnAndFinish(alice, bob, initial.roomId);
  evidence.push('Unrated Gen9 random battle: challenge, accept, request/rqid, legal choices, resolved turn, forfeit and authoritative win.');
  const roomReady = childMessage('room-ready'); server.send({ type: 'prepare-room' }); await roomReady;
  for (const player of [alice, bob]) { player.send('/join arenatest'); await player.wait(frame => frame.roomId === 'arenatest' && line('init')(frame), 'private tournament room'); }
  alice.send('/tour new gen9randombattle, elimination', 'arenatest');
  await bob.wait(line('tournament', args => args[0] === 'create'), 'tournament creation');
  for (const player of [alice, bob]) player.send('/tour join', 'arenatest');
  await alice.wait(line('tournament', args => args[0] === 'join' && args[1] === 'ArenaBob'), 'tournament signup');
  alice.send('/tour start', 'arenatest');
  const candidates = await Promise.all([alice, bob].map(player => player.wait(line('tournament', args => args[0] === 'update' && (JSON.parse(args[1]).challenges?.length || JSON.parse(args[1]).challengeBys?.length)), 'available tournament pairing')));
  const challengerIndex = candidates.findIndex(frame => frame.lines.some(item => item.command === 'tournament' && item.args[0] === 'update' && JSON.parse(item.args[1]).challenges?.length));
  const challenger = [alice, bob][challengerIndex], opponent = [bob, alice][challengerIndex];
  challenger.send(`/tour challenge ${challengerIndex === 0 ? 'ArenaBob' : 'ArenaAlice'}`, 'arenatest');
  await opponent.wait(line('tournament', args => args[0] === 'update' && !!JSON.parse(args[1]).challenged), 'incoming tournament challenge');
  const offsets = [alice.frames.length, bob.frames.length];
  opponent.send('/tour acceptchallenge', 'arenatest');
  const tournamentBattle = await alice.wait(frame => frame.roomId.startsWith('battle-') && frame.roomId !== initial.roomId && line('init')(frame), 'tournament battle initialization');
  await playTurnAndFinish(alice, bob, tournamentBattle.roomId, Math.min(...offsets));
  await alice.wait(line('tournament', args => args[0] === 'end'), 'tournament result');
  evidence.push('Private two-player tournament: create, join, pairing, challenge, accept, real battle choices and tournament end.');
  const report = { upstreamRevision: revision, source: `https://github.com/smogon/pokemon-showdown/tree/${revision}`, clientRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), transport: 'real ProtocolClient + loopback SockJS WebSocket', endpoint: `127.0.0.1:${port}`, externalNetwork: 'denied for server and workers; login/replay APIs disabled', evidence };
  writeFileSync(resolve('test-results-local-server.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(serverLog);
  throw error;
} finally { cleanup(); }
