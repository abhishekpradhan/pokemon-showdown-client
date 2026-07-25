import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Bell,
  Bot,
  ChevronDown,
  CircleDot,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useArenaStore } from '../stores/arena-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { CommandBar } from '../components/command-bar';
import { SessionSidebar } from '../components/session-sidebar';
import { StatusCallout } from '../components/status-callout';
import { navItems } from '../navigation';

export function AppRoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeRoomId,
    battles,
    clearNotifications,
    connect,
    connection,
    disconnect,
    lastError,
    login,
    loginPending,
    named,
    notifications,
    reconnect,
    rooms,
    username,
  } = useArenaStore();
  const { contrast, density, motion, notificationsEnabled } = useWorkspaceStore();
  const [nameInput, setNameInput] = useState(username === 'Guest Player' ? '' : username);
  const [passwordInput, setPasswordInput] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const submittedAccountRef = useRef(false);
  const accountLabel = named ? username : 'Unnamed guest';
  const focusWorkspace = () => document.getElementById('workspace')?.focus();
  const context = location.pathname.startsWith('/battle/') ?
    { label: battles[activeRoomId || '']?.format || 'Live battle', meta: activeRoomId || 'Battle room' } :
    location.pathname === '/teambuilder' ? { label: 'Team workspace', meta: 'Local teams' } :
    location.pathname === '/rooms' ? { label: 'Room console', meta: 'Community' } :
    location.pathname === '/ladder' ? { label: 'Rankings', meta: 'Public ladder' } :
    location.pathname === '/replays' ? { label: 'Replay lab', meta: 'Review' } :
    location.pathname === '/settings' ? { label: 'Client settings', meta: 'Preferences' } :
    { label: 'Matchmaking', meta: 'Battle queue' };
  const recentSessions = [
    ...Object.values(battles).filter(battle => battle.id !== 'pending').map(battle => ({
      id: battle.id,
      title: battle.ended ? 'Battle finished' : 'Battle session ready',
      detail: `${battle.p1.name} vs ${battle.p2.name}`,
    })),
    ...Object.values(rooms).filter(room => room.type === 'pm').map(room => ({
      id: room.id,
      title: room.title,
      detail: room.chat.at(-1)?.message || 'Private message',
    })),
  ].slice(-4).reverse();
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

  useEffect(() => {
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.motion = motion;
    document.documentElement.dataset.contrast = contrast;
  }, [contrast, density, motion]);

  useEffect(() => {
    if (!activeRoomId?.startsWith('battle-') || !battles[activeRoomId]) return;
    if (location.pathname === `/battle/${activeRoomId}`) return;
    void navigate({ to: '/battle/$battleId', params: { battleId: activeRoomId } });
  }, [activeRoomId, battles, location.pathname, navigate]);

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="arena-app">
        <button className="skip-link" type="button" onClick={focusWorkspace}>
          Skip to workspace
        </button>
        <aside className="primary-rail" aria-label="Primary">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Link to="/" className="brand-mark" aria-label="Showdown Arena home">
                <img src="https://play.pokemonshowdown.com/favicon-256.png" alt="" />
              </Link>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip" side="right">Showdown Arena<Tooltip.Arrow className="tooltip-arrow" /></Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <nav className="primary-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = item.activePattern.test(location.pathname);
              return (
                <Tooltip.Root key={item.to}>
                  <Tooltip.Trigger asChild>
                    <Link
                      to={item.to}
                      className={clsx('primary-nav-link', active && 'is-active')}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={19} aria-hidden />
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
          <i className={clsx('rail-connection-dot', `is-${connection}`)} aria-label={`Server ${connection}`} />
        </aside>

        <SessionSidebar />

        <div className="arena-main">
          <header className="topbar">
            <div className="workspace-context">
              <CircleDot size={14} aria-hidden />
              <span>
                <strong>{context.label}</strong>
                <small>{context.meta}</small>
              </span>
            </div>
            <CommandBar />
            <div className="topbar-actions">
              <div className="notification-wrap">
                <button
                  className={clsx('notification-button', notificationsOpen && 'is-active')}
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={notificationsOpen}
                  onClick={() => {
                    setNotificationsOpen(open => !open);
                    if (!notificationsOpen) clearNotifications();
                  }}
                >
                  <Bell size={17} aria-hidden />
                  {notificationsEnabled && notifications > 0 && <span>{notifications}</span>}
                </button>
                {notificationsOpen && (
                  <div className="notification-popover">
                    <div className="popover-heading">
                      <strong>Updates</strong>
                      <button type="button" className="icon-button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}>
                        <X size={15} />
                      </button>
                    </div>
                    {!notificationsEnabled ? <p className="popover-empty">Activity notifications are disabled in Settings.</p> :
                      recentSessions.length ? recentSessions.map(item => (
                      <button
                        type="button"
                        className="notification-row"
                        key={item.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          if (item.id.startsWith('battle-')) void navigate({ to: '/battle/$battleId', params: { battleId: item.id } });
                        }}
                      >
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </button>
                      )) : <p className="popover-empty">No unread activity.</p>}
                  </div>
                )}
              </div>
              <Dialog.Root open={accountOpen} onOpenChange={setAccountOpen}>
                <button
                  className="user-trigger"
                  type="button"
                  aria-label={accountLabel}
                  onClick={() => {
                    setNameInput(named ? username : '');
                    setAccountOpen(true);
                  }}
                >
                  <Bot size={18} aria-hidden />
                  <span>{accountLabel}</span>
                  <ChevronDown size={13} aria-hidden />
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
        </div>
      </div>
    </Tooltip.Provider>
  );
}
