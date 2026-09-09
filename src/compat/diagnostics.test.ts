import { describe, expect, it } from 'vitest';
import { sanitizeProtocolLog } from './diagnostics';
import { replayUploadUrl } from './replay-upload';

describe('safe diagnostic capture', () => {
  it('removes all private bodies and credentials before storage', () => {
    const result = sanitizeProtocolLog(
      '>battle-secret-123\n|challstr|1|secret\n|pm|Alice|Bob|private words\n|request|{"team":"hidden"}\n|popup|https://replay.pokemonshowdown.com/x-secretpw\n|queryresponse|userdetails|sensitive\n/utm Garchomp|sensitive\n|unknown-extension|credential',
    );
    for (const secret of ['secret', 'Alice', 'Bob', 'private words', 'hidden', 'sensitive', 'credential'])
      expect(result).not.toContain(secret);
    expect(result).toContain('|request|');
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
