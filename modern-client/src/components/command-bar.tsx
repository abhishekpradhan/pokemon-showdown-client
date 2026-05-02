import { useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { navItems } from '../navigation';
import { toId } from '../compat/protocol-parsers';
import { useArenaStore } from '../stores/arena-store';

export function CommandBar() {
  const navigate = useNavigate();
  const { formats, setSelectedFormat } = useArenaStore();
  const [query, setQuery] = useState('');

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
        placeholder="Jump to Teams, Rooms, Settings, or a format"
        aria-label="Command search"
        value={query}
        onChange={event => setQuery(event.currentTarget.value)}
      />
      <kbd>/</kbd>
    </form>
  );
}
