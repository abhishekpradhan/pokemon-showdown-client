'use strict';
// Loaded by the test server and every forked worker. Test runtime may connect
// only to loopback; upstream APIs are additionally disabled in test config.
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const options = typeof normalized[0] === 'object' ? normalized[0] : { host: typeof normalized[1] === 'string' ? normalized[1] : 'localhost' };
  const host = options.host || options.hostname || 'localhost';
  if (!options.path && !['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error(`Controlled integration blocked external socket: ${host}`);
  }
  return connect.apply(this, args);
};
globalThis.fetch = () => Promise.reject(new Error('Controlled integration disables external fetch.'));
