'use strict';
// Executed with cwd set to the pinned disposable upstream checkout.
const path = require('node:path');
const assert = require('node:assert/strict');
const server = require(path.resolve('dist/server'));
server.readyPromise
  .then(() => {
    global.LoginServer.disabled = true;
    process.on('message', message => {
      if (message.type === 'profile-throttle') {
        const user = global.Users.get('arenaalice');
        assert(user?.connected && !user.hasSysopAccess() && !user.trusted && !user.isPublicBot);
        assert.equal(typeof message.enabled, 'boolean');
        // Exercise the actual guest command queue for profile ordering, then
        // restore the faster battle harness. Queue methods/timers are untouched.
        global.Config.nothrottle = !message.enabled;
        process.send?.({ type: 'profile-throttle-ready', enabled: message.enabled });
        return;
      }
      if (message.type === 'prepare-replay') {
        // Preserve the real /hidereplay and /savereplay handlers. Only the
        // publication backend is replaced; no replay leaves this process.
        global.LoginServer.request = async (action, data) => {
          assert.equal(action, 'addreplay');
          assert.equal(data.hidden, 1);
          assert.equal(typeof data.password, 'string');
          assert(data.password.length > 0);
          assert(data.log.includes('|win|'));
          assert.equal(data.players, 'ArenaAlice,ArenaBob');
          const replayid = `arenalocal-${data.id}-${data.password}pw`;
          process.send?.({ type: 'replay-published', replayid, hidden: data.hidden, passwordPresent: true });
          return [{ replayid }, null];
        };
        process.send?.({ type: 'replay-ready' });
        return;
      }
      if (message.type !== 'prepare-room') return;
      const room = global.Rooms.createChatRoom('arenatest', 'Arena integration', {
        isPrivate: true,
        persist: false,
      });
      room.auth.set('arenaalice', '#');
      process.send?.({ type: 'room-ready' });
    });
    process.send?.({ type: 'ready' });
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
