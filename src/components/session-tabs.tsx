import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { Hash, MessageCircle, Swords, X } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { nextRouteAfterClose } from '../rooms/registry';
import { useArenaStore } from '../stores/arena-store';

/**
 * The one session model: every open room — battle, chat or PM — is a tab in
 * this strip, and nothing else in the app claims to list "what's open".
 * Pokémon Showdown players arrive with exactly this mental model.
 *
 * Each tab is memoized on primitives: the rooms map changes identity on every
 * chat line, and without this the whole strip re-rendered per message.
 */

type TabModel = {
  id: string;
  type: 'battle' | 'chat' | 'pm';
  title: string;
  live: boolean;
  unread: number;
};

const SessionTab = memo(function SessionTab({
  id,
  type,
  title,
  live,
  unread,
  active,
}: TabModel & { active: boolean }) {
  const navigate = useNavigate();
  const tabRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (active) tabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const open = () => {
    useArenaStore.getState().focusRoom(id);
    if (type === 'battle') void navigate({ to: '/battle/$battleId', params: { battleId: id } });
    else void navigate({ to: '/room/$roomId', params: { roomId: id } });
  };

  const close = () => {
    const state = useArenaStore.getState();
    const next = nextRouteAfterClose(state.rooms, id);
    if (!state.leaveRoom(id)) return;
    if (active) void navigate({ to: next });
    else
      requestAnimationFrame(() => {
        const tab =
          document.querySelector<HTMLElement>('.session-tab.is-active .session-tab-open') ||
          document.querySelector<HTMLElement>('.session-tab-open');
        (tab || document.getElementById('workspace'))?.focus({ preventScroll: true });
      });
  };

  return (
    <span className={clsx('session-tab', active && 'is-active')} ref={tabRef}>
      <button
        type="button"
        className="session-tab-open"
        aria-current={active ? 'page' : undefined}
        title={title}
        onClick={open}
      >
        {type === 'battle' ? (
          <Swords size={13} aria-hidden />
        ) : type === 'pm' ? (
          <MessageCircle size={13} aria-hidden />
        ) : (
          <Hash size={13} aria-hidden />
        )}
        <span className="session-tab-title">{title}</span>
        {live && <span className="session-tab-live" role="img" aria-label="Live" />}
        {unread > 0 && !active && (
          <i className="session-tab-unread" aria-label={`${unread} unread messages`}>
            {unread > 99 ? '99+' : unread}
          </i>
        )}
      </button>
      <button type="button" className="session-tab-close" aria-label={`Close ${title}`} onClick={close}>
        <X size={12} />
      </button>
    </span>
  );
});

export function SessionTabs() {
  const location = useLocation();
  const { rooms, searchState } = useArenaStore(
    useShallow(state => ({ rooms: state.rooms, searchState: state.searchState })),
  );

  const tabs: TabModel[] = Object.values(rooms)
    .filter(room => room.connected && room.id !== 'lobby-preview')
    .map(room => ({
      id: room.id,
      type: room.type,
      title:
        room.type === 'battle' && room.battle.p1.name !== 'Player 1'
          ? room.battle.p3 && room.battle.p4
            ? room.battle.gameType === 'multi'
              ? `${room.battle.p1.name} + ${room.battle.p3.name} v ${room.battle.p2.name} + ${room.battle.p4.name}`
              : [room.battle.p1, room.battle.p2, room.battle.p3, room.battle.p4]
                  .map(side => side.name)
                  .join(' v ')
            : `${room.battle.p1.name} v ${room.battle.p2.name}`
          : room.title,
      live: room.type === 'battle' && !room.battle.ended,
      unread: room.unread,
    }));
  if (!tabs.length && searchState !== 'searching') return null;

  const routeFor = (tab: TabModel) => (tab.type === 'battle' ? `/battle/${tab.id}` : `/room/${tab.id}`);

  return (
    <nav className="session-tabs" aria-label="Open sessions">
      {searchState === 'searching' && (
        <Link to="/" className="session-tab is-searching">
          <span className="session-tab-live" role="img" aria-label="Searching" />
          <span className="session-tab-title">Searching…</span>
        </Link>
      )}
      {tabs.map(tab => (
        <SessionTab key={tab.id} {...tab} active={location.pathname === routeFor(tab)} />
      ))}
    </nav>
  );
}
