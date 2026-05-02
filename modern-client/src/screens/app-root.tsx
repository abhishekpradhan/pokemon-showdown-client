import { Link, Outlet, useLocation } from '@tanstack/react-router';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Bell,
  Bot,
  X,
  RadioTower,
} from 'lucide-react';
import { clsx } from 'clsx';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useArenaStore } from '../stores/arena-store';
import { CommandBar } from '../components/command-bar';
import { LegalFooter } from '../components/legal-footer';
import { ConnectionPill } from '../components/status-pills';
import { StatusCallout } from '../components/status-callout';
import { navItems } from '../navigation';

export function AppRoot() {
  const location = useLocation();
  const { connection, notifications, username, connect, reconnect, disconnect, login, named, loginPending, lastError } = useArenaStore();
  const [nameInput, setNameInput] = useState(username === 'Guest Player' ? '' : username);
  const [passwordInput, setPasswordInput] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const submittedAccountRef = useRef(false);
  const accountLabel = named ? username : 'Unnamed guest';
  const focusWorkspace = () => document.getElementById('workspace')?.focus();
  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submittedAccountRef.current = true;
    void login({ name: nameInput, password: passwordInput || undefined });
    setPasswordInput('');
  };

  useEffect(() => {
    if (import.meta.env.MODE !== 'test' && import.meta.env.VITE_PS_AUTOCONNECT !== 'false') connect();
  }, [connect]);

  useEffect(() => {
    if (submittedAccountRef.current && accountOpen && named && !loginPending) {
      submittedAccountRef.current = false;
      setAccountOpen(false);
    }
  }, [accountOpen, loginPending, named]);

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
              <Dialog.Root open={accountOpen} onOpenChange={setAccountOpen}>
                <button
                  className="user-trigger"
                  type="button"
                  onClick={() => {
                    setNameInput(named ? username : '');
                    setAccountOpen(true);
                  }}
                >
                  <Bot size={18} aria-hidden />
                  <span>{accountLabel}</span>
                </button>
                <Dialog.Portal>
                  <Dialog.Overlay className="dialog-overlay" />
                  <Dialog.Content className="account-dialog">
                    <div className="dialog-heading">
                      <div>
                        <Dialog.Title>{named ? 'Account connected' : 'Choose name'}</Dialog.Title>
                        <Dialog.Description>
                          Use a guest name or enter a registered account password. Passwords are only sent to the PS login endpoint for an assertion.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close className="icon-button" aria-label="Close account dialog">
                        <X size={17} />
                      </Dialog.Close>
                    </div>
                    <form className="account-form" onSubmit={submitName}>
                      <label>
                        <span>Username</span>
                        <input
                          aria-label="Username"
                          placeholder="Guest name"
                          value={nameInput}
                          onChange={event => setNameInput(event.currentTarget.value)}
                        />
                      </label>
                      <label>
                        <span>Password</span>
                        <input
                          aria-label="Password"
                          placeholder="Optional for registered login"
                          type="password"
                          value={passwordInput}
                          onChange={event => setPasswordInput(event.currentTarget.value)}
                        />
                      </label>
                      {connection !== 'connected' && <StatusCallout tone="error">Connect before choosing a name.</StatusCallout>}
                      {loginPending && <StatusCallout>Waiting for server confirmation.</StatusCallout>}
                      {lastError && <StatusCallout tone="error">{lastError}</StatusCallout>}
                      <div className="button-row">
                        <button className="primary-action" type="submit" disabled={loginPending || !nameInput.trim()}>
                          {loginPending ? 'Submitting...' : passwordInput ? 'Log in' : 'Choose guest name'}
                        </button>
                        <button className="secondary-action" type="button" onClick={() => connection === 'connected' ? disconnect() : reconnect()}>
                          {connection === 'connected' ? 'Disconnect' : 'Reconnect'}
                        </button>
                        <Link className="secondary-action" to="/settings" onClick={() => setAccountOpen(false)}>Settings</Link>
                      </div>
                    </form>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
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
