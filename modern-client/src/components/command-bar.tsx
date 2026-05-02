import { Search } from 'lucide-react';

export function CommandBar() {
  return (
    <label className="command-bar">
      <Search size={17} aria-hidden />
      <input placeholder="Search formats, rooms, users, or commands" aria-label="Command search" />
      <kbd>/</kbd>
    </label>
  );
}
