import DOMPurify from 'dompurify';
import { clsx } from 'clsx';
import { Fragment, type ReactNode } from 'react';
import type { ChatMessage } from '../rooms/types';

/**
 * The one chat renderer: rooms, PMs and battle chat all feed through here.
 *
 * Plain messages get Showdown's inline formatting parsed into React nodes —
 * no HTML strings involved, so no sanitization question. Server-sent HTML
 * (|raw|, |html|, |uhtml| — rating updates and room intros) is different: it
 * IS markup, and it goes through DOMPurify with a tight allowlist before
 * rendering.
 */

const PURIFY_OPTIONS = {
  ALLOWED_TAGS: [
    'a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'code', 'br', 'p', 'div',
    'span', 'small', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'summary',
    'details', 'center', 'hr',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'title'],
  ALLOW_DATA_ATTR: false,
};

const sanitize = (html: string) => {
  const clean = DOMPurify.sanitize(html, PURIFY_OPTIONS);
  return { __html: clean };
};

// ── Inline formatting (PS chat syntax) ──────────────────────────────────────

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])/g;

/** `**bold**`, `__italic__`, `` `code` ``, `~~strike~~`, plus links. */
const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|~~[^~\n]+~~)/g;

const renderSegment = (segment: string, key: number): ReactNode => {
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
    URL_PATTERN.test(part) ?
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

export function ChatFeed({ messages, selfName }: {
  messages: ChatMessage[];
  selfName?: string;
}) {
  if (!messages.length) {
    return <p className="chat-empty">No messages yet.</p>;
  }

  return (
    <ol className="chat-feed-list">
      {messages.map((message, index) => {
        const key = `${message.timestamp || index}-${index}`;
        const self = !!selfName && message.user.toLowerCase() === selfName.toLowerCase();

        if (message.kind === 'html') {
          return (
            <li className="chat-line is-html" key={key}>
              <div dangerouslySetInnerHTML={sanitize(message.message)} />
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
              <time>{formatTime(message.timestamp)}</time>
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
          <li className={clsx('chat-line', self && 'is-self')} key={key}>
            <strong className="chat-author">{message.user}</strong>
            <span className="chat-body">{renderChatText(message.message)}</span>
            <time>{formatTime(message.timestamp)}</time>
          </li>
        );
      })}
    </ol>
  );
}
