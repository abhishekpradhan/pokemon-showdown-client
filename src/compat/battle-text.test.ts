import { describeBattleLine } from './battle-text';

describe('battle narration', () => {
  it('preserves damage causes and distinguishes weather upkeep', () => {
    expect(
      describeBattleLine({ command: '-damage', args: ['p1a: Pikachu', '50/100', '[from] Stealth Rock'] }),
    ).toContain('Stealth Rock');
    expect(describeBattleLine({ command: '-weather', args: ['Sandstorm', '[upkeep]'] })).toBe(
      'Sandstorm continues.',
    );
  });
  it('narrates transformations, failures and volatile start/end', () => {
    expect(
      describeBattleLine({ command: '-mega', args: ['p1a: Charizard', 'Charizard', 'Charizardite X'] }),
    ).toContain('Mega Evolved');
    expect(describeBattleLine({ command: '-start', args: ['p1a: Pikachu', 'Substitute'] })).toContain(
      'Substitute started',
    );
    expect(describeBattleLine({ command: '-end', args: ['p1a: Pikachu', 'Substitute'] })).toContain(
      'Substitute ended',
    );
    expect(describeBattleLine({ command: '-fail', args: ['p1a: Pikachu'] })).toContain('failed');
  });
  it('keeps unknown public effects visible without rendering private requests', () => {
    expect(describeBattleLine({ command: '-futureeffect', args: ['p1a: Pikachu', 'new effect'] })).toContain(
      'new effect',
    );
    expect(describeBattleLine({ command: 'request', args: ['private team'] })).toBe('');
  });
});
