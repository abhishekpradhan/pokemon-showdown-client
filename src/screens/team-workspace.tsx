import * as Dialog from '@radix-ui/react-dialog';
import { ClipboardCopy, Copy, FileDown, FilePlus2, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/confirm-dialog';
import { SearchableSelect } from '../components/searchable-select';
import { SetEditor } from '../components/set-editor';
import { StatusCallout } from '../components/status-callout';
import { exportTeam, importTeam, validateTeamSets, type StoredTeam, type TeamSet } from '../compat/team-store';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';
import { getAbility, getItem, getMove } from '../data/dex';

/**
 * The team canvas: a team is six slots. Filled slots are cards; empty slots
 * are the add affordance; the selected slot's editor opens full-width below
 * the grid. Sets are real state — text import/export is a dialog that
 * derives from and feeds into them, not the other way round.
 */

const TEAM_SIZE = 6;

const displayMove = (id: string) => getMove(id)?.name || id;
const displayItem = (id?: string) => (id ? getItem(id)?.name || id : 'No item');
const displayAbility = (id?: string) => (id ? getAbility(id)?.name || id : 'No ability');

export function TeamWorkspace() {
  const { activeTeam, activeTeamId, deleteTeam, duplicateTeam, formats, importTeamText, lastError, renameTeam, replaceTeamFromText, selectTeam, selectedFormat, teamNotice, teams, updateTeamFormat } = useArenaStore(
    useShallow(state => ({ activeTeam: state.activeTeam, activeTeamId: state.activeTeamId, deleteTeam: state.deleteTeam, duplicateTeam: state.duplicateTeam, formats: state.formats, importTeamText: state.importTeamText, lastError: state.lastError, renameTeam: state.renameTeam, replaceTeamFromText: state.replaceTeamFromText, selectTeam: state.selectTeam, selectedFormat: state.selectedFormat, teamNotice: state.teamNotice, teams: state.teams, updateTeamFormat: state.updateTeamFormat }))
  );
  const [editingTeamId, setEditingTeamId] = useState<string | undefined>(activeTeamId);
  const [teamName, setTeamName] = useState(() => teams.find(team => team.id === activeTeamId)?.name || '');
  const [teamFormat, setTeamFormat] = useState(() => teams.find(team => team.id === activeTeamId)?.format || selectedFormat);
  const [sets, setSets] = useState<TeamSet[]>(() => importTeam(exportTeam(activeTeam)));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<string | undefined>();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);

  const editingTeam = teams.find(team => team.id === editingTeamId);
  const filledSets = useMemo(() => sets.filter(set => set.species.trim()), [sets]);
  // Soft legality feedback. The server's validator remains the authority —
  // these never block anything.
  const validation = useMemo(() => filledSets.length ? validateTeamSets(filledSets) : null, [filledSets]);
  const selectedSet = selectedSlot !== null ? sets[selectedSlot] : undefined;
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
    setSets(team.sets.map(set => ({ ...set })));
    setSelectedSlot(null);
  };

  const editTeam = (teamId: string) => {
    const team = teams.find(entry => entry.id === teamId);
    if (team) loadTeam(team);
  };

  const newTeam = () => {
    setEditingTeamId(undefined);
    setTeamName('');
    setTeamFormat(selectedFormat);
    setSets([]);
    setSelectedSlot(null);
  };

  const saveTeam = () => {
    const text = exportTeam(filledSets);
    if (!editingTeamId) {
      importTeamText(text, teamName, teamFormat);
      const nextState = useArenaStore.getState();
      const importedTeam = nextState.teams.find(team => team.id === nextState.activeTeamId);
      if (importedTeam) loadTeam(importedTeam);
      return;
    }
    if (teamName.trim() && teamName !== editingTeam?.name) renameTeam(editingTeamId, teamName);
    if (teamFormat !== editingTeam?.format) updateTeamFormat(editingTeamId, teamFormat);
    replaceTeamFromText(editingTeamId, text);
  };

  const duplicateEditingTeam = () => {
    if (!editingTeamId) return;
    duplicateTeam(editingTeamId);
    const nextState = useArenaStore.getState();
    const copy = nextState.teams.find(team => team.id === nextState.activeTeamId);
    if (copy) loadTeam(copy);
  };

  const addSlot = () => {
    if (sets.length >= TEAM_SIZE) return;
    setSets(current => [...current, { species: '', moves: [] }]);
    setSelectedSlot(sets.length);
  };

  const removeSlot = (index: number) => {
    setSets(current => current.filter((_, position) => position !== index));
    setSelectedSlot(null);
  };

  const updateSlot = (index: number, next: TeamSet) => {
    setSets(current => current.map((set, position) => position === index ? next : set));
  };

  const applyImport = () => {
    const imported = importTeam(importText);
    if (!imported.length) return;
    setSets(imported);
    setSelectedSlot(null);
    setImportDialogOpen(false);
    setImportText('');
  };

  const openImportDialog = () => {
    setImportText(filledSets.length ? exportTeam(filledSets) : '');
    setCopied(false);
    setImportDialogOpen(true);
  };

  const copyExport = () => {
    void navigator.clipboard?.writeText(exportTeam(filledSets)).then(() => setCopied(true));
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
                <span className="team-library-name">
                  <strong>{team.name}</strong>
                  {team.id === activeTeamId && <i>Active</i>}
                </span>
                <small>{team.format} · {team.sets.length} Pokémon</small>
              </span>
            </button>
          ))}
          {!teams.length && <p className="pane-empty">No teams saved locally.</p>}
        </div>
        <button type="button" className="new-team-button" onClick={newTeam}>
          <FilePlus2 size={15} aria-hidden /> New team
        </button>
      </aside>

      <div className="workspace-stage team-canvas">
        <header className="team-toolbar">
          <input
            className="team-name-input"
            aria-label="Team name"
            value={teamName}
            placeholder="Untitled team"
            onChange={event => setTeamName(event.currentTarget.value)}
          />
          <div className="team-toolbar-format">
            <SearchableSelect
              ariaLabel="Set team format"
              emptyLabel="No formats match"
              options={formatOptions}
              placeholder="Team format"
              value={teamFormat}
              onValueChange={setTeamFormat}
            />
          </div>
          <div className="team-toolbar-actions">
            <button type="button" className="secondary-action" onClick={openImportDialog}>
              <FileDown size={14} aria-hidden /> Import / Export
            </button>
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
            <button type="button" className="primary-action" onClick={saveTeam} disabled={!filledSets.length}>
              {editingTeamId ? 'Save team' : 'Save as new team'}
            </button>
          </div>
        </header>

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

        <div className="team-slot-grid" aria-label="Team slots">
          {Array.from({ length: TEAM_SIZE }, (_, index) => {
            const set = sets[index];
            if (!set) {
              return (
                <button
                  type="button"
                  className="team-slot is-empty"
                  key={`empty-${index}`}
                  disabled={index > sets.length}
                  onClick={addSlot}
                >
                  <Plus size={17} aria-hidden />
                  <span>Add Pokémon</span>
                </button>
              );
            }
            const selected = selectedSlot === index;
            return (
              <div className={`team-slot ${selected ? 'is-selected' : ''}`} key={index}>
                <button
                  type="button"
                  className="team-slot-body"
                  aria-pressed={selected}
                  aria-label={`Edit ${set.species || `slot ${index + 1}`}`}
                  onClick={() => setSelectedSlot(selected ? null : index)}
                >
                  <span className="team-slot-heading">
                    {set.species ? (
                      <img
                        src={`https://play.pokemonshowdown.com/sprites/gen5/${set.species.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                        alt=""
                      />
                    ) : (
                      <span className="team-slot-blank" aria-hidden>?</span>
                    )}
                    <span>
                      <strong>{set.name || set.species || 'Choose species'}</strong>
                      <small>{displayItem(set.item)} · {displayAbility(set.ability)}</small>
                    </span>
                  </span>
                  <span className="team-slot-moves">
                    {set.moves.filter(Boolean).slice(0, 4).map(move => <i key={move}>{displayMove(move)}</i>)}
                    {!set.moves.filter(Boolean).length && <i className="is-blank">No moves yet</i>}
                  </span>
                </button>
                <button
                  type="button"
                  className="team-slot-remove"
                  aria-label={`Remove ${set.species || `slot ${index + 1}`}`}
                  onClick={() => removeSlot(index)}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {selectedSet !== undefined && selectedSlot !== null && (
          <section className="team-editor-panel" aria-label="Set editor">
            <SetEditor
              set={selectedSet}
              formatId={teamFormat}
              onChange={next => updateSlot(selectedSlot, next)}
            />
          </section>
        )}
        {selectedSet === undefined && sets.length > 0 && (
          <p className="team-editor-hint">Select a slot to edit its set.</p>
        )}
      </div>

      <Dialog.Root open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="account-dialog import-dialog">
            <div className="dialog-heading">
              <div>
                <Dialog.Title>Import / export team</Dialog.Title>
                <Dialog.Description>
                  Pokémon Showdown export or packed format. Importing replaces the current slots.
                </Dialog.Description>
              </div>
              <Dialog.Close className="icon-button" aria-label="Close import dialog"><X size={17} /></Dialog.Close>
            </div>
            <textarea
              className="import-dialog-text"
              aria-label="Team import text"
              placeholder="Paste a Pokémon Showdown team export or packed team"
              value={importText}
              onChange={event => setImportText(event.currentTarget.value)}
            />
            <div className="button-row">
              <button type="button" className="primary-action" onClick={applyImport} disabled={!importText.trim()}>
                Import team
              </button>
              <button type="button" className="secondary-action" onClick={copyExport} disabled={!filledSets.length}>
                <ClipboardCopy size={14} aria-hidden /> {copied ? 'Copied' : 'Copy export'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
