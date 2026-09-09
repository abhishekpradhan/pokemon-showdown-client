import { useEffect } from 'react';
import { navItems } from '../navigation';
import type { Room } from '../rooms/types';
import { useArenaStore } from '../stores/arena-store';

/** The base title from index.html; every route title ends with it. */
export const APP_TITLE = 'Showdown Arena';

/** The room a `/battle/$id` or `/room/$id` path opens; undefined elsewhere. */
export const routeRoomId = (pathname: string): string | undefined => {
  const match = pathname.match(/^\/(?:battle|room)\/([^/]+)/);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined; /* An invalid route opens no room. */
  }
};

/**
 * A room's display name: the players once the server has named them (the
 * placeholder battle still reads "Player 1"), otherwise the room title — the
 * server's chat room name or the PM partner.
 */
export const roomDisplayTitle = (room: Room): string => {
  if (room.type !== 'battle' || room.battle.p1.name === 'Player 1') return room.title;
  const { p1, p2, p3, p4, gameType } = room.battle;
  if (p3 && p4)
    return gameType === 'multi'
      ? `${p1.name} + ${p3.name} vs ${p2.name} + ${p4.name}`
      : [p1, p2, p3, p4].map(side => side.name).join(' vs ');
  return `${p1.name} vs ${p2.name}`;
};

/**
 * The document title for a route: the open room — prefixed with its unread
 * chat count, which only accumulates while the tab is in the background — or
 * the nav item's label for top-level pages.
 */
export const documentTitleFor = (pathname: string, room?: Room): string => {
  const label = room
    ? `${room.unread > 0 ? `(${room.unread}) ` : ''}${roomDisplayTitle(room)}`
    : navItems.find(item => item.activePattern.test(pathname))?.label;
  return label ? `${label} · ${APP_TITLE}` : APP_TITLE;
};

/** Keeps `document.title` in step with the route; restores the plain title on unmount. */
export function useDocumentTitle(pathname: string) {
  const roomId = routeRoomId(pathname);
  // Select the finished string: the rooms map changes identity on every chat
  // line, and the shell must not re-render for lines that leave the title alone.
  const title = useArenaStore(state => documentTitleFor(pathname, roomId ? state.rooms[roomId] : undefined));
  useEffect(() => {
    document.title = title;
  }, [title]);
  useEffect(
    () => () => {
      document.title = APP_TITLE;
    },
    [],
  );
}
