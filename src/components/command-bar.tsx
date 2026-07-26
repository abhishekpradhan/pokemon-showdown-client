import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from '@tanstack/react-router';
import { Hash, LayoutGrid, Search, Shield, Swords } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { navItems } from '../navigation';
import { toId } from '../compat/protocol-parsers';
import { useArenaStore } from '../stores/arena-store';

/**
 * The command palette. The topbar shows a compact trigger; the palette itself
 * is a dialog with grouped, keyboard-navigable results across everything the
 * app can jump to: pages, formats, open sessions, and saved teams.
 */

type Command = {
  id: string;
  group: 'Pages' | 'Formats' | 'Open sessions' | 'Teams';
  label: string;
  hint?: string;
  run: () => void;
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function CommandBar() {
  const navigate = useNavigate();
  const { formats, rooms, selectTeam, setSelectedFormat, teams } = useArenaStore(
    useShallow(state => ({
      formats: state.formats,
      rooms: state.rooms,
      selectTeam: state.selectTeam,
      setSelectedFormat: state.setSelectedFormat,
      teams: state.teams,
    }))
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, [contenteditable="true"]');
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !isTyping)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const commands = useMemo((): Command[] => {
    const go = (fn: () => void) => () => {
      setOpen(false);
      setQuery('');
      fn();
    };
    const pages: Command[] = navItems.map(item => ({
      id: `page-${item.to}`,
      group: 'Pages',
      label: item.label,
      run: go(() => void navigate({ to: item.to })),
    }));
    const sessions: Command[] = Object.values(rooms)
      .filter(room => room.connected && room.id !== 'lobby-preview')
      .map(room => ({
        id: `room-${room.id}`,
        group: 'Open sessions',
        label: room.type === 'battle' && room.battle.p1.name !== 'Player 1' ?
          `${room.battle.p1.name} v ${room.battle.p2.name}` : room.title,
        hint: room.type,
        run: go(() => {
          if (room.type === 'battle') void navigate({ to: '/battle/$battleId', params: { battleId: room.id } });
          else void navigate({ to: '/room/$roomId', params: { roomId: room.id } });
        }),
      }));
    const teamCommands: Command[] = teams.map(team => ({
      id: `team-${team.id}`,
      group: 'Teams',
      label: team.name,
      hint: team.format,
      run: go(() => {
        selectTeam(team.id);
        void navigate({ to: '/teambuilder' });
      }),
    }));
    const formatCommands: Command[] = formats
      .filter(format => format.searchShow || format.challengeShow)
      .map(format => ({
        id: `format-${format.id}`,
        group: 'Formats',
        label: format.name,
        hint: format.section,
        run: go(() => {
          setSelectedFormat(format.id);
          void navigate({ to: '/' });
        }),
      }));
    return [...pages, ...sessions, ...teamCommands, ...formatCommands];
  }, [formats, navigate, rooms, selectTeam, setSelectedFormat, teams]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle ?
      commands.filter(command =>
        command.label.toLowerCase().includes(needle) || toId(command.label).includes(toId(needle))
      ) :
      // Empty query: pages and whatever is already open, not 400 formats.
      commands.filter(command => command.group === 'Pages' || command.group === 'Open sessions');
    return pool.slice(0, 24);
  }, [commands, query]);

  const move = (delta: number) => {
    setHighlight(current => {
      const next = Math.min(Math.max(current + delta, 0), matches.length - 1);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: 'nearest' });
      return next;
    });
  };

  const groups = matches.reduce<Array<{ group: Command['group']; items: Array<Command & { index: number }> }>>((acc, command, index) => {
    const bucket = acc.find(entry => entry.group === command.group);
    if (bucket) bucket.items.push({ ...command, index });
    else acc.push({ group: command.group, items: [{ ...command, index }] });
    return acc;
  }, []);

  return (
    <>
      <button type="button" className="command-trigger" onClick={() => setOpen(true)}>
        <Search size={15} aria-hidden />
        <span>Search</span>
        <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <Dialog.Root open={open} onOpenChange={next => { setOpen(next); if (!next) { setQuery(''); setHighlight(0); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="command-palette" aria-label="Command palette">
            <Dialog.Title className="visually-hidden">Search</Dialog.Title>
            <Dialog.Description className="visually-hidden">
              Jump to pages, formats, open sessions, or teams.
            </Dialog.Description>
            <div className="palette-input">
              <Search size={16} aria-hidden />
              <input
                autoFocus
                placeholder="Pages, formats, sessions, teams…"
                aria-label="Search commands"
                value={query}
                onChange={event => {
                  setQuery(event.currentTarget.value);
                  setHighlight(0);
                }}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
                  if (event.key === 'Enter') { event.preventDefault(); matches[highlight]?.run(); }
                }}
              />
              <kbd>esc</kbd>
            </div>
            <div className="palette-results" ref={listRef} role="listbox" aria-label="Results">
              {groups.map(({ group, items }) => (
                <div className="palette-group" key={group}>
                  <span className="palette-group-label">{group}</span>
                  {items.map(command => (
                    <button
                      type="button"
                      key={command.id}
                      data-index={command.index}
                      role="option"
                      aria-selected={command.index === highlight}
                      className={command.index === highlight ? 'palette-row is-highlighted' : 'palette-row'}
                      onMouseEnter={() => setHighlight(command.index)}
                      onClick={command.run}
                    >
                      {group === 'Pages' ? <LayoutGrid size={14} aria-hidden /> :
                        group === 'Formats' ? <Swords size={14} aria-hidden /> :
                        group === 'Teams' ? <Shield size={14} aria-hidden /> :
                        <Hash size={14} aria-hidden />}
                      <span className="palette-row-label">{command.label}</span>
                      {command.hint && <small>{command.hint}</small>}
                    </button>
                  ))}
                </div>
              ))}
              {!matches.length && <p className="palette-empty">Nothing matches “{query}”.</p>}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
