import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Promote only deliberately generated local integration traffic. Never point
// this at public/user sessions: the retained requests contain synthetic teams.
const captured = JSON.parse(readFileSync(resolve('test-results-local-corpus.json'), 'utf8'));
assert(/^[a-f0-9]{40}$/.test(captured.upstreamRevision));
const allowed = new Set(['init', 'title', 'player', 'teamsize', 'gametype', 'gen', 'tier', 'poke', 'clearpoke', 'teampreview', 'start', 'switch', 'drag', 'swap', 'request', 'move', '-damage', '-heal', '-boost', '-unboost', '-sidestart', '-singleturn', 'upkeep', 'turn', 'win', 'error']);
const cases = captured.recordings.map(recording => {
  const allLines = recording.frames.flatMap(raw => raw.split('\n'));
  assert(!allLines.some(raw => /^\|(?:challstr|trn|pm)\|/.test(raw)), 'Only battle-scoped corpus frames may be promoted.');
  const username = allLines.find(raw => raw.startsWith(`|player|${recording.seat}|`))?.split('|')[3];
  assert(username?.startsWith('Arena'), 'The corpus must contain only known synthetic participants.');
  const frames = recording.frames.flatMap(raw => {
    const [room, ...lines] = raw.split('\n');
    assert(room.startsWith('>battle-'));
    const filtered = lines.filter(line => allowed.has(line.split('|')[1]));
    return filtered.length ? [[room.replace(/-\d+$/, '-recorded'), ...filtered].join('\n')] : [];
  });
  return { scenario: recording.scenario, seat: recording.seat, username, frames };
});
assert.equal(cases.length, 12);
const path = resolve('src/test/fixtures/protocol-corpus.json');
mkdirSync(resolve('src/test/fixtures'), { recursive: true });
writeFileSync(path, JSON.stringify({ source: `https://github.com/smogon/pokemon-showdown/tree/${captured.upstreamRevision}`, upstreamRevision: captured.upstreamRevision,
  provenance: 'Recorded by scripts/test-local-server.mjs against loopback only. All names/teams are synthetic; auth/global frames and room HTML are excluded. Numeric battle IDs are normalized; remaining retained protocol lines are verbatim.', cases }, null, 2) + '\n');
console.log(`Recorded ${cases.length} synthetic seat transcripts: ${path}`);
