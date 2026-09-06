// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it('blocks external socket overloads and fetch before any connection is attempted', () => {
  const output = execFileSync(process.execPath, ['--require', resolve('scripts/local-server-guard.cjs'), '-e', `
    const assert = require('node:assert/strict');
    const net = require('node:net');
    for (const args of [[443, 'example.invalid'], [{port: 443, host: '203.0.113.1'}], [{port: 443, hostname: 'example.invalid'}]]) {
      assert.throws(() => new net.Socket().connect(...args), /blocked external socket/);
    }
    fetch('https://example.invalid').then(() => process.exit(1), error => {
      assert.match(error.message, /disables external fetch/);
      console.log('All external runtime paths denied before network access.');
    });
  `], { encoding: 'utf8', timeout: 5000 });
  expect(output).toContain('All external runtime paths denied');
});
