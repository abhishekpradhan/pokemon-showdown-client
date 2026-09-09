import assert from 'node:assert/strict';
import { execFileSync, fork } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import {
  participant as createParticipant,
  line,
  identify,
  playUntil,
  finishBattle,
} from './local-server-clients.mjs';
import { verifyLayouts, verifyProfileConfirmation, verifyReconnect } from './local-server-scenarios.mjs';
import { verifyLocalServices } from './local-server-services.mjs';
import { runSessionStress } from './test-session-stress.mjs';

// Updating this pin is a reviewed compatibility change, never a floating clone.
const revision = '6b4bc34e44cc2541929cc4b8fff96e756ab3f268';
const root = process.cwd();
const existing = process.env.ARENA_PS_TEST_DIR;
const directory = existing ? resolve(existing) : mkdtempSync(join(tmpdir(), 'arena-showdown-'));
assert(
  directory.startsWith(resolve(tmpdir()) + sep) || directory.startsWith('/tmp/'),
  'The server must be a disposable temporary checkout.',
);
const run = (command, args) => execFileSync(command, args, { cwd: directory, stdio: 'inherit' });
if (!existsSync(join(directory, '.git'))) {
  run('git', ['init', '--quiet']);
  run('git', ['remote', 'add', 'origin', 'https://github.com/smogon/pokemon-showdown.git']);
  run('git', ['fetch', '--depth', '1', 'origin', revision]);
  run('git', ['checkout', '--detach', 'FETCH_HEAD']);
}
assert.equal(
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim(),
  revision,
);
// The source pin stays immutable. Only its disposable runtime resolution is
// replaced by this reviewed lock; optional production services are not used.
const runtime = resolve('scripts/local-server-dependencies');
const runtimeHash = createHash('sha256')
  .update(readFileSync(join(runtime, 'package-lock.json')))
  .digest('hex');
const installedHash = join(directory, '.arena-runtime-hash');
if (
  !existsSync(installedHash) ||
  readFileSync(installedHash, 'utf8') !== runtimeHash ||
  !existsSync(join(directory, 'node_modules/esbuild'))
) {
  for (const name of ['package.json', 'package-lock.json'])
    copyFileSync(join(runtime, name), join(directory, name));
  run('npm', ['ci', '--omit=dev', '--omit=optional', '--ignore-scripts']);
  // The sole necessary install script obtains esbuild's platform-specific binary.
  run(process.execPath, ['node_modules/esbuild/install.js']);
  writeFileSync(installedHash, runtimeHash);
}
writeFileSync(
  join(directory, 'config/custom-formats.ts'),
  `export const Formats = [
  {name: '[Gen 9] Arena Multi Custom Game', mod: 'gen9', gameType: 'multi', searchShow: false, rated: false, ruleset: ['[Gen 9] Custom Game']},
  {name: '[Gen 9] Arena Free-For-All Custom Game', mod: 'gen9', gameType: 'freeforall', searchShow: false, rated: false, ruleset: ['[Gen 9] Custom Game']},
];\n`,
);
run(process.execPath, ['build']);
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
writeFileSync(
  join(directory, 'config/config.js'),
  `exports.port = ${port};
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
`,
);
const modulePath = join(directory, 'arena-protocol.mjs');
await build({
  entryPoints: [resolve('src/compat/protocol-client.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: modulePath,
  define: { 'import.meta.env': '{}' },
});
const { ProtocolClient } = await import(pathToFileURL(modulePath).href);
globalThis.window = globalThis;
const server = fork(resolve('scripts/local-server-bootstrap.cjs'), [], {
  cwd: directory,
  env: {
    PATH: process.env.PATH,
    TMPDIR: tmpdir(),
    NODE_OPTIONS: `--require=${resolve('scripts/local-server-guard.cjs')}`,
  },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  detached: process.platform !== 'win32',
});
let serverLog = '';
for (const stream of [server.stdout, server.stderr])
  stream.on('data', chunk => {
    serverLog = (serverLog + chunk).slice(-30_000);
  });
const clients = [];
const evidence = [];
const deadline = setTimeout(() => {
  console.error('Local integration exceeded its 120-second limit.');
  cleanup();
  process.exit(1);
}, 120_000);
function cleanup() {
  clearTimeout(deadline);
  clients.forEach(client => client.close());
  try {
    if (process.platform === 'win32') server.kill();
    else process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* already stopped */
  }
}
process.once('exit', cleanup);
process.once('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.once('SIGTERM', () => {
  cleanup();
  process.exit(143);
});
function childMessage(type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`Server did not send ${type}.`));
    }, 20_000);
    const onMessage = message => {
      if (message.type === type) {
        stop();
        resolve(message);
      }
    };
    const onExit = code => {
      stop();
      reject(new Error(`Local server exited ${code}.`));
    };
    function stop() {
      clearTimeout(timer);
      server.off('message', onMessage);
      server.off('exit', onExit);
    }
    server.on('message', onMessage);
    server.on('exit', onExit);
  });
}
function participant(name) {
  const entry = createParticipant(
    ProtocolClient,
    {
      id: 'arenalocal',
      host: '127.0.0.1',
      port,
      prefix: '/showdown',
      secure: false,
      loginServer: 'http://127.0.0.1:1/',
    },
    name,
  );
  clients.push(entry);
  return entry;
}
async function playTurnAndFinish(alice, bob, room, from = 0) {
  const offsets = Array.isArray(from) ? from : [from, from];
  const choices = await playUntil([alice, bob], room, { offsets });
  await finishBattle([alice, bob], room, bob.name, offsets);
  return choices;
}
try {
  await childMessage('ready');
  const alice = participant('ArenaAlice');
  const bob = participant('ArenaBob');
  for (const player of [alice, bob]) {
    await identify(player);
    player.send('/utm null');
  }
  evidence.push('Two real protocol clients: handshake, format catalog and guest identity accepted.');
  const profileConfirmation = await verifyProfileConfirmation({
    player: alice,
    evidence,
    setThrottle: async enabled => {
      const ready = childMessage('profile-throttle-ready');
      server.send({ type: 'profile-throttle', enabled });
      assert.equal((await ready).enabled, enabled);
    },
  });
  alice.send('/challenge ArenaBob, gen9randombattle');
  await bob.wait(
    line('pm', args => args[0].trim() === 'ArenaAlice' && args[2] === '/challenge gen9randombattle'),
    'incoming direct challenge',
  );
  bob.send('/accept ArenaAlice');
  const initial = await alice.wait(
    frame => frame.roomId.startsWith('battle-') && line('init', args => args[0] === 'battle')(frame),
    'unrated battle initialization',
  );
  assert(!initial.lines.some(item => item.command === 'rated'), 'Direct challenge must be unrated.');
  await playTurnAndFinish(alice, bob, initial.roomId);
  evidence.push(
    'Unrated Gen9 random battle: challenge, accept, request/rqid, legal choices, resolved turn, forfeit and authoritative win.',
  );
  const replayReady = childMessage('replay-ready');
  server.send({ type: 'prepare-replay' });
  await replayReady;
  const replayOffset = alice.frames.length;
  alice.send('/hidereplay', initial.roomId);
  await alice.wait(
    frame => frame.roomId === initial.roomId && frame.raw.includes('hid the replay of this battle'),
    'private replay permission acknowledged',
    replayOffset,
  );
  const publication = childMessage('replay-published');
  alice.send('/savereplay', initial.roomId);
  const published = await publication;
  const replayPopup = await alice.wait(
    line('popup', args => args.join('|').includes('Your replay has been uploaded')),
    'authoritative modern replay URL',
    replayOffset,
  );
  const authoritativeUrl = `https://127.0.0.1:1/${published.replayid}`;
  assert(replayPopup.raw.includes(authoritativeUrl));
  const replayParser = join(directory, 'arena-replay-parser.mjs');
  await build({
    entryPoints: [resolve('src/compat/replay-upload.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: replayParser,
    define: { 'import.meta.env': JSON.stringify({ VITE_PS_REPLAY_SERVER: 'https://127.0.0.1:1' }) },
  });
  const { replayUploadUrl } = await import(pathToFileURL(replayParser).href);
  assert.equal(replayUploadUrl(replayPopup.raw), authoritativeUrl);
  evidence.push(
    'Modern private replay: real /hidereplay and /savereplay enforce participant permission and hidden=1; stub backend returns a password URL preserved by the actual client parser. No external publication.',
  );
  // This fixed team guarantees the mid-turn switch that random battles only
  // occasionally exercise. Custom Game also verifies team-preview requests.
  const {
    default: { Teams },
  } = await import(pathToFileURL(join(directory, 'dist/sim/teams.js')).href);
  const magikarp = {
    species: 'Magikarp',
    ability: 'Swift Swim',
    moves: ['Splash'],
    nature: 'Hardy',
    level: 100,
  };
  alice.send(
    `/utm ${Teams.pack([{ species: 'Cyclizar', ability: 'Shed Skin', moves: ['Shed Tail'], nature: 'Jolly', level: 100 }, ...Array.from({ length: 5 }, () => ({ ...magikarp }))])}`,
  );
  bob.send(`/utm ${Teams.pack(Array.from({ length: 6 }, () => ({ ...magikarp })))}`);
  const pivotOffsets = [alice.frames.length, bob.frames.length];
  alice.send('/challenge ArenaBob, gen9customgame');
  await bob.wait(
    line('pm', args => args[0].trim() === 'ArenaAlice' && args[2] === '/challenge gen9customgame'),
    'fixed-team challenge',
    pivotOffsets[1],
  );
  bob.send('/accept ArenaAlice');
  const pivotBattle = await alice.wait(
    frame => frame.roomId.startsWith('battle-') && line('init', args => args[0] === 'battle')(frame),
    'fixed-team battle initialization',
    pivotOffsets[0],
  );
  const pivotChoices = await playTurnAndFinish(alice, bob, pivotBattle.roomId, pivotOffsets);
  assert.equal(pivotChoices.teamPreview, 2, 'Both players must complete team preview.');
  assert(pivotChoices.forceSwitch >= 1, 'Shed Tail must receive a mid-turn switch choice before turn 2.');
  evidence.push(
    `Fixed-team Gen9 battle: two team previews, Shed Tail and ${pivotChoices.forceSwitch} forced-switch request answered before turn 2.`,
  );
  await verifyReconnect({ alice, bob, Teams, evidence });
  const layouts = await verifyLayouts({ alice, bob, participant, Teams, evidence, revision });
  for (const player of [alice, bob]) player.send('/utm null');
  const roomReady = childMessage('room-ready');
  server.send({ type: 'prepare-room' });
  await roomReady;
  for (const player of [alice, bob]) {
    player.send('/join arenatest');
    await player.wait(
      frame => frame.roomId === 'arenatest' && line('init')(frame),
      'private tournament room',
    );
  }
  alice.send('/tour new gen9randombattle, elimination', 'arenatest');
  await bob.wait(
    line('tournament', args => args[0] === 'create'),
    'tournament creation',
  );
  for (const player of [alice, bob]) player.send('/tour join', 'arenatest');
  await Promise.all(
    ['ArenaAlice', 'ArenaBob'].map(name =>
      alice.wait(
        line('tournament', args => args[0] === 'join' && args[1] === name),
        `${name} tournament signup`,
      ),
    ),
  );
  alice.send('/tour start', 'arenatest');
  const candidates = await Promise.all(
    [alice, bob].map(player =>
      player.wait(
        line(
          'tournament',
          args =>
            args[0] === 'update' &&
            (JSON.parse(args[1]).challenges?.length || JSON.parse(args[1]).challengeBys?.length),
        ),
        'available tournament pairing',
      ),
    ),
  );
  const challengerIndex = candidates.findIndex(frame =>
    frame.lines.some(
      item =>
        item.command === 'tournament' &&
        item.args[0] === 'update' &&
        JSON.parse(item.args[1]).challenges?.length,
    ),
  );
  const challenger = [alice, bob][challengerIndex],
    opponent = [bob, alice][challengerIndex];
  challenger.send(`/tour challenge ${challengerIndex === 0 ? 'ArenaBob' : 'ArenaAlice'}`, 'arenatest');
  await opponent.wait(
    line('tournament', args => args[0] === 'update' && !!JSON.parse(args[1]).challenged),
    'incoming tournament challenge',
  );
  const offsets = [alice.frames.length, bob.frames.length];
  opponent.send('/tour acceptchallenge', 'arenatest');
  const tournamentBattle = await alice.wait(
    frame => frame.roomId.startsWith('battle-') && line('init')(frame),
    'tournament battle initialization',
    offsets[0],
  );
  await playTurnAndFinish(alice, bob, tournamentBattle.roomId, offsets);
  await alice.wait(
    line('tournament', args => args[0] === 'end'),
    'tournament result',
  );
  evidence.push(
    'Private two-player tournament: create, join, pairing, challenge, accept, real battle choices and tournament end.',
  );
  const localServices = await verifyLocalServices(directory);
  evidence.push(
    'Synthetic local OAuth token lifecycle and private legacy replay publishing use actual HTTP/adapters; cross-origin and redirected uploads fail closed.',
  );
  cleanup();
  const stress = await runSessionStress();
  evidence.push(
    'Deterministic sustained sessions enforce retained-state cardinality, forced-GC heap bounds and per-batch latency budgets in an isolated process.',
  );
  const report = {
    node: process.version,
    upstreamRevision: revision,
    runtimeLockSha256: runtimeHash,
    source: `https://github.com/smogon/pokemon-showdown/tree/${revision}`,
    clientRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    clientModified: !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
    transport: 'real ProtocolClient + loopback SockJS WebSocket',
    endpoint: `127.0.0.1:${port}`,
    externalNetwork: 'denied for server and workers; external login/replay APIs disabled',
    profileConfirmation,
    modernReplay: {
      realServerHandlers: true,
      publicationBackend: 'in-process contract stub',
      private: published.hidden === 1,
      passwordPreserved: true,
    },
    localServices,
    layouts,
    stress,
    evidence,
  };
  writeFileSync(resolve('test-results-local-server.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(serverLog);
  console.error(
    JSON.stringify(
      clients.map(player => ({
        name: player.name,
        failures: player.frames
          .flatMap(frame =>
            frame.lines
              .filter(item => ['error', 'popup'].includes(item.command))
              .map(item => item.args.join('|')),
          )
          .slice(-3),
      })),
      null,
      2,
    ),
  );
  throw error;
} finally {
  cleanup();
}
