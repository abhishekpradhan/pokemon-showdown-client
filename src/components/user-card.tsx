import { Swords, MessageCircle, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';
import { toId } from '../compat/protocol-parsers';
import { avatarUrl as trainerAvatarUrl } from '../preferences/avatars';
import { useArenaStore } from '../stores/arena-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { openChallenge } from '../compat/ui-events';

/**
 * The card behind every clickable username: identity from
 * `|queryresponse|userdetails|` plus the two actions people otherwise type
 * commands for. Renders in a body portal at fixed coordinates (ancestor
 * overflow clips in-flow popovers) and closes on Escape or outside press.
 */

const GROUP_LABELS: Record<string, string> = {
  '~': 'Administrator',
  '&': 'Administrator',
  '#': 'Room Owner',
  '*': 'Bot',
  '@': 'Moderator',
  '%': 'Driver',
  '+': 'Voice',
  '§': 'Section Leader',
};

export type UserCardAnchor = { name: string; x: number; y: number; trigger?: HTMLElement };

export function UserCard({ anchor, onClose }: { anchor: UserCardAnchor; onClose: () => void }) {
  const userid = toId(anchor.name);
  const { card, requestUserDetails, openPmWith, selfName, named } = useArenaStore(
    useShallow(state => ({
      card: state.userCards[userid],
      requestUserDetails: state.requestUserDetails,
      openPmWith: state.openPmWith,
      selfName: state.username,
      named: state.named,
    })),
  );
  const navigate = useNavigate();
  const { ignoredUsers, setPreference } = useWorkspaceStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', left: anchor.x, top: anchor.y });

  useEffect(() => {
    requestUserDetails(anchor.name);
  }, [anchor.name, requestUserDetails]);

  useLayoutEffect(() => {
    const trigger = anchor.trigger || document.activeElement;
    const cardElement = cardRef.current;
    const place = () => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (!vw || !vh) {
        // Degenerate embeds report a zero viewport; follow the anchor as-is.
        setStyle({ position: 'fixed', left: anchor.x, top: anchor.y + 8 });
        return;
      }
      const left = Math.max(8, Math.min(anchor.x, vw - rect.width - 8));
      const below = anchor.y + 8;
      const preferred = below + rect.height > vh - 8 ? anchor.y - rect.height - 8 : below;
      // Whatever the anchor was (a name can sit half out of view), the card
      // itself always lands fully inside the viewport.
      const top = Math.max(8, Math.min(preferred, vh - rect.height - 8));
      setStyle({ position: 'fixed', left, top });
    };
    place();
    // Fonts and the avatar can change the card's size a frame later.
    const raf = requestAnimationFrame(place);
    cardElement?.focus();
    return () => {
      cancelAnimationFrame(raf);
      const focused = document.activeElement;
      // Preserve focus that moved elsewhere (for example into a challenge
      // dialog); Escape/Close returns keyboard users to the invoking name.
      if (
        trigger instanceof HTMLElement &&
        trigger.isConnected &&
        (focused === document.body || focused === cardElement || cardElement?.contains(focused))
      )
        trigger.focus();
    };
  }, [anchor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPress = (event: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress);
    };
  }, [onClose]);

  const displayName = card?.name || anchor.name.replace(/^[^A-Za-z0-9]/, '');
  const group = card?.group || (/^[^A-Za-z0-9]/.test(anchor.name) ? anchor.name.charAt(0) : '');
  const groupLabel = group ? GROUP_LABELS[group] || `Rank ${group}` : '';
  const isSelf = toId(selfName) === userid;
  const avatarUrl = trainerAvatarUrl(card?.avatar);

  return createPortal(
    <div
      className="user-card"
      ref={cardRef}
      style={style}
      role="dialog"
      aria-label={`${displayName} profile`}
      tabIndex={-1}
    >
      <header>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" width={40} height={40} loading="lazy" />
        ) : (
          <span className="user-card-fallback" aria-hidden>
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <strong>
            {group && <i className="user-card-rank">{group}</i>}
            {displayName}
          </strong>
          <small>
            {card
              ? card.online === false
                ? 'Offline'
                : card.status || groupLabel || 'Online'
              : 'Looking up…'}
          </small>
        </div>
        <button
          type="button"
          className="icon-button user-card-close"
          aria-label="Close profile"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </header>
      {!isSelf && (
        <div className="user-card-actions">
          <button
            type="button"
            className="secondary-action"
            disabled={!named || card?.online === false}
            title={named ? undefined : 'Sign in to challenge players'}
            onClick={() => {
              openChallenge(displayName);
              onClose();
            }}
          >
            <Swords size={13} aria-hidden /> Challenge
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              const pmRoomId = openPmWith(displayName);
              onClose();
              void navigate({ to: '/room/$roomId', params: { roomId: pmRoomId } });
            }}
          >
            <MessageCircle size={13} aria-hidden /> Message
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() =>
              setPreference(
                'ignoredUsers',
                ignoredUsers.includes(userid)
                  ? ignoredUsers.filter(id => id !== userid)
                  : [...ignoredUsers, userid],
              )
            }
          >
            {ignoredUsers.includes(userid) ? 'Unignore' : 'Ignore'}
          </button>
          <a
            className="secondary-action"
            href="https://play.pokemonshowdown.com/view-help-request"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report to staff
          </a>
        </div>
      )}
      <div className="user-card-rooms" aria-label="Public rooms">
        {card?.rooms.map(room => {
          const id = room.replace(/^[^a-z0-9]/i, '');
          return (
            <button
              type="button"
              className="secondary-action"
              key={room}
              onClick={() => {
                onClose();
                void navigate({ to: `/${id.startsWith('battle-') ? 'battle' : 'room'}/${id}` });
              }}
            >
              {room}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
