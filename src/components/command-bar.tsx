import { useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { navItems } from '../navigation';
import { toId } from '../compat/protocol-parsers';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';

export function CommandBar() {
  const navigate = useNavigate();
  const { formats, setSelectedFormat } = useArenaStore(
    useShallow(state => ({ formats: state.formats, setSelectedFormat: state.setSelectedFormat }))
  );
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, [contenteditable="true"]');
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        setQuery('');
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const navItem = navItems.find(item => item.label.toLowerCase().includes(trimmed.toLowerCase()));
    if (navItem) {
      void navigate({ to: navItem.to });
      setQuery('');
      return;
    }
    const format = formats.find(entry => entry.name.toLowerCase().includes(trimmed.toLowerCase()) || entry.id === toId(trimmed));
    if (format) {
      setSelectedFormat(format.id);
      void navigate({ to: '/' });
      setQuery('');
    }
  };

  return (
    <form className="command-bar" onSubmit={submit}>
      <Search size={17} aria-hidden />
      <input
        ref={inputRef}
        placeholder="Jump to Teams, Rooms, Settings, or a format"
        aria-label="Command search"
        value={query}
        onChange={event => setQuery(event.currentTarget.value)}
      />
      <kbd>/</kbd>
    </form>
  );
}
