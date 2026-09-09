import assert from 'node:assert/strict';

export const line =
  (command, predicate = () => true) =>
  frame =>
    frame.lines.some(item => item.command === command && predicate(item.args));
export const battleFrame = room => frame => frame.roomId === room;

/** Finite test transcript. A timeout includes only synthetic local protocol. */
export function participant(ProtocolClient, config, name) {
  const client = new ProtocolClient(config);
  const frames = [],
    states = [],
    sent = [];
  const listeners = new Set();
  const unsubscribe = client.subscribe(event => {
    if (event.type === 'frame') {
      assert(frames.length < 12_000, `${name}: integration transcript exceeded its bound.`);
      frames.push(event.frame);
    }
    if (event.type === 'state') states.push(event.state);
    if (event.type === 'send') sent.push(event.message);
    listeners.forEach(check => check());
  });
  const entry = {
    name,
    client,
    frames,
    states,
    sent,
    send(command, room = '') {
      assert(client.send(command, room), `Unable to send ${command.split(' ')[0]}`);
    },
    close() {
      unsubscribe();
      client.disconnect();
    },
    wait(predicate, label, from = 0) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          listeners.delete(check);
          reject(
            new Error(
              `${name}: timeout waiting for ${label}. Last protocol: ${frames
                .slice(-3)
                .map(frame => frame.raw)
                .join('\n')
                .slice(-2500)}`,
            ),
          );
        }, 20_000);
        function check() {
          const frame = frames.slice(from).find(predicate);
          if (frame) {
            clearTimeout(timer);
            listeners.delete(check);
            resolve(frame);
          }
        }
        listeners.add(check);
        check();
      });
    },
  };
  client.connect();
  return entry;
}

export async function identify(player, from = 0) {
  await player.wait(line('challstr'), 'real server handshake', from);
  await player.wait(line('formats'), 'real format catalog', from);
  player.send(`/trn ${player.name},0,`);
  await player.wait(
    line('updateuser', args => args[0].trim() === player.name && args[1] === '1'),
    'guest identity',
    from,
  );
}

export async function challenge(players, format) {
  const [alice, bob] = players;
  const offsets = players.map(player => player.frames.length);
  alice.send(`/challenge ${bob.name}, ${format}`);
  await bob.wait(
    line('pm', args => args[0].trim() === alice.name && args[2]?.startsWith(`/challenge ${format}`)),
    `${format} challenge`,
    offsets[1],
  );
  bob.send(`/accept ${alice.name}`);
  const initial = await alice.wait(
    frame => frame.roomId.startsWith('battle-') && line('init', args => args[0] === 'battle')(frame),
    `${format} initialization`,
    offsets[0],
  );
  assert(!initial.lines.some(item => item.command === 'rated'), 'Controlled battles must remain unrated.');
  return { room: initial.roomId, offsets };
}

/** Follow all authoritative requests, including mid-turn pivot/switch cycles. */
export async function playUntil(
  players,
  room,
  {
    offsets = players.map(() => 0),
    turn = 2,
    choose = () => 'default',
    expectTeamSize = 6,
    expectedErrors = new Set(),
  } = {},
) {
  const choices = { move: 0, teamPreview: 0, forceSwitch: 0 };
  await Promise.all(
    players.map(async (player, playerIndex) => {
      let cursor = offsets[playerIndex];
      const submitted = new Set();
      while (true) {
        const frame = await player.wait(
          frame =>
            frame.roomId === room &&
            frame.lines.some(item => ['request', 'error', 'turn', 'win', 'tie'].includes(item.command)),
          'next request or resolved turn',
          cursor,
        );
        cursor = player.frames.indexOf(frame, cursor) + 1;
        const error = frame.lines.find(item => item.command === 'error');
        if (error && expectedErrors.has(frame)) continue;
        assert(!error, `Real simulator rejected a choice: ${error?.args.join('|')}`);
        if (line('turn', args => Number(args[0]) >= turn)(frame)) break;
        assert(!line('win')(frame) && !line('tie')(frame), 'Battle ended before the target turn.');
        const requestLine = frame.lines.findLast(item => item.command === 'request');
        const request = requestLine ? JSON.parse(requestLine.args.join('|')) : null;
        if (!request || request.wait || submitted.has(request.rqid)) continue;
        const kind = request.teamPreview
          ? 'teamPreview'
          : request.forceSwitch?.some(Boolean)
            ? 'forceSwitch'
            : request.active
              ? 'move'
              : null;
        if (!kind) continue;
        assert(
          request.rqid > 0 && request.side.pokemon.length === expectTeamSize,
          'Real simulator must provide the expected roster and request ID.',
        );
        submitted.add(request.rqid);
        choices[kind]++;
        const choice = await choose({ player, playerIndex, room, request, kind });
        player.send(`/choose ${choice}|${request.rqid}`, room);
      }
    }),
  );
  return choices;
}

export async function finishBattle(players, room, winner = players[1].name, offsets = players.map(() => 0)) {
  players[0].send('/forfeit', room);
  await Promise.all(
    players.map((player, index) =>
      player.wait(
        frame => frame.roomId === room && line('win', args => args[0] === winner)(frame),
        'authoritative winner',
        offsets[index],
      ),
    ),
  );
}
