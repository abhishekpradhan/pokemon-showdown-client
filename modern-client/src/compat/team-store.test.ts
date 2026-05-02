import { exportPackedTeam, importPackedTeam } from './team-store';

describe('team-store compatibility helpers', () => {
  it('normalizes CRLF exports while preserving packed content', () => {
    const imported = importPackedTeam('Pikachu\r\nAbility: Static\r\n');

    expect(imported).toBe('Pikachu\nAbility: Static');
    expect(exportPackedTeam(imported)).toBe(imported);
  });
});
