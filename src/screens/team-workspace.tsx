import { Copy, FilePlus2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/confirm-dialog';
import { SearchableSelect } from '../components/searchable-select';
import { SetEditor } from '../components/set-editor';
import { StatusCallout } from '../components/status-callout';
import { exportTeam, importTeam, validateTeamSets, type StoredTeam } from '../compat/team-store';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';
import { getAbility, getItem, getMove } from '../data/dex';

const displayMove = (id: string) => getMove(id)?.name || id;
const displayItem = (id?: string) => (id ? getItem(id)?.name || id : 'No item');
const displayAbility = (id?: string) => (id ? getAbility(id)?.name || id : 'No ability');

export function TeamWorkspace() {
  const { activeTeam, activeTeamId, deleteTeam, duplicateTeam, exportActiveTeam, formats, importTeamText, lastError, renameTeam, replaceTeamFromText, selectTeam, selectedFormat, teamNotice, teams, updateTeamFormat } = useArenaStore(
    useShallow(state => ({ activeTeam: state.activeTeam, activeTeamId: state.activeTeamId, deleteTeam: state.deleteTeam, duplicateTeam: state.duplicateTeam, exportActiveTeam: state.exportActiveTeam, formats: state.formats, importTeamText: state.importTeamText, lastError: state.lastError, renameTeam: state.renameTeam, replaceTeamFromText: state.replaceTeamFromText, selectTeam: state.selectTeam, selectedFormat: state.selectedFormat, teamNotice: state.teamNotice, teams: state.teams, updateTeamFormat: state.updateTeamFormat }))
  );
  const [editingTeamId, setEditingTeamId] = useState<string | undefined>(activeTeamId);
  const [teamName, setTeamName] = useState(() => teams.find(team => team.id === activeTeamId)?.name || '');
  const [teamFormat, setTeamFormat] = useState(() => teams.find(team => team.id === activeTeamId)?.format || selectedFormat);
  const [teamText, setTeamText] = useState(() => exportTeam(activeTeam));
  const [selectedSetIndex, setSelectedSetIndex] = useState(0);
  const [teamToDelete, setTeamToDelete] = useState<string | undefined>();
  const editingTeam = teams.find(team => team.id === editingTeamId);
  const previewSets = useMemo(() => importTeam(teamText), [teamText]);
  // Soft legality feedback on whatever is being edited. The server's team
  // validator remains the authority — these never block anything.
  const validation = useMemo(() => previewSets.length ? validateTeamSets(previewSets) : null, [previewSets]);
  const selectedSet = previewSets[selectedSetIndex] || previewSets[0];
  const formatOptions = formats.map(format => ({
    value: format.id,
    label: format.name,
    group: format.section || 'Formats',
    description: format.team === false ? 'Preset team' : 'Custom team',
    meta: format.searchShow ? 'Ladder' : 'Custom',
  }));

  const loadTeam = (team: StoredTeam) => {
    selectTeam(team.id);
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setTeamFormat(team.format);
    setTeamText(exportTeam(team.packed));
    setSelectedSetIndex(0);
  };

  const editTeam = (teamId: string) => {
    const team = teams.find(entry => entry.id === teamId);
    if (team) loadTeam(team);
  };

  const newTeam = () => {
    setEditingTeamId(undefined);
    setTeamName('');
    setTeamFormat(selectedFormat);
    setTeamText('');
    setSelectedSetIndex(0);
  };

  const saveTeam = () => {
    if (!editingTeamId) {
      importTeamText(teamText, teamName, teamFormat);
      const nextState = useArenaStore.getState();
      const importedTeam = nextState.teams.find(team => team.id === nextState.activeTeamId);
      if (importedTeam) loadTeam(importedTeam);
      return;
    }
    if (teamName.trim() && teamName !== editingTeam?.name) renameTeam(editingTeamId, teamName);
    if (teamFormat !== editingTeam?.format) updateTeamFormat(editingTeamId, teamFormat);
    replaceTeamFromText(editingTeamId, teamText);
  };

  const duplicateEditingTeam = () => {
    if (!editingTeamId) return;
    duplicateTeam(editingTeamId);
    const nextState = useArenaStore.getState();
    const copy = nextState.teams.find(team => team.id === nextState.activeTeamId);
    if (copy) loadTeam(copy);
  };

  return (
    <section className="utility-workspace team-workspace" aria-label="Team builder">
      <aside className="workspace-pane team-library" aria-label="Saved teams">
        <header className="pane-heading">
          <span>
            <small>Library</small>
            <h1>Teams</h1>
          </span>
          <button type="button" className="pane-icon-button" onClick={newTeam} aria-label="New team">
            <FilePlus2 size={16} />
          </button>
        </header>
        <div className="team-library-list">
          {teams.map(team => (
            <button
              type="button"
              className={`team-library-row ${team.id === editingTeamId ? 'is-active' : ''}`}
              key={team.id}
              onClick={() => editTeam(team.id)}
            >
              <span className="team-library-sprites">
                {team.sets.slice(0, 3).map((set, index) => (
                  <img
                    key={`${set.species}-${index}`}
                    src={`https://play.pokemonshowdown.com/sprites/gen5/${set.species.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                    alt=""
                  />
                ))}
              </span>
              <span>
                <strong>{team.name}</strong>
                <small>{team.format} · {team.sets.length} Pokémon</small>
              </span>
              {team.id === activeTeamId && <i>Active</i>}
            </button>
          ))}
          {!teams.length && <p className="pane-empty">No teams saved locally.</p>}
        </div>
        <button type="button" className="new-team-button" onClick={newTeam}>
          <FilePlus2 size={15} aria-hidden /> New team
        </button>
      </aside>

      <div className="workspace-stage team-editor-stage">
        <header className="stage-heading">
          <span>
            <small>{editingTeamId ? 'Editing team' : 'New team'}</small>
            <h2>{teamName || 'Untitled team'}</h2>
          </span>
          <div className="stage-actions">
            {editingTeamId && (
              <>
                <button type="button" className="icon-button" aria-label={`Duplicate ${editingTeam?.name}`} onClick={duplicateEditingTeam}>
                  <Copy size={15} />
                </button>
                <ConfirmDialog
                  open={teamToDelete === editingTeamId}
                  setOpen={open => setTeamToDelete(open ? editingTeamId : undefined)}
                  title={`Delete ${editingTeam?.name}?`}
                  description="This removes the team from local browser storage."
                  confirmLabel="Delete team"
                  onConfirm={() => {
                    deleteTeam(editingTeamId);
                    newTeam();
                  }}
                >
                  <button type="button" className="icon-button danger-icon" aria-label={`Delete ${editingTeam?.name}`} onClick={() => setTeamToDelete(editingTeamId)}>
                    <Trash2 size={15} />
                  </button>
                </ConfirmDialog>
              </>
            )}
            <button type="button" className="primary-action" onClick={saveTeam}>
              {editingTeamId ? 'Save team' : 'Import and save'}
            </button>
          </div>
        </header>

        <div className="team-meta-controls">
          <label>
            <span>Name</span>
            <input aria-label="Team name" value={teamName} placeholder="Team name" onChange={event => setTeamName(event.currentTarget.value)} />
          </label>
          <label>
            <span>Format</span>
            <SearchableSelect
              ariaLabel="Set team format"
              emptyLabel="No formats match"
              options={formatOptions}
              placeholder="Team format"
              value={teamFormat}
              onValueChange={setTeamFormat}
            />
          </label>
        </div>

        <div className="set-card-grid" aria-label="Team sets">
          {previewSets.map((set, index) => (
            <button
              type="button"
              className={`set-card ${index === selectedSetIndex ? 'is-selected' : ''}`}
              key={`${set.species}-${index}`}
              aria-pressed={index === selectedSetIndex}
              onClick={() => setSelectedSetIndex(index)}
            >
              <span className="set-card-heading">
                <img src={`https://play.pokemonshowdown.com/sprites/gen5/${set.species.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`} alt="" />
                <span>
                  <strong>{set.name || set.species}</strong>
                  <small>{displayItem(set.item)} · {displayAbility(set.ability)}</small>
                </span>
                {index === selectedSetIndex && <Pencil size={14} aria-hidden />}
              </span>
              <span className="set-card-moves">
                {set.moves.slice(0, 4).map(move => <i key={move}>{displayMove(move)}</i>)}
                {!set.moves.length && <i className="is-empty">No moves yet</i>}
              </span>
            </button>
          ))}
          {!previewSets.length && (
            <div className="set-empty">
              <ShieldCheck size={22} aria-hidden />
              <strong>Paste a team export to begin.</strong>
              <span>The structured team view updates as you edit the import text.</span>
            </div>
          )}
        </div>

        <details className="import-editor" open>
          <summary>Import / export text</summary>
          <textarea
            aria-label="Team import text"
            placeholder="Paste a Pokémon Showdown team export or packed team"
            value={teamText}
            onChange={event => setTeamText(event.currentTarget.value)}
          />
          <div className="button-row">
            <button type="button" className="secondary-action" onClick={() => setTeamText(exportActiveTeam())}>Use active team export</button>
            <button type="button" className="secondary-action" onClick={newTeam}>Clear</button>
          </div>
        </details>

        <div className="editor-status" aria-live="polite">
          {teamNotice && <StatusCallout tone="success">{teamNotice}</StatusCallout>}
          {lastError && <StatusCallout tone="error">{lastError}</StatusCallout>}
          {validation && !validation.ok && (
            <StatusCallout tone="error">{validation.errors.join(' ')}</StatusCallout>
          )}
          {validation && validation.warnings.length > 0 && (
            <StatusCallout tone="warning">
              {validation.warnings.slice(0, 4).join(' ')}
              {validation.warnings.length > 4 ? ` (+${validation.warnings.length - 4} more)` : ''}
            </StatusCallout>
          )}
        </div>
      </div>

      <aside className="workspace-inspector set-inspector" aria-label="Set editor">
        <header className="inspector-heading">
          <span>
            <small>Set editor</small>
            <strong>{selectedSet?.species || 'New Pokémon'}</strong>
          </span>
          <button
            type="button"
            className="secondary-action"
            disabled={previewSets.length >= 6}
            onClick={() => {
              const sets = [...previewSets, { species: 'Pikachu', moves: [] }];
              setTeamText(exportTeam(sets));
              setSelectedSetIndex(sets.length - 1);
            }}
          >
            <Plus size={14} aria-hidden /> Add
          </button>
        </header>
        {selectedSet ? (
          <SetEditor
            set={selectedSet}
            formatId={teamFormat}
            onChange={next => {
              const sets = previewSets.map((existing, index) => index === selectedSetIndex ? next : existing);
              setTeamText(exportTeam(sets));
            }}
            onRemove={previewSets.length > 1 ? () => {
              const sets = previewSets.filter((_, index) => index !== selectedSetIndex);
              setTeamText(exportTeam(sets));
              setSelectedSetIndex(Math.max(0, selectedSetIndex - 1));
            } : undefined}
          />
        ) : <p className="pane-empty">Add a Pokémon to start building.</p>}
      </aside>
    </section>
  );
}
