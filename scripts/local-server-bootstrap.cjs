'use strict';
// Executed with cwd set to the pinned disposable upstream checkout.
const path = require('node:path');
const server = require(path.resolve('dist/server'));
server.readyPromise.then(() => {
  global.LoginServer.disabled = true;
  process.on('message', message => {
    if (message.type !== 'prepare-room') return;
    const room = global.Rooms.createChatRoom('arenatest', 'Arena integration', { isPrivate: true, persist: false });
    room.auth.set('arenaalice', '#');
    process.send?.({ type: 'room-ready' });
  });
  process.send?.({ type: 'ready' });
}).catch(error => { console.error(error); process.exit(1); });
