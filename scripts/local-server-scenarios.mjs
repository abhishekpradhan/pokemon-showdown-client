import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { challenge, identify, line, playUntil, finishBattle } from './local-server-clients.mjs';

const team = Teams => Teams.pack(Array.from({ length: 6 }, (_, index) => ({ name: `Test${index + 1}`, species: 'Mew', ability: 'Synchronize', moves: ['Tackle', 'Helping Hand', 'Splash'], nature: 'Hardy', level: 100 })));

export async function verifyProfileConfirmation({ player, evidence }) {
  const userid = player.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const from = player.frames.length;
  player.send('/avatar dawn');
  const preview = await player.wait(frame => frame.lines.some(item =>
    (item.command === 'raw' || (item.command === 'pm' && item.args[2]?.startsWith('/raw '))) &&
    item.args.join('|').includes('/dawn.png')), 'server avatar preview', from);
  player.send(`/cmd userdetails ${userid}`);
  const detailsFrame = await player.wait(line('queryresponse', args => args[0] === 'userdetails' && JSON.parse(args[1]).userid === userid), 'own user-details avatar confirmation', from);
  const details = JSON.parse(detailsFrame.lines.find(item => item.command === 'queryresponse' && item.args[0] === 'userdetails').args[1]);
  assert.equal(details.name, player.name);
  assert.equal(details.avatar, 'dawn');
  // The query response is an ordered round-trip boundary. At this pinned
  // revision /avatar sends text/raw preview, not an updateuser acknowledgement.
  const avatarFrames = player.frames.slice(from, player.frames.indexOf(detailsFrame) + 1);
  assert(!avatarFrames.some(line('updateuser')), '/avatar must not be mistaken for the language updateuser contract.');
  const languageFrom = player.frames.length;
  player.send('/language french');
  const languageFrame = await player.wait(line('updateuser', args => JSON.parse(args[3] || '{}').language === 'french'), 'server language metadata confirmation', languageFrom);
  const language = languageFrame.lines.find(item => item.command === 'updateuser').args;
  assert.equal(language[0].trim(), player.name);
  assert.equal(language[1], '1');
  assert.equal(language[2], 'dawn');
  const resetFrom = player.frames.length;
  player.send('/language english');
  await player.wait(line('updateuser', args => JSON.parse(args[3] || '{}').language === 'english'), 'restore English for later scenario assertions', resetFrom);
  evidence.push('Real profile confirmation: /avatar dawn sends raw preview without updateuser; own /cmd userdetails confirms dawn. /language french independently confirms authoritative updateuser metadata.');
  return { avatar: 'dawn', avatarPreview: preview.lines.some(item => item.command === 'pm') ? 'PM /raw directive' : 'raw command',
    avatarConfirmation: 'own queryresponse userdetails', avatarUpdateuserBeforeQuery: false,
    language: 'french', languageConfirmation: 'updateuser settings.language', englishRestored: true };
}

export async function verifyReconnect({ alice, bob, Teams, evidence }) {
  for (const player of [alice, bob]) player.send(`/utm ${team(Teams)}`);
  const { room, offsets } = await challenge([alice, bob], 'gen9doublescustomgame');
  // Drop the transport with an active request outstanding. A replacement must
  // get its own identity and room snapshot; private choices cannot be queued.
  const request = await alice.wait(frame => frame.roomId === room && line('request')(frame), 'request before reconnect', offsets[0]);
  assert(request);
  const from = alice.frames.length;
  alice.client.disconnect();
  assert.equal(alice.client.send('/choose move 1 1, move 1 2|999', room), false);
  assert.equal(alice.client.queuedCount(), 0);
  alice.client.connect();
  await identify(alice, from);
  alice.send(`/join ${room}`);
  const snapshot = await alice.wait(frame => frame.roomId === room && line('init', args => args[0] === 'battle')(frame), 'reconnect battle snapshot', from);
  assert(snapshot.lines.some(item => item.command === 'player' && item.args[1] === alice.name));
  await playUntil([alice, bob], room, { offsets: [from, offsets[1]], choose: ({ kind }) => kind === 'move' ? 'move 1 1, move 1 2' : 'default' });
  await finishBattle([alice, bob], room, bob.name, [from, offsets[1]]);
  assert(!alice.sent.some(message => message.endsWith('|999')), 'A disconnected choice must never reach the replacement transport.');
  evidence.push('Real active doubles reconnect: fresh identity, complete room/request snapshot, stale private choice rejected, explicit target choices and authoritative result.');
}

export async function verifyLayouts({ alice, bob, participant, Teams, evidence, revision }) {
  const recordings = [];
  const layouts = [];
  const saveCorpus = () => writeFileSync(resolve('test-results-local-corpus.json'), JSON.stringify({ upstreamRevision: revision, note: 'Synthetic local players and teams only; no authentication or live-user data.', recordings }, null, 2));
  for (const [format, gameType, count] of [
    ['gen9doublescustomgame', 'doubles', 2],
    ['gen6triplescustomgame', 'triples', 2],
    ['gen9arenamulticustomgame', 'multi', 4],
    ['gen9arenafreeforallcustomgame', 'freeforall', 4],
  ]) {
    const players = [alice, bob];
    if (count === 4) {
      const suffix = gameType === 'multi' ? 'Multi' : 'Ffa';
      players.push(participant(`ArenaCarol${suffix}`), participant(`ArenaDave${suffix}`));
      await Promise.all(players.slice(2).map(player => identify(player)));
    }
    for (const player of players) player.send(`/utm ${team(Teams)}`);
    const { room, offsets } = await challenge(players, format);
    if (count === 4) {
      for (const [index, player] of players.entries()) {
        if (index < 2) continue;
        alice.send(`/invitebattle ${player.name}, p${index + 1}`, room);
        await player.wait(line('pm', args => args[2] === `/challenge ${format}` && args.join('|').includes("You're invited to join a battle")), 'four-seat invitation', offsets[index]);
        // /accept follows the server's stored invitation action. Retain the
        // direct legacy command on the other seat to verify both contracts.
        player.send(`/${index === 2 ? 'accept' : 'acceptbattle'} ${alice.name.toLowerCase()}`);
      }
    }
    const expectedErrors = new Set();
    const moves = players.map(() => 0);
    const choices = await playUntil(players, room, {
      offsets, turn: gameType === 'triples' ? 3 : 2, expectedErrors,
      choose: async ({ player, playerIndex, request, kind }) => {
        if (kind !== 'move') return 'default';
        const expectedActives = gameType === 'triples' ? 3 : gameType === 'doubles' ? 2 : 1;
        assert.equal(request.active.length, expectedActives);
        assert.equal(request.side.id, `p${playerIndex + 1}`);
        const moveIndex = moves[playerIndex]++;
        if (gameType === 'triples' && playerIndex === 0 && moveIndex === 0) {
          const from = player.frames.length;
          player.send(`/choose move 1 1, move 1 2, move 1 1|${request.rqid}`, room);
          const rejected = await player.wait(frame => frame.roomId === room && line('error', args => /target/i.test(args.join('|')))(frame), 'far triples target rejected', from);
          expectedErrors.add(rejected);
        }
        if (gameType === 'multi' && playerIndex === 2) return 'move 2 -1';
        if (gameType === 'freeforall' && playerIndex === 2) return 'move 1 -1';
        if (gameType === 'doubles') return 'move 1 1, move 1 2';
        if (gameType === 'triples') return playerIndex === 0 && moveIndex === 1 ? 'shift, move 1 2, move 1 1' : 'move 1 3, move 1 2, move 1 1';
        return `move 1 ${playerIndex < 2 ? 2 : 1}`;
      },
    });
    const allFrames = players.flatMap(player => player.frames.filter(frame => frame.roomId === room));
    assert(allFrames.some(frame => line('gametype', args => args[0] === gameType)(frame)));
    if (gameType === 'triples') {
      assert.equal(expectedErrors.size, 1);
      assert(allFrames.some(frame => line('swap')(frame)), 'Triples edge shift must resolve on the real simulator.');
    }
    if (gameType === 'multi') assert(allFrames.some(frame => line('move', args => args[0].startsWith('p3') && args[1] === 'Helping Hand' && args[2].startsWith('p1'))(frame)), 'p3 signed ally target must resolve to p1.');
    if (gameType === 'freeforall') assert(allFrames.some(frame => line('move', args => args[0].startsWith('p3') && args[2].startsWith('p1'))(frame)), 'FFA negative target must resolve to the same-parity opponent.');
    for (const [index, player] of players.entries()) recordings.push({ scenario: gameType, seat: `p${index + 1}`, frames: player.frames.filter(frame => frame.roomId === room).map(frame => frame.raw) });
    saveCorpus();
    if (count === 2) await finishBattle(players, room, bob.name, offsets);
    else {
      const from = bob.frames.length;
      alice.send('/forfeit', room);
      if (gameType === 'freeforall') for (const player of players.slice(2)) player.send('/forfeit', room);
      await bob.wait(frame => frame.roomId === room && line('win')(frame), 'four-seat authoritative result', from);
    }
    layouts.push({ format, gameType, players: count, choices, rejectedInvalidTargets: expectedErrors.size,
      ...(count === 4 ? { invitationAcceptance: { p3: '/accept', p4: '/acceptbattle', bothReceivedOwnRequest: true } } : {}) });
    evidence.push(`${gameType}: ${count} real seats, exact signed targets, full roster/request IDs, resolved actions${gameType === 'triples' ? ', rejected far target and edge shift' : ''}.`);
    for (const player of players.slice(2)) player.close();
  }
  saveCorpus();
  return layouts;
}
