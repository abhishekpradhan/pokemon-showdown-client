import { exportPackedTeam, exportTeam, importPackedTeam, importTeam, packTeam, unpackTeam, validateTeamSets } from './team-store';

describe('team-store compatibility helpers', () => {
  it('imports PS text exports and packs them for /utm', () => {
    const imported = importPackedTeam('Pikachu\r\nAbility: Static\r\n');

    expect(imported).toBe('Pikachu|||static||||||||');
    expect(exportPackedTeam(imported)).toBe(imported);
  });

  it('round trips packed teams through readable exports', () => {
    const sets = importTeam('Iron Valiant @ Booster Energy\nAbility: Quark Drive\nTera Type: Fairy\n- Moonblast\n- Close Combat');
    const packed = packTeam(sets);

    expect(packed).toContain('Iron Valiant');
    expect(unpackTeam(packed)[0]).toMatchObject({ species: 'Iron Valiant', ability: 'Quarkdrive' });
    expect(exportTeam(packed)).toContain('Moonblast');
  });

  it('validates empty teams and Pokemon without moves', () => {
    expect(validateTeamSets([])).toMatchObject({ ok: false, errors: ['Add at least one Pokemon.'] });
    expect(validateTeamSets(importTeam('Pikachu\nAbility: Static')).ok).toBe(false);
    expect(validateTeamSets(importTeam('Pikachu\nAbility: Static\n- Thunderbolt')).ok).toBe(true);
  });
});
