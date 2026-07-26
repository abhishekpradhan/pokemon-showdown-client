import DOMPurify from 'dompurify';
import { clsx } from 'clsx';
import { Fragment, type MouseEvent, type ReactNode } from 'react';
import type { ChatMessage } from '../rooms/types';

/**
 * The one chat renderer: rooms, PMs and battle chat all feed through here.
 *
 * Plain messages get Showdown's inline formatting parsed into React nodes —
 * no HTML strings involved, so no sanitization question. Server-sent HTML
 * (|raw|, |html|, |uhtml|, and /raw-style chat directives — room intros,
 * polls, tour cards, leaderboards) is different: it IS markup, and it goes
 * through DOMPurify before rendering. The allowlist covers what real PS
 * content uses (tables with inline styles, images, command buttons) while
 * still refusing scripts, frames, forms and non-http URLs.
 */

const PURIFY_OPTIONS = {
  ALLOWED_TAGS: [
    'a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'strike', 'code', 'pre',
    'br', 'p', 'div', 'span', 'small', 'big', 'sup', 'sub', 'font',
    'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr',
    'td', 'th', 'summary', 'details', 'center', 'hr', 'img', 'button',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'abbr',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title', 'src', 'alt', 'width', 'height',
    'style', 'align', 'valign', 'colspan', 'rowspan', 'border', 'cellpadding',
    'cellspacing', 'color', 'size', 'face', 'bgcolor', 'name', 'value', 'class',
  ],
  // href/src: http(s) or same-origin paths only.
  ALLOWED_URI_REGEXP: /^(?:https?:|\/(?!\/))/i,
  ALLOW_DATA_ATTR: false,
};

DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  // Buttons stay inert form-wise; clicks are delegated to the room's command
  // sender (polls, /join buttons).
  if (node.tagName === 'BUTTON') node.setAttribute('type', 'button');
  if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
  // Inline colors and borders are fine; CSS network fetches are not. Server
  // layouts also overlay decorative layers with absolute positioning and
  // negative margins — once their url() backgrounds are stripped those
  // overlays collapse the whole block, so force everything to flow.
  const style = node.getAttribute('style');
  if (style) {
    if (/url\s*\(|expression\s*\(|@import/i.test(style)) {
      node.removeAttribute('style');
    } else {
      const next = style
        .replace(/position\s*:\s*(?:absolute|fixed|sticky)/gi, 'position: static')
        .replace(/(margin[^:;]*:[^;]*)/gi, declaration =>
          declaration.replace(/-\d+(?:\.\d+)?(?:px|em|rem|%)/g, '0'));
      if (next !== style) node.setAttribute('style', next);
    }
  }
});

const sanitize = (html: string) => {
  const clean = DOMPurify.sanitize(html, PURIFY_OPTIONS);
  return { __html: clean };
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

export function ChatFeed({ messages, selfName, onCommand }: {
  messages: ChatMessage[];
  selfName?: string;
  /** Receives the `value` of sanitized HTML command buttons (poll votes, etc.). */
  onCommand?: (command: string) => void;
}) {
  const handleHtmlClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest('button[value]');
    if (!button || !onCommand) return;
    const command = (button as HTMLButtonElement).value;
    if (command.startsWith('/')) onCommand(command);
  };

  if (!messages.length) {
    return <p className="chat-empty">No messages yet.</p>;
  }

  return (
    <ol className="chat-feed-list">
      {messages.map((message, index) => {
        const key = message.uhtmlName || `${message.timestamp || index}-${index}`;
        const self = !!selfName && message.user.toLowerCase() === selfName.toLowerCase();

        if (message.kind === 'html') {
          return (
            <li className="chat-line is-html" key={key}>
              <div onClick={handleHtmlClick} dangerouslySetInnerHTML={sanitize(message.message)} />
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
