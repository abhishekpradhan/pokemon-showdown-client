import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ClipboardCopy,
  Copy,
  FileDown,
  FilePlus2,
  Library,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';
import { ConfirmDialog } from '../components/confirm-dialog';
import { SearchableSelect } from '../components/searchable-select';
import { SetEditor } from '../components/set-editor';
import { StatusCallout } from '../components/status-callout';
import {
  createTeamId,
  exportTeam,
  exportTeams,
  importTeamLibrary,
  listTeamDrafts,
  loadTeamDraft,
  removeTeamDraft,
  saveTeamDraft,
  teamRecoveryData,
  teamStorageProblem,
  TEAM_STORAGE_KEY,
  validateTeamSets,
  type StoredTeam,
  type TeamDraft,
  type TeamSet,
} from '../compat/team-store';
import { genFromFormat, getAbility, getItem, getMove } from '../data/dex';
import { pokemonSprite } from '../data/sprites';
import { useArenaStore } from '../stores/arena-store';

const asDraft = (team: StoredTeam): TeamDraft => ({
  key: team.id,
  teamId: team.id,
  baseUpdatedAt: team.updatedAt,
  name: team.name,
  format: team.format,
  folder: team.folder || '',
  sets: structuredClone(team.sets),
  updatedAt: team.updatedAt,
});
const newDraft = (format: string): TeamDraft => ({
  key: createTeamId(),
  name: '',
  format,
  folder: '',
  sets: [],
  updatedAt: Date.now(),
});
const sameContents = (draft: TeamDraft, team: StoredTeam | undefined) =>
  !!team &&
  JSON.stringify([draft.name, draft.format, draft.folder, draft.sets]) ===
    JSON.stringify([team.name, team.format, team.folder || '', team.sets]);
const downloadText = (text: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function TeamSprite({ set, format }: { set: TeamSet; format: string }) {
  const [failed, setFailed] = useState('');
  const [loaded, setLoaded] = useState('');
  const url = pokemonSprite(set.species, {
    side: 'far',
    gen: genFromFormat(format),
    shiny: set.shiny,
    gender: set.gender === 'M' || set.gender === 'F' ? set.gender : undefined,
    still: true,
  }).url;
  return (
    <span className="team-sprite">
      {loaded !== url && <span aria-label={set.species}>{set.species.slice(0, 1) || '?'}</span>}
      {failed !== url && (
        <img
          src={url}
          alt=""
          width={44}
          height={46}
          loading="lazy"
          style={{ opacity: loaded === url ? 1 : 0 }}
          onLoad={() => setLoaded(url)}
          onError={() => setFailed(url)}
        />
      )}
    </span>
  );
}

export function TeamWorkspace() {
  const state = useArenaStore(
    useShallow(store => ({
      activeTeamId: store.activeTeamId,
      teams: store.teams,
      formats: store.formats,
      selectedFormat: store.selectedFormat,
      selectTeam: store.selectTeam,
      deleteTeam: store.deleteTeam,
      replaceTeamLibrary: store.replaceTeamLibrary,
      reloadTeamLibrary: store.reloadTeamLibrary,
      saveTeamDraftToLibrary: store.saveTeamDraftToLibrary,
      validateTeamOnServer: store.validateTeamOnServer,
      teamValidation: store.teamValidation,
      connection: store.connection,
      lastError: store.lastError,
      teamNotice: store.teamNotice,
    })),
  );
  const search = useSearch({ from: '/teambuilder' });
  const navigate = useNavigate();
  const [draft, setDraft] = useState<TeamDraft>(() => {
    const selected = state.teams.find(team => team.id === (search.team || state.activeTeamId));
    return (
      (selected && (loadTeamDraft(selected.id) || asDraft(selected))) ||
      (!search.team && listTeamDrafts()[0]) ||
      newDraft(state.selectedFormat)
    );
  });
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [removedSet, setRemovedSet] = useState<{ set: TeamSet; index: number; draftKey: string }>();
  const rosterRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('');
  const [sort, setSort] = useState('manual');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState(listTeamDrafts);
  const [draftStatus, setDraftStatus] = useState('');
  const [notice, setNotice] = useState('');
  const [teamToDelete, setTeamToDelete] = useState<string>();
  const [dialog, setDialog] = useState<'team' | 'library' | null>(null);
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);
  const editingTeam = state.teams.find(team => team.id === draft.teamId);
  const dirty = !sameContents(draft, editingTeam);
  const validation = useMemo(() => validateTeamSets(draft.sets, draft.format), [draft.sets, draft.format]);
  const patch = (next: Partial<TeamDraft>) =>
    setDraft(current => ({ ...current, ...next, updatedAt: Date.now() }));

  useEffect(() => {
    const roster = rosterRef.current;
    const selected = roster?.querySelector<HTMLElement>('.is-selected');
    if (!roster || !selected) return;
    const row = roster.getBoundingClientRect();
    const slot = selected.getBoundingClientRect();
    roster.scrollLeft += slot.left - row.left - (row.width - slot.width) / 2;
  }, [selectedSlot, draft.key]);

  useEffect(() => {
    if (!dirty) {
      // Reverting edits (including Undo) must also remove the obsolete draft,
      // otherwise a later visit would restore the changes just undone.
      if (loadTeamDraft(draft.key)) {
        removeTeamDraft(draft.key);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDrafts(listTeamDrafts());
      }
      return;
    }
    const result = saveTeamDraft(draft);
    // Durable draft recovery is separate from publishing edits to the saved library.
    setDraftStatus(result.ok ? 'Draft saved locally. Save to update your library.' : result.error);
    setDrafts(listTeamDrafts());
  }, [draft, dirty]);

  const reloadTeamLibrary = state.reloadTeamLibrary;
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === TEAM_STORAGE_KEY) {
        reloadTeamLibrary();
        setNotice('Another tab updated the saved library. Your open draft is preserved.');
      }
      if (event.key?.startsWith('ps-arena-team-draft-')) setDrafts(listTeamDrafts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reloadTeamLibrary]);

  useEffect(() => {
    if (!search.team || search.team === draft.teamId) return;
    const team = useArenaStore.getState().teams.find(entry => entry.id === search.team);
    if (team) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(loadTeamDraft(team.id) || asDraft(team));
      setSelectedSlot(null);
    }
    // Browser back/forward follows the URL; local draft changes do not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.team]);

  const load = (team: StoredTeam) => {
    state.selectTeam(team.id);
    setDraft(loadTeamDraft(team.id) || asDraft(team));
    setSelectedSlot(null);
    setNotice('');
    setLibraryOpen(false);
    setRemovedSet(undefined);
    void navigate({ to: '/teambuilder', search: { team: team.id } });
  };
  const create = () => {
    setDraft(newDraft(state.selectedFormat));
    setSelectedSlot(null);
    setNotice('');
    setLibraryOpen(false);
    setRemovedSet(undefined);
    void navigate({ to: '/teambuilder', search: {} });
  };
  const save = () => {
    const team = state.saveTeamDraftToLibrary(draft);
    if (!team) return;
    removeTeamDraft(draft.key);
    setDrafts(listTeamDrafts());
    setDraft(asDraft(team));
    setDraftStatus('Saved in this browser.');
    void navigate({ to: '/teambuilder', search: { team: team.id } });
  };
  const duplicate = () => {
    const copy = {
      ...structuredClone(draft),
      key: createTeamId(),
      teamId: undefined,
      name: `${draft.name || 'Untitled team'} copy`,
      updatedAt: Date.now(),
    };
    setDraft(copy);
    setRemovedSet(undefined);
    setNotice('Copy includes your visible edits.');
    void navigate({ to: '/teambuilder', search: {} });
  };
  const openDialog = (scope: 'team' | 'library') => {
    setDialog(scope);
    setCopied(false);
    setImportText(scope === 'team' ? exportTeam(draft.sets) : exportTeams(state.teams));
    setNotice('');
  };
  const applyImport = () => {
    try {
      const imported = importTeamLibrary(importText, draft.format);
      if (!imported.length)
        throw new Error('No teams found. Paste a Showdown export, packed team or library backup.');
      if (dialog === 'library' || imported.length > 1) {
        if (!state.replaceTeamLibrary([...imported, ...state.teams])) return;
        load(imported[0]);
        setNotice(`${imported.length} team(s) added. Existing teams were preserved.`);
      } else patch({ sets: imported[0].sets });
      setSelectedSlot(null);
      setRemovedSet(undefined);
      setDialog(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Import failed.');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        dialog === 'library' ? exportTeams(state.teams) : exportTeam(draft.sets),
      );
      setCopied(true);
    } catch {
      setNotice('Copy failed. Select the text manually or download it.');
    }
  };
  const moveTeam = (id: string, delta: number) => {
    const index = state.teams.findIndex(team => team.id === id);
    const destination = index + delta;
    if (destination < 0 || destination >= state.teams.length) return;
    const next = [...state.teams];
    [next[index], next[destination]] = [next[destination], next[index]];
    state.replaceTeamLibrary(next);
  };
  const visibleTeams = state.teams
    .filter(
      team =>
        (!folder || (team.folder || '') === folder) &&
        `${team.name} ${team.format} ${team.folder || ''} ${team.sets.map(set => `${set.species} ${set.name || ''}`).join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice()
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : sort === 'updated' ? b.updatedAt - a.updatedAt : 0,
    );
  const folders = [...new Set(state.teams.map(team => team.folder || '').filter(Boolean))];
  const formatOptions = state.formats.map(format => ({
    value: format.id,
    label: format.name,
    group: format.section || 'Formats',
  }));
  const selectedSet = selectedSlot !== null ? draft.sets[selectedSlot] : undefined;
  const serverResult = state.teamValidation;
  const removeSlot = (index: number) => {
    setRemovedSet({ set: structuredClone(draft.sets[index]), index, draftKey: draft.key });
    patch({ sets: draft.sets.filter((_, position) => position !== index) });
    setSelectedSlot(current =>
      current === null || current === index ? null : current > index ? current - 1 : current,
    );
  };
  const undoRemove = () => {
    if (!removedSet || removedSet.draftKey !== draft.key) return;
    const sets = [...draft.sets];
    const index = Math.min(removedSet.index, sets.length);
    sets.splice(index, 0, removedSet.set);
    patch({ sets });
    setSelectedSlot(index);
    setRemovedSet(undefined);
  };

  return (
    <section
      className="utility-workspace team-workspace"
      aria-label="Team builder"
      data-library-open={libraryOpen}
    >
      <div className="team-mobile-navigation">
        <h1>Teams</h1>
        <button
          type="button"
          className="team-mobile-library-toggle"
          aria-expanded={libraryOpen}
          aria-controls="team-library-panel"
          onClick={() => setLibraryOpen(open => !open)}
        >
          <Library size={17} />
          <span>
            Team library <small>{state.teams.length} saved</small>
          </span>
          <ChevronDown size={16} />
        </button>
        <button type="button" className="pane-icon-button" onClick={create} aria-label="New team">
          <FilePlus2 size={18} />
        </button>
      </div>
      <aside id="team-library-panel" className="workspace-pane team-library" aria-label="Saved teams">
        <header className="pane-heading">
          <span>
            <small>Library</small>
            <h1>Teams</h1>
          </span>
          <button type="button" className="pane-icon-button" onClick={create} aria-label="New team">
            <FilePlus2 size={16} />
          </button>
        </header>
        <div className="team-library-tools">
          <input
            aria-label="Search teams"
            placeholder="Search name, species, format"
            value={query}
            onChange={event => setQuery(event.currentTarget.value)}
          />
          <select
            aria-label="Filter team folder"
            value={folder}
            onChange={event => setFolder(event.currentTarget.value)}
          >
            <option value="">All folders</option>
            {folders.map(name => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <select aria-label="Sort teams" value={sort} onChange={event => setSort(event.currentTarget.value)}>
            <option value="manual">Manual order</option>
            <option value="name">Name</option>
            <option value="updated">Recently updated</option>
          </select>
        </div>
        <div className="team-library-list">
          {visibleTeams.map(team => (
            <div className="team-library-entry" key={team.id}>
              <input
                type="checkbox"
                aria-label={`Select ${team.name} for bulk actions`}
                checked={selectedIds.includes(team.id)}
                onChange={event => {
                  // React nulls currentTarget after dispatch; the updater may run later.
                  const checked = event.currentTarget.checked;
                  setSelectedIds(ids => (checked ? [...ids, team.id] : ids.filter(id => id !== team.id)));
                }}
              />
              <button
                type="button"
                className={`team-library-row ${team.id === draft.teamId ? 'is-active' : ''}`}
                onClick={() => load(team)}
              >
                <span className="team-library-sprites">
                  {team.sets.slice(0, 6).map((set, index) => (
                    <TeamSprite key={index} set={set} format={team.format} />
                  ))}
                </span>
                <span>
                  <span className="team-library-name">
                    <strong>{team.name}</strong>
                    {team.id === state.activeTeamId && <i>Active</i>}
                  </span>
                  <small>
                    {team.format} · {team.sets.length} Pokémon{team.folder ? ` · ${team.folder}` : ''}
                    {drafts.some(entry => entry.teamId === team.id) ? ' · Draft' : ''}
                  </small>
                </span>
              </button>
              {sort === 'manual' && (
                <span className="team-reorder">
                  <button
                    type="button"
                    aria-label={`Move ${team.name} up`}
                    disabled={state.teams[0]?.id === team.id}
                    onClick={() => moveTeam(team.id, -1)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${team.name} down`}
                    disabled={state.teams.at(-1)?.id === team.id}
                    onClick={() => moveTeam(team.id, 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                </span>
              )}
            </div>
          ))}
          {!visibleTeams.length && (
            <p className="pane-empty">{state.teams.length ? 'No teams match.' : 'No teams saved locally.'}</p>
          )}
        </div>
        {selectedIds.length > 0 && (
          <div className="team-library-tools">
            <strong>{selectedIds.length} selected</strong>
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                downloadText(
                  exportTeams(state.teams.filter(team => selectedIds.includes(team.id))),
                  'showdown-selected-teams.txt',
                )
              }
            >
              Export selected
            </button>
            <label>
              Move to folder
              <input
                aria-label="Folder for selected teams"
                onKeyDown={event => {
                  if (event.key !== 'Enter') return;
                  const value = event.currentTarget.value.trim();
                  if (
                    state.replaceTeamLibrary(
                      state.teams.map(team =>
                        selectedIds.includes(team.id)
                          ? { ...team, folder: value, updatedAt: Date.now() }
                          : team,
                      ),
                    )
                  )
                    setSelectedIds([]);
                }}
                placeholder="Folder name, then Enter"
              />
            </label>
          </div>
        )}
        <div className="team-library-tools">
          <button type="button" className="new-team-button" onClick={create}>
            <FilePlus2 size={15} /> New team
          </button>
          <button type="button" className="secondary-action" onClick={() => openDialog('library')}>
            Backup / restore library
          </button>
          <button type="button" className="secondary-action" onClick={state.reloadTeamLibrary}>
            Reload saved library
          </button>
        </div>
        {drafts.length > 0 && (
          <details className="team-recovery">
            <summary>Recover drafts / deleted teams ({drafts.length})</summary>
            {drafts.map(entry => (
              <div key={entry.key}>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setDraft(loadTeamDraft(entry.key) || entry);
                    setSelectedSlot(null);
                    setLibraryOpen(false);
                    setRemovedSet(undefined);
                    void navigate({ to: '/teambuilder', search: entry.teamId ? { team: entry.teamId } : {} });
                  }}
                >
                  {entry.name || 'Untitled draft'}
                </button>
                <button
                  type="button"
                  aria-label={`Download ${entry.name || 'draft'}`}
                  onClick={() =>
                    downloadText(
                      JSON.stringify(
                        { version: 2, teams: [{ ...entry, id: entry.teamId || entry.key }] },
                        null,
                        2,
                      ),
                      'team-draft.json',
                    )
                  }
                >
                  <FileDown size={14} />
                </button>
              </div>
            ))}
          </details>
        )}
      </aside>
      <div className="workspace-stage team-canvas">
        <header className="team-toolbar">
          <input
            className="team-name-input"
            aria-label="Team name"
            value={draft.name}
            placeholder="Untitled team"
            onChange={event => patch({ name: event.currentTarget.value })}
          />
          <div className="team-toolbar-format">
            <SearchableSelect
              ariaLabel="Set team format"
              options={formatOptions}
              value={draft.format}
              onValueChange={format => patch({ format })}
            />
          </div>
          <label className="team-folder-field">
            Folder
            <input
              value={draft.folder}
              onChange={event => patch({ folder: event.currentTarget.value })}
              placeholder="Optional"
            />
          </label>
          <div className="team-toolbar-actions">
            <button type="button" className="secondary-action" onClick={() => openDialog('team')}>
              <FileDown size={14} /> Import / Export
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Duplicate ${draft.name || 'team'}`}
              onClick={duplicate}
            >
              <Copy size={15} />
            </button>
            {editingTeam && (
              <ConfirmDialog
                open={teamToDelete === editingTeam.id}
                setOpen={open => setTeamToDelete(open ? editingTeam.id : undefined)}
                title={`Delete ${editingTeam.name}?`}
                description="A recoverable copy is kept in drafts."
                confirmLabel="Delete team"
                onConfirm={() => {
                  state.deleteTeam(editingTeam.id);
                  if (!useArenaStore.getState().teams.some(team => team.id === editingTeam.id)) {
                    setDrafts(listTeamDrafts());
                    create();
                  }
                }}
              >
                <button
                  type="button"
                  className="icon-button danger-icon"
                  aria-label={`Delete ${editingTeam.name}`}
                  onClick={() => setTeamToDelete(editingTeam.id)}
                >
                  <Trash2 size={15} />
                </button>
              </ConfirmDialog>
            )}
            <button type="button" className="primary-action" disabled={!dirty} onClick={save}>
              {draft.teamId ? 'Save team' : 'Save as new team'}
            </button>
          </div>
        </header>
        <div className="editor-status">
          <div className="team-save-status">
            <p role="status">{dirty ? draftStatus || 'Unsaved changes' : 'Saved to your library.'}</p>
            <button
              type="button"
              className="secondary-action"
              disabled={
                state.connection !== 'connected' || serverResult?.state === 'validating' || !draft.sets.length
              }
              onClick={() => state.validateTeamOnServer(draft.sets, draft.format)}
            >
              {serverResult?.state === 'validating' ? 'Validating…' : 'Validate with server'}
            </button>
          </div>
          {(notice || state.teamNotice) && <StatusCallout>{notice || state.teamNotice}</StatusCallout>}
          {state.lastError === 'WebSocket error'
            ? state.connection !== 'connected' && (
                <StatusCallout>
                  Live server connection unavailable. You can still edit and save teams in this browser.
                </StatusCallout>
              )
            : state.lastError && <StatusCallout tone="error">{state.lastError}</StatusCallout>}
          {teamStorageProblem() && (
            <StatusCallout tone="warning">
              {teamStorageProblem()}{' '}
              <button
                type="button"
                onClick={() => downloadText(teamRecoveryData(), 'showdown-team-recovery.json')}
              >
                Export recovery data
              </button>
            </StatusCallout>
          )}
          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <details>
              <summary>
                Local checks ({validation.errors.length + validation.warnings.length}) — drafts can still be
                saved
              </summary>
              <ul>
                {[...validation.errors, ...validation.warnings].map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ul>
            </details>
          )}
          {serverResult && serverResult.state !== 'validating' && (
            <StatusCallout tone={serverResult.state === 'valid' ? 'success' : 'error'}>
              <strong>{serverResult.format}</strong>
              <pre className="team-validation-result">{serverResult.message}</pre>
            </StatusCallout>
          )}
        </div>
        {draft.sets.length > 6 && (
          <StatusCallout tone="warning">
            All {draft.sets.length} imported slots are shown. Standard formats allow at most six; server
            validation checks this format.
          </StatusCallout>
        )}
        <div className="team-roster-heading">
          <h2>
            Pokémon <span>{draft.sets.length} / 6</span>
          </h2>
          {selectedSet && (
            <button
              type="button"
              className="team-overview-button"
              onClick={() => {
                const index = selectedSlot;
                setSelectedSlot(null);
                requestAnimationFrame(() => {
                  if (index === null) return;
                  const slots = rosterRef.current?.querySelectorAll<HTMLButtonElement>('.team-slot-body');
                  slots?.[index]?.focus({ preventScroll: true });
                });
              }}
            >
              Team overview
            </button>
          )}
        </div>
        {removedSet?.draftKey === draft.key && (
          <div className="team-undo-remove" role="status">
            <span>{removedSet.set.species || 'Pokémon'} removed.</span>
            <button type="button" onClick={undoRemove}>
              Undo
            </button>
          </div>
        )}
        <div
          ref={rosterRef}
          className={`team-slot-grid ${selectedSet ? 'is-editing' : ''}`}
          aria-label="Team slots"
        >
          {Array.from(
            { length: draft.sets.length < 6 ? draft.sets.length + 1 : draft.sets.length },
            (_, index) => {
              const set = draft.sets[index];
              if (!set)
                return (
                  <button
                    type="button"
                    className="team-slot is-empty"
                    key={`empty-${index}`}
                    onClick={() => {
                      patch({ sets: [...draft.sets, { species: '', moves: [] }] });
                      setSelectedSlot(index);
                    }}
                  >
                    <Plus size={17} />
                    <span>Add Pokémon</span>
                  </button>
                );
              return (
                <div className={`team-slot ${selectedSlot === index ? 'is-selected' : ''}`} key={index}>
                  <button
                    type="button"
                    className="team-slot-body"
                    aria-pressed={selectedSlot === index}
                    aria-label={`Edit ${set.species || `slot ${index + 1}`}`}
                    onClick={() => setSelectedSlot(index)}
                  >
                    <span className="team-slot-heading">
                      <TeamSprite set={set} format={draft.format} />
                      <span>
                        <strong>{set.name || set.species || 'Choose species'}</strong>
                        <small>
                          {getItem(set.item || '', genFromFormat(draft.format))?.name ||
                            set.item ||
                            'No item'}{' '}
                          ·{' '}
                          {getAbility(set.ability || '', genFromFormat(draft.format))?.name ||
                            set.ability ||
                            'No ability'}
                        </small>
                      </span>
                    </span>
                    <span className="team-slot-moves">
                      {set.moves.filter(Boolean).map((move, moveIndex) => (
                        <i key={moveIndex}>{getMove(move, genFromFormat(draft.format))?.name || move}</i>
                      ))}
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
                  <div className="team-slot-order">
                    <button
                      type="button"
                      aria-label={`Move slot ${index + 1} left`}
                      disabled={!index}
                      onClick={() => {
                        const sets = [...draft.sets];
                        [sets[index - 1], sets[index]] = [sets[index], sets[index - 1]];
                        patch({ sets });
                        setSelectedSlot(index - 1);
                      }}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label={`Move slot ${index + 1} right`}
                      disabled={index === draft.sets.length - 1}
                      onClick={() => {
                        const sets = [...draft.sets];
                        [sets[index + 1], sets[index]] = [sets[index], sets[index + 1]];
                        patch({ sets });
                        setSelectedSlot(index + 1);
                      }}
                    >
                      →
                    </button>
                  </div>
                </div>
              );
            },
          )}
        </div>
        {draft.sets.length >= 6 && (
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              patch({ sets: [...draft.sets, { species: '', moves: [] }] });
              setSelectedSlot(draft.sets.length);
            }}
          >
            Add slot for custom format
          </button>
        )}
        {selectedSet && selectedSlot !== null ? (
          <section className="team-editor-panel" aria-label="Set editor">
            <SetEditor
              key={`${draft.key}:${selectedSlot}`}
              focusSpecies
              set={selectedSet}
              formatId={draft.format}
              onChange={set =>
                patch({
                  sets: draft.sets.map((existing, position) => (position === selectedSlot ? set : existing)),
                })
              }
            />
          </section>
        ) : (
          <p className="team-editor-hint">Choose a Pokémon to edit its moves and stats.</p>
        )}
      </div>
      <Dialog.Root open={dialog !== null} onOpenChange={open => !open && setDialog(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="account-dialog import-dialog">
            <div className="dialog-heading">
              <div>
                <Dialog.Title>
                  {dialog === 'library' ? 'Backup / restore library' : 'Import / export team'}
                </Dialog.Title>
                <Dialog.Description>
                  {dialog === 'library'
                    ? 'Import adds teams without deleting your library. Showdown text backups, packed browser storage and Arena JSON are supported.'
                    : 'Paste a Showdown export or packed team. Import replaces the current draft slots.'}
                </Dialog.Description>
              </div>
              <Dialog.Close className="icon-button" aria-label="Close import dialog">
                <X size={17} />
              </Dialog.Close>
            </div>
            <textarea
              className="import-dialog-text"
              aria-label="Team import text"
              value={importText}
              onChange={event => setImportText(event.currentTarget.value)}
            />
            {notice && <p role="alert">{notice}</p>}
            <label className="team-file-import">
              Open backup file
              <input
                type="file"
                accept=".txt,.json,.team"
                onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  if (file)
                    void file
                      .text()
                      .then(setImportText)
                      .catch(() => setNotice('Could not read that file.'));
                }}
              />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="primary-action"
                disabled={!importText.trim()}
                onClick={applyImport}
              >
                {dialog === 'library' ? 'Add imported teams' : 'Import team'}
              </button>
              <button type="button" className="secondary-action" onClick={() => void copy()}>
                <ClipboardCopy size={14} /> {copied ? 'Copied' : 'Copy export'}
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() =>
                  downloadText(
                    dialog === 'library' ? exportTeams(state.teams) : exportTeam(draft.sets),
                    'showdown-teams.txt',
                  )
                }
              >
                Download export
              </button>
              {dialog === 'library' && (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() =>
                    downloadText(
                      JSON.stringify({ version: 2, teams: state.teams }, null, 2),
                      'showdown-arena-backup.json',
                    )
                  }
                >
                  Lossless JSON backup
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
