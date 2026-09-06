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

  it('warns on duplicate species and EV totals over the cap, without blocking', () => {
    const duplicates = validateTeamSets(importTeam(
      'Pikachu\n- Thunderbolt\n\nPikachu\n- Surf'
    ));
    expect(duplicates.ok).toBe(true);
    expect(duplicates.warnings.some(warning => warning.includes('Species Clause'))).toBe(true);

    const overcapped = validateTeamSets([{ species: 'Pikachu', moves: ['Thunderbolt'], evs: { hp: 252, atk: 252, spe: 252 } }]);
    expect(overcapped.ok).toBe(true);
    expect(overcapped.warnings.some(warning => warning.includes('510'))).toBe(true);
  });

  it('flags unknown species and moves once the dex is loaded', async () => {
    const { loadDex } = await import('../data/dex');
    await loadDex();
    const result = validateTeamSets([{ species: 'Fakemon', moves: ['Imaginary Beam'] }]);
    expect(result.ok).toBe(true);
    expect(result.warnings.some(warning => warning.includes('species not found'))).toBe(true);
    expect(result.warnings.some(warning => warning.includes('Imaginary Beam'))).toBe(true);
  });
});

import { createTeamId, exportTeams, hasStoredTeamLibrary, importTeamLibrary, listTeamDrafts, loadStoredTeams, loadTeamDraft, packTeam as pack, parseLibrary, saveStoredTeams, saveTeamDraft, TEAM_STORAGE_KEY, type StoredTeam, type TeamSet } from './team-store';

const fixtureTeam = (sets: TeamSet[] = [{ species: 'Pikachu', moves: [] }]): StoredTeam => ({ id: 'fixture', name: 'Electric', format: 'gen9ou', folder: 'Competition', sets, packed: pack(sets), updatedAt: 1 });

describe('lossless team compatibility', () => {
  it('parses gender before species and retains nicknames and zero happiness', () => {
    const [set] = importTeam('Sparky (Pikachu) (M) @ Light Ball\nAbility: Static\nHappiness: 0\nIVs: 0 Atk / 0 Spe\n- Thunderbolt');
    expect(set).toMatchObject({ name: 'Sparky', species: 'Pikachu', gender: 'M', happiness: 0, ivs: { atk: 0, spe: 0 } });
    expect(importTeam(exportTeam([set]))[0]).toMatchObject(set);
  });

  it('preserves all supported special fields through text and packed formats', () => {
    const set: TeamSet = { species: 'Pikachu', name: 'Sparky', moves: ['Thunderbolt'], gender: 'F', shiny: true, happiness: 0, hpType: 'Ice', teraType: 'Stellar', pokeball: 'cherishball', gigantamax: true, dynamaxLevel: 0, level: 50, ivs: { hp: 0, atk: 0, def: 31, spa: 31, spd: 31, spe: 0 } };
    for (const output of [importTeam(exportTeam([set]))[0], unpackTeam(pack([set]))[0]]) expect(output).toMatchObject(set);
  });

  it('resolves inherited packed ability slots using species data', async () => {
    const { loadDex } = await import('../data/dex'); await loadDex();
    expect(unpackTeam('Pikachu|||H|thunderbolt|||||||')[0].ability).toBe('Lightning Rod');
    expect(pack(unpackTeam('Pikachu|||H|thunderbolt|||||||'))).toContain('|lightningrod|');
  });

  it('roundtrips complete library backups with folders, names and formats', () => {
    const teams = [fixtureTeam(), { ...fixtureTeam([{ species: 'Snorlax', happiness: 0, moves: ['Frustration'] }]), id: createTeamId(), name: 'Old gen', format: 'gen2ou', folder: 'Old gens' }];
    const imported = importTeamLibrary(exportTeams(teams));
    expect(imported.map(team => [team.name, team.format, team.folder, team.sets])).toEqual(teams.map(team => [team.name, team.format, team.folder, team.sets]));
  });

  it('imports upstream browser backups without confusing regular multi-Pokémon packed teams', () => {
    const stored = importTeamLibrary('gen9ou|Tests/Example]Pikachu|||static|thunderbolt|||||||');
    expect(stored[0]).toMatchObject({ name: 'Example', format: 'gen9ou', folder: 'Tests' });
    const regular = importTeamLibrary('Pikachu|||static|thunderbolt|||||||]Raichu|||static|surf|||||||');
    expect(regular[0].sets).toHaveLength(2);
    expect(regular[0].sets[0].species).toBe('Pikachu');
  });
});

describe('recoverable team storage', () => {
  beforeEach(() => { localStorage.clear(); loadStoredTeams(); });

  it.each(['null', '{}', '"oops"', '[null]', '{broken'])('does not crash on corrupt storage %s', raw => {
    localStorage.setItem(TEAM_STORAGE_KEY, raw);
    expect(loadStoredTeams()).toEqual([]);
    expect(hasStoredTeamLibrary()).toBe(true);
  });

  it('keeps valid records and quarantines malformed entries', () => {
    const result = parseLibrary(JSON.stringify([fixtureTeam(), { id: 'bad', sets: null }]));
    expect(result.teams).toHaveLength(1); expect(result.rejected).toHaveLength(1);
  });

  it('persists an intentionally empty library and upgrades legacy arrays', () => {
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify([fixtureTeam()]));
    const teams = loadStoredTeams(); expect(teams).toHaveLength(1);
    expect(saveStoredTeams([])).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(TEAM_STORAGE_KEY)!)).toMatchObject({ version: 2, teams: [] });
    expect(loadStoredTeams()).toEqual([]); expect(hasStoredTeamLibrary()).toBe(true);
  });

  it('refuses a stale tab write until the changed library is reloaded', () => {
    expect(saveStoredTeams([fixtureTeam()])).toEqual({ ok: true });
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify({ version: 2, revision: 'remote', teams: [] }));
    expect(saveStoredTeams([fixtureTeam()])).toMatchObject({ ok: false, conflict: true });
    expect(loadStoredTeams()).toEqual([]);
    expect(saveStoredTeams([fixtureTeam()])).toEqual({ ok: true });
  });

  it('reports quota errors instead of claiming a durable save', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(saveStoredTeams([fixtureTeam()])).toMatchObject({ ok: false });
    spy.mockRestore();
  });

  it('keeps incomplete drafts and detects concurrent edits without overwriting them', () => {
    const draft = { key: 'draft', name: '', format: 'gen9ou', folder: '', sets: [{ species: '', moves: [] }], updatedAt: 1 };
    expect(saveTeamDraft(draft)).toEqual({ ok: true });
    expect(loadTeamDraft('draft')).toEqual(draft);
    localStorage.setItem('ps-arena-team-draft-draft', JSON.stringify({ ...draft, name: 'Remote' }));
    listTeamDrafts(); // Merely listing recovery must not reset this tab's write baseline.
    expect(saveTeamDraft({ ...draft, name: 'Local' })).toMatchObject({ ok: false, conflict: true });
    expect(loadTeamDraft('draft')?.name).toBe('Remote');
  });
});
