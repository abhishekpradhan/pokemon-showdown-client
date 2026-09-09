import { MessageCircle, Send } from 'lucide-react';
import { useId, useLayoutEffect, useState, useRef, type KeyboardEvent } from 'react';

const history = new Map<string, string[]>();
const commands = ['/help', '/join', '/leave', '/msg', '/rules', '/rank', '/data', '/ignore', '/unignore'];
function readDraft(roomId: string) {
  try {
    return sessionStorage.getItem(`arena-chat-draft:${roomId}`) || '';
  } catch {
    return '';
  }
}
function fitDraft(field: HTMLTextAreaElement) {
  field.style.height = 'auto';
  field.style.height = `${Math.min(field.scrollHeight, 140)}px`;
}

/** Mount with key={roomId}; successful sends alone clear a room's draft. */
export function ChatComposer({
  roomId,
  title,
  users = [],
  send,
  disabled = false,
}: {
  roomId: string;
  title: string;
  users?: string[];
  send: (message: string) => boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => readDraft(roomId));
  const [error, setError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const completionCaret = useRef<number | null>(null);
  const helpId = useId();
  const errorId = useId();
  const historyIndex = useRef(-1);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    fitDraft(field);
    if (completionCaret.current !== null) {
      field.setSelectionRange(completionCaret.current, completionCaret.current);
      completionCaret.current = null;
    }
  }, [text]);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field || typeof ResizeObserver === 'undefined') return;
    let width = field.clientWidth;
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      if (width === field.clientWidth) return;
      width = field.clientWidth;
      // Write on the next frame so resizing the observed field does not create
      // another notification during the same observer delivery (Safari).
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => fitDraft(field));
    });
    observer.observe(field);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
    };
  }, []);
  const edit = (value: string) => {
    setText(value);
    setError('');
    try {
      if (value) sessionStorage.setItem(`arena-chat-draft:${roomId}`, value);
      else sessionStorage.removeItem(`arena-chat-draft:${roomId}`);
    } catch {
      /* The visible draft remains available. */
    }
  };
  const submit = () => {
    if (!text.trim() || disabled) return;
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length > 8 || lines.some(line => line.length > 1000)) {
      setError('Use at most 8 lines of 1,000 characters each.');
      input.current?.focus();
      return;
    }
    for (let index = 0; index < lines.length; index++) {
      if (!send(lines[index])) {
        edit(lines.slice(index).join('\n'));
        setError('Message was not sent. Your draft is kept here.');
        input.current?.focus();
        return;
      }
    }
    history.set(roomId, [text, ...(history.get(roomId) || [])].slice(0, 40));
    if (history.size > 30) history.delete(history.keys().next().value!);
    historyIndex.current = -1;
    edit('');
    input.current?.focus();
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
    if (event.key === 'Tab' && text && !event.shiftKey) {
      const { selectionStart, selectionEnd } = event.currentTarget;
      // Complete the token at the caret, preserving the rest of a draft. A
      // selection, partial token, or ambiguous match leaves normal Tab intact.
      if (selectionStart !== selectionEnd || (text[selectionEnd] && !/\s/.test(text[selectionEnd]))) return;
      const before = text.slice(0, selectionStart);
      const word = before.match(/[^\s]*$/)?.[0] || '';
      const options = word.startsWith('/') ? commands : users.map(user => user.replace(/^[^a-z0-9]/i, ''));
      const matches = [...new Set(options)].filter(
        option => word && option.toLowerCase().startsWith(word.toLowerCase()),
      );
      if (matches.length === 1 && matches[0].toLowerCase() !== word.toLowerCase()) {
        event.preventDefault();
        const suffix = text.slice(selectionEnd);
        const completion = matches[0] + (suffix.startsWith(' ') ? '' : ' ');
        completionCaret.current = before.length - word.length + completion.length;
        edit(before.slice(0, -word.length) + completion + suffix);
      }
    }
    if (
      (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
      !text.includes('\n') &&
      (!text || historyIndex.current >= 0)
    ) {
      const entries = history.get(roomId) || [];
      const next = Math.max(
        -1,
        Math.min(entries.length - 1, historyIndex.current + (event.key === 'ArrowUp' ? 1 : -1)),
      );
      if (entries.length) {
        event.preventDefault();
        historyIndex.current = next;
        edit(next < 0 ? '' : entries[next]);
      }
    }
  };
  return (
    <div className="chat-composer">
      {error && (
        <p id={errorId} role="status" className="chat-compose-error">
          {error}
        </p>
      )}
      <form
        className="chat-entry room-surface-entry"
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
      >
        <MessageCircle size={16} aria-hidden />
        <textarea
          ref={input}
          aria-label={`Message ${title}`}
          placeholder={`Message ${title}`}
          value={text}
          rows={1}
          onChange={event => {
            historyIndex.current = -1;
            edit(event.currentTarget.value);
          }}
          onKeyDown={keyDown}
          maxLength={8008}
          aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
        />
        <button type="submit" aria-label="Send" disabled={disabled || !text.trim()}>
          <Send size={15} aria-hidden />
        </button>
      </form>
      <small id={helpId} className="chat-keyboard-help">
        Enter to send · Shift+Enter for a new line<span> · Tab to complete</span>
      </small>
    </div>
  );
}
