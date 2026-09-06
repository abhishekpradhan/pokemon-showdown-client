import { MessageCircle, Send } from 'lucide-react';
import { useState, useRef, type KeyboardEvent } from 'react';

const history = new Map<string, string[]>();
const commands = ['/help', '/join', '/leave', '/msg', '/rules', '/rank', '/data', '/ignore', '/unignore'];
function readDraft(roomId: string) {
  try { return sessionStorage.getItem(`arena-chat-draft:${roomId}`) || ''; } catch { return ''; }
}

/** Mount with key={roomId}; successful sends alone clear a room's draft. */
export function ChatComposer({ roomId, title, users = [], send, disabled = false }: {
  roomId: string; title: string; users?: string[]; send: (message: string) => boolean; disabled?: boolean;
}) {
  const [text, setText] = useState(() => readDraft(roomId));
  const [error, setError] = useState('');
  const historyIndex = useRef(-1);
  const edit = (value: string) => {
    setText(value);
    try { if (value) sessionStorage.setItem(`arena-chat-draft:${roomId}`, value); else sessionStorage.removeItem(`arena-chat-draft:${roomId}`); } catch { /* The visible draft remains available. */ }
  };
  const submit = () => {
    if (!text.trim() || disabled) return;
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length > 8 || lines.some(line => line.length > 1000)) { setError('Use at most 8 lines of 1,000 characters each.'); return; }
    for (let index = 0; index < lines.length; index++) {
      if (!send(lines[index])) { edit(lines.slice(index).join('\n')); setError('Message was not sent. Your draft is kept here.'); return; }
    }
    history.set(roomId, [text, ...(history.get(roomId) || [])].slice(0, 40));
    if (history.size > 30) history.delete(history.keys().next().value!);
    historyIndex.current = -1;
    edit(''); setError('');
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
    if (event.key === 'Tab' && text && !event.shiftKey) {
      const word = text.match(/[^\s]*$/)?.[0] || '';
      const options = word.startsWith('/') ? commands : users.map(user => user.replace(/^[^a-z0-9]/i, ''));
      const found = options.find(option => word && option.toLowerCase().startsWith(word.toLowerCase()));
      if (found) { event.preventDefault(); edit(text.slice(0, -word.length) + found + ' '); }
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !text.includes('\n') && (!text || historyIndex.current >= 0)) {
      const entries = history.get(roomId) || [];
      const next = Math.max(-1, Math.min(entries.length - 1, historyIndex.current + (event.key === 'ArrowUp' ? 1 : -1)));
      if (entries.length) { event.preventDefault(); historyIndex.current = next; edit(next < 0 ? '' : entries[next]); }
    }
  };
  return <div className="chat-composer">
    {error && <p role="status" className="chat-compose-error">{error}</p>}
    <form className="chat-entry room-surface-entry" onSubmit={event => { event.preventDefault(); submit(); }}>
      <MessageCircle size={16} aria-hidden />
      <textarea aria-label={`Message ${title}`} placeholder={`Message ${title}`} value={text} rows={1}
        onChange={event => { historyIndex.current = -1; edit(event.currentTarget.value); }} onKeyDown={keyDown}
        maxLength={8008} aria-describedby="chat-keyboard-help" />
      <button type="submit" aria-label="Send" disabled={disabled || !text.trim()}><Send size={15} /></button>
    </form>
    <small id="chat-keyboard-help" className="chat-keyboard-help">Enter to send · Shift+Enter for a new line · Tab to complete</small>
  </div>;
}
