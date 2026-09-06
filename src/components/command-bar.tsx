import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from '@tanstack/react-router';
import { Hash, LayoutGrid, Search, Shield, Swords, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { navItems } from '../navigation';
import { toId } from '../compat/protocol-parsers';
import { useArenaStore } from '../stores/arena-store';
import { battleSupport } from '../compat/battle-adapter';

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
  const openerRef = useRef<HTMLElement | null>(null);
  const executedRef = useRef(false);
  const resultsId = useId();
  const openPalette = (opener: HTMLElement) => {
    openerRef.current = opener;
    executedRef.current = false;
    setQuery(''); setHighlight(0); setOpen(true);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select') || target?.isContentEditable;
      if (event.isComposing || event.defaultPrevented || target?.closest('[role="dialog"]')) return;
      if ((event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !isTyping && !event.altKey && !event.metaKey && !event.ctrlKey)) {
        event.preventDefault();
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        executedRef.current = false;
        setQuery(''); setHighlight(0);
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const commands = useMemo((): Command[] => {
    const go = (fn: () => void) => () => {
      executedRef.current = true;
      setOpen(false);
      setQuery('');
      setHighlight(0);
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
        void navigate({ to: '/teambuilder', search: { team: team.id } });
      }),
    }));
    const formatCommands: Command[] = formats
      .filter(format => format.searchShow && battleSupport(format.id).supported)
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
    const normalizedNeedle = toId(needle);
    const pool = needle ?
      commands.filter(command =>
        command.label.toLowerCase().includes(needle) || (normalizedNeedle.length > 0 && toId(command.label).includes(normalizedNeedle))
      ) :
      // Empty query: pages and whatever is already open, not 400 formats.
      commands.filter(command => command.group === 'Pages' || command.group === 'Open sessions');
    return pool.slice(0, 24);
  }, [commands, query]);

  const move = (delta: number) => {
    if (!matches.length) return;
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
      <button type="button" className="command-trigger" aria-label="Search" aria-haspopup="dialog" aria-expanded={open} onClick={event => openPalette(event.currentTarget)}>
        <Search size={15} aria-hidden />
        <span>Search</span>
        <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <Dialog.Root open={open} onOpenChange={next => { setOpen(next); if (!next) { setQuery(''); setHighlight(0); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="command-palette" aria-label="Command palette"
            onCloseAutoFocus={event => {
              event.preventDefault();
              if (executedRef.current) document.getElementById('workspace')?.focus({ preventScroll: true });
              else if (openerRef.current?.isConnected) openerRef.current.focus();
            }}
          >
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
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={resultsId}
                aria-activedescendant={matches[highlight] ? `${resultsId}-${matches[highlight].id}` : undefined}
                value={query}
                onChange={event => {
                  setQuery(event.currentTarget.value);
                  setHighlight(0);
                }}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); matches[highlight]?.run(); }
                }}
              />
              <Dialog.Close className="palette-close" aria-label="Close search"><X size={17} aria-hidden /></Dialog.Close>
            </div>
            <div className="palette-results" id={resultsId} ref={listRef} role="listbox" aria-label="Results">
              {groups.map(({ group, items }) => (
                <div className="palette-group" key={group}>
                  <span className="palette-group-label">{group}</span>
                  {items.map(command => (
                    <button
                      type="button"
                      key={command.id}
                      id={`${resultsId}-${command.id}`}
                      tabIndex={-1}
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
