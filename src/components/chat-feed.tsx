import { clsx } from 'clsx';
import { Fragment, memo, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { ChatMessage } from '../rooms/types';
import { sanitizeChatHtml, isSafeChatCommand, normalizeChatHref } from './chat-html';
import { useWorkspaceStore } from '../stores/workspace-store';
import { toId } from '../compat/protocol-parsers';
import { useChatAnnouncements } from './chat-announcements';

/**
 * The one chat renderer: rooms, PMs and battle chat all feed through here.
 *
 * Plain messages get Showdown's inline formatting parsed into React nodes —
 * no HTML strings involved, so no sanitization question. Server-sent HTML
 * (|raw|, |html|, |uhtml|, and /raw-style chat directives — room intros,
 * polls, tour cards, leaderboards) is different: it IS markup, and it goes
 * through the chat-html sanitizer before rendering.
 */

const htmlCache = new Map<string, { __html: string }>();
const sanitize = (html: string) => {
  let result = htmlCache.get(html);
  if (!result) {
    result = { __html: sanitizeChatHtml(html) };
    if (htmlCache.size >= 100) htmlCache.delete(htmlCache.keys().next().value!);
    if (html.length <= 100_000) htmlCache.set(html, result);
  }
  return result;
};

// ── Inline formatting (PS chat syntax) ──────────────────────────────────────

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])/g;

/** `**bold**`, `__italic__`, `` `code` ``, `~~strike~~`, `||spoiler||`, links. */
const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|~~[^~\n]+~~|\|\|[^|\n]+\|\|)/g;

const renderSegment = (segment: string, key: number): ReactNode => {
  if (segment.startsWith('||') && segment.endsWith('||')) {
    return <span className="chat-spoiler" key={key} tabIndex={0} title="Spoiler">{segment.slice(2, -2)}</span>;
  }
  if (segment.startsWith('**') && segment.endsWith('**')) {
    return <strong key={key}>{segment.slice(2, -2)}</strong>;
  }
  if (segment.startsWith('__') && segment.endsWith('__')) {
    return <em key={key}>{segment.slice(2, -2)}</em>;
  }
  if (segment.startsWith('`') && segment.endsWith('`')) {
    return <code key={key}>{segment.slice(1, -1)}</code>;
  }
  if (segment.startsWith('~~') && segment.endsWith('~~')) {
    return <s key={key}>{segment.slice(2, -2)}</s>;
  }
  return <Fragment key={key}>{linkify(segment)}</Fragment>;
};

const linkify = (text: string): ReactNode[] =>
  text.split(URL_PATTERN).map((part, index) =>
    /^https?:\/\//.test(part) ?
      <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a> :
      <Fragment key={index}>{part}</Fragment>
  );

const renderChatText = (text: string): ReactNode => {
  // Greentext, the one line-level format players actually use.
  if (text.startsWith('>') && !text.startsWith('>>')) {
    return <span className="chat-greentext">{text}</span>;
  }
  return text.split(INLINE_PATTERN).map(renderSegment);
};

// ── Feed ────────────────────────────────────────────────────────────────────

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const ChatFeed = memo(function ChatFeed({ messages, selfName, onCommand, onUserClick, announce = false, label = 'Chat history' }: {
  messages: ChatMessage[];
  selfName?: string;
  /** Opt in only for live conversation; replay/history views stay quiet. */
  announce?: boolean;
  label?: string;
  /** Receives the `value` of sanitized HTML command buttons (poll votes, etc.). */
  onCommand?: (command: string) => void;
  /** Makes author names clickable (user cards). */
  onUserClick?: (name: string, at: { x: number; y: number; trigger: HTMLElement }) => void;
}) {
  const navigate = useNavigate();
  const { timestamps, ignoredUsers, highlights } = useWorkspaceStore();
  const announcements = useChatAnnouncements(messages, announce, selfName);
  const handleHtmlClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cmd],button[value],[data-href],a[href]');
    if (!target || !event.currentTarget.contains(target)) return;
    const command = target.getAttribute('data-cmd') || target.getAttribute('value');
    if (command && isSafeChatCommand(command)) {
      event.preventDefault();
      const join = command.match(/^\/(?:join|j) ([a-z0-9-]+)$/i);
      if (join) void navigate({ to: `/${join[1].startsWith('battle-') ? 'battle' : 'room'}/${join[1]}` });
      else onCommand?.(command);
      return;
    }
    const href = normalizeChatHref(target.getAttribute('data-href') || target.getAttribute('href') || '');
    if (href?.startsWith('/')) { event.preventDefault(); void navigate({ to: href }); }
  };

  return (
    <>
    <div role="log" aria-label={label} aria-live="off">
    {!messages.length ? <p className="chat-empty">No messages yet.</p> : <ol className="chat-feed-list">
      {messages.filter(message => !ignoredUsers.includes(toId(message.user))).map((message, index) => {
        const key = message.uhtmlName || `${message.timestamp || index}-${index}`;
        const self = !!selfName && message.user.toLowerCase() === selfName.toLowerCase();

        if (message.kind === 'html') {
          return (
            <li className="chat-line is-html" key={key}>
              <div className="chat-rich-content" onClick={handleHtmlClick} dangerouslySetInnerHTML={sanitize(message.message)} />
            </li>
          );
        }
        if (message.kind === 'announce') {
          return (
            <li className="chat-line is-announce" key={key}>
              <strong>{message.user}</strong>
              <span>{renderChatText(message.message)}</span>
            </li>
          );
        }
        if (message.kind === 'me') {
          return (
            <li className="chat-line is-me" key={key}>
              <em>● {message.user} {renderChatText(message.message)}</em>
              {timestamps && <time>{formatTime(message.timestamp)}</time>}
            </li>
          );
        }
        if (message.kind === 'error' || message.kind === 'system') {
          return (
            <li className={clsx('chat-line', message.kind === 'error' ? 'is-error' : 'is-system')} key={key}>
              <span>{message.message}</span>
            </li>
          );
        }
        return (
          <li className={clsx('chat-line', self && 'is-self', highlights.some(word => message.message.toLowerCase().includes(word.toLowerCase())) && 'is-highlight')} key={key}>
            {onUserClick ? (
              <button
                type="button"
                className="chat-author"
                onClick={event => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  onUserClick(message.user, { x: rect.left, y: rect.bottom, trigger: event.currentTarget });
                }}
              >
                {message.user}
              </button>
            ) : (
              <strong className="chat-author">{message.user}</strong>
            )}
            <span className="chat-body">{renderChatText(message.message)}</span>
            {timestamps && <time>{formatTime(message.timestamp)}</time>}
          </li>
        );
      })}
    </ol>}
    </div>
    <div ref={announcements} className="visually-hidden" role="status" aria-label="New chat messages" aria-live={announce ? 'polite' : 'off'} aria-atomic="true" />
    </>
  );
});
