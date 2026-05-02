import { Link, Outlet, useLocation } from '@tanstack/react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Activity,
  Bell,
  Bot,
  ChevronDown,
  MessageSquareText,
  RadioTower,
} from 'lucide-react';
import { clsx } from 'clsx';
import { type FormEvent, useEffect, useState } from 'react';
import { useArenaStore } from '../stores/arena-store';
import { CommandBar } from '../components/command-bar';
import { LegalFooter } from '../components/legal-footer';
import { ConnectionPill } from '../components/status-pills';
import { navItems } from '../navigation';

export function AppRoot() {
  const location = useLocation();
  const { connection, notifications, username, connect, reconnect, disconnect, login, named } = useArenaStore();
  const [nameInput, setNameInput] = useState(username === 'Guest Player' ? '' : username);
  const [passwordInput, setPasswordInput] = useState('');
  const focusWorkspace = () => document.getElementById('workspace')?.focus();
  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void login({ name: nameInput, password: passwordInput || undefined });
    setPasswordInput('');
  };

  useEffect(() => {
    if (import.meta.env.MODE !== 'test' && import.meta.env.VITE_PS_AUTOCONNECT !== 'false') connect();
  }, [connect]);

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="arena-app">
        <button className="skip-link" type="button" onClick={focusWorkspace}>
          Skip to battle workspace
        </button>
        <aside className="arena-nav" aria-label="Primary">
          <Link to="/" className="brand-lockup" aria-label="Showdown Arena home">
            <img src="https://play.pokemonshowdown.com/favicon-256.png" alt="" />
            <span>
              <strong>Showdown</strong>
              <em>Arena</em>
            </span>
          </Link>

          <nav className="nav-stack">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = item.activePattern.test(location.pathname);
              return (
                <Tooltip.Root key={item.to}>
                  <Tooltip.Trigger asChild>
                    <Link
                      to={item.to}
                      className={clsx('nav-link', active && 'is-active')}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={18} aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="tooltip" side="right">
                      {item.label}
                      <Tooltip.Arrow className="tooltip-arrow" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            })}
          </nav>

          <div className="nav-meta">
            <ConnectionPill state={connection} />
            <button
              className="icon-row"
              type="button"
              onClick={() => connection === 'connected' ? disconnect() : reconnect()}
            >
              <RadioTower size={16} aria-hidden />
              <span>{connection === 'connected' ? 'Disconnect' : 'Reconnect'}</span>
            </button>
          </div>
        </aside>

        <div className="arena-main">
          <header className="topbar">
            <CommandBar />
            <div className="topbar-actions">
              <button className="notification-button" type="button" aria-label="Notifications">
                <Bell size={18} aria-hidden />
                {notifications > 0 && <span>{notifications}</span>}
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className="user-trigger">
                  <Bot size={18} aria-hidden />
                  <span>{username}</span>
                  <ChevronDown size={14} aria-hidden />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="menu-surface" align="end">
                    <div className="menu-form" onKeyDown={event => event.stopPropagation()}>
                      <strong>{named ? username : 'Choose name'}</strong>
                      <form onSubmit={submitName}>
                        <input
                          aria-label="Username"
                          placeholder="Guest name"
                          value={nameInput}
                          onChange={event => setNameInput(event.currentTarget.value)}
                        />
                        <input
                          aria-label="Password"
                          placeholder="Password"
                          type="password"
                          value={passwordInput}
                          onChange={event => setPasswordInput(event.currentTarget.value)}
                        />
                        <button type="submit">Set</button>
                      </form>
                    </div>
                    <DropdownMenu.Separator className="menu-separator" />
                    <DropdownMenu.Item className="menu-item">
                      <Activity size={16} aria-hidden /> Battle options
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="menu-item">
                      <MessageSquareText size={16} aria-hidden /> Chat preferences
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="menu-separator" />
                    <DropdownMenu.Item className="menu-item">Source and license</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </header>

          <main id="workspace" className="workspace" tabIndex={-1}>
            <Outlet />
          </main>
          <LegalFooter />
        </div>
      </div>
    </Tooltip.Provider>
  );
}
