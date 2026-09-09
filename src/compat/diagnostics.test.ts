import { afterEach, describe, expect, it } from 'vitest';
import {
  clientErrors,
  diagnosticReport,
  recordClientError,
  resetClientErrors,
  sanitizeProtocolLog,
} from './diagnostics';
import { replayUploadUrl } from './replay-upload';

afterEach(() => resetClientErrors());

describe('safe diagnostic capture', () => {
  it('removes all private bodies and credentials before storage', () => {
    const result = sanitizeProtocolLog(
      '>battle-secret-123\n|challstr|1|secret\n|pm|Alice|Bob|private words\n|request|{"team":"hidden"}\n|popup|https://replay.pokemonshowdown.com/x-secretpw\n|queryresponse|userdetails|sensitive\n/utm Garchomp|sensitive\n|unknown-extension|credential',
    );
    for (const secret of ['secret', 'Alice', 'Bob', 'private words', 'hidden', 'sensitive', 'credential'])
      expect(result).not.toContain(secret);
    expect(result).toContain('|request|');
  });

  it('records contained client errors with sanitized context, bounded, and ships them in the report', () => {
    recordClientError('router', new TypeError('boom'), '|pm|Alice|Bob|private words');
    expect(clientErrors()).toEqual([
      expect.objectContaining({
        source: 'router',
        message: 'TypeError: boom',
        context: '|pm|[private payload omitted]',
      }),
    ]);
    recordClientError('protocol-client', 'not an Error instance');
    expect(clientErrors()[1]).toMatchObject({ message: 'not an Error instance', context: undefined });
    for (let index = 0; index < 40; index++) recordClientError('router', new Error(`overflow ${index}`));
    expect(clientErrors()).toHaveLength(32);
    expect(clientErrors()[0].message).toBe('Error: overflow 8');
    const report = JSON.parse(diagnosticReport([], { connection: 'connected', server: 'x' })) as {
      errors: unknown[];
    };
    expect(report.errors).toHaveLength(32);
    expect(JSON.stringify(report)).not.toContain('private words');
  });
});
describe('authoritative replay links', () => {
  it('preserves server IDs and private tokens and rejects fake success', () => {
    expect(replayUploadUrl('success:custom-gen9ou-12-tokenpw')).toBe(
      'https://replay.pokemonshowdown.com/custom-gen9ou-12-tokenpw',
    );
    expect(replayUploadUrl('Your replay was saved.')).toBeUndefined();
    expect(replayUploadUrl('https://attacker.test/gen9ou-123')).toBeUndefined();
    expect(replayUploadUrl('not found')).toBeUndefined();
  });
});
