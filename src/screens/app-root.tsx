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
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { CommandBar } from '../components/command-bar';
import { SessionTabs } from '../components/session-tabs';
import { StatusCallout } from '../components/status-callout';
import { navItems } from '../navigation';

export function AppRoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const { acceptChallenge, activeRoomId, challenges, clearNotifications, connect, connection, disconnect, lastError, login, loginPending, logout, named, needsPassword, notifications, reconnect, rejectChallenge, rooms, username } = useArenaStore(
    useShallow(state => ({ acceptChallenge: state.acceptChallenge, activeRoomId: state.activeRoomId, challenges: state.challenges, clearNotifications: state.clearNotifications, rejectChallenge: state.rejectChallenge, connect: state.connect, connection: state.connection, disconnect: state.disconnect, lastError: state.lastError, login: state.login, loginPending: state.loginPending, logout: state.logout, named: state.named, needsPassword: state.needsPassword, notifications: state.notifications, reconnect: state.reconnect, rooms: state.rooms, username: state.username }))
  );
  const { contrast, density, motion, notificationsEnabled } = useWorkspaceStore();
  const [nameInput, setNameInput] = useState(named ? username : '');
  const [passwordInput, setPasswordInput] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const submittedAccountRef = useRef(false);
  const accountLabel = named ? username : 'Unnamed guest';
  const focusWorkspace = () => document.getElementById('workspace')?.focus();
  const activeRoom = activeRoomId ? rooms[activeRoomId] : undefined;
  const context = location.pathname.startsWith('/battle/') ?
    {
      label: (activeRoom?.type === 'battle' ? activeRoom.battle.format : undefined) || 'Live battle',
      meta: activeRoomId || 'Battle room',
    } :
    location.pathname === '/teambuilder' ? { label: 'Team workspace', meta: 'Local teams' } :
    location.pathname === '/rooms' ? { label: 'Room console', meta: 'Community' } :
    location.pathname === '/ladder' ? { label: 'Rankings', meta: 'Public ladder' } :
    location.pathname === '/replays' ? { label: 'Replay lab', meta: 'Review' } :
    location.pathname === '/settings' ? { label: 'Client settings', meta: 'Preferences' } :
    { label: 'Matchmaking', meta: 'Battle queue' };
  const incomingChallenges = Object.entries(challenges.from);
  const unreadPms = Object.values(rooms)
    .filter(room => room.type === 'pm' && room.unread > 0)
    .slice(0, 4);
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
    if (!activeRoomId?.startsWith('battle-') || rooms[activeRoomId]?.type !== 'battle') return;
    if (location.pathname === `/battle/${activeRoomId}`) return;
    void navigate({ to: '/battle/$battleId', params: { battleId: activeRoomId } });
  }, [activeRoomId, rooms, location.pathname, navigate]);

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
                <img src="/favicon.svg" alt="" />
              </Link>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip" side="right">Showdown Arena<Tooltip.Arrow className="tooltip-arrow" /></Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <nav className="primary-nav" aria-label="Primary">
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
          {/* role is required for aria-label to be permitted on a generic element. */}
          <i
            className={clsx('rail-connection-dot', `is-${connection}`)}
            role="img"
            aria-label={`Server ${connection}`}
          />
        </aside>

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
                    {!notificationsEnabled ? <p className="popover-empty">Activity notifications are disabled in Settings.</p> : (
                      <>
                        {incomingChallenges.map(([challenger, format]) => (
                          <div className="notification-row is-challenge" key={challenger}>
                            <span>
                              <strong>{challenger} challenged you</strong>
                              <small>{format}</small>
                            </span>
                            <span className="challenge-actions">
                              <button type="button" className="primary-action" onClick={() => {
                                acceptChallenge(challenger);
                                setNotificationsOpen(false);
                              }}>Accept</button>
                              <button type="button" className="secondary-action" onClick={() => rejectChallenge(challenger)}>
                                Reject
                              </button>
                            </span>
                          </div>
                        ))}
                        {unreadPms.map(room => (
                          <button
                            type="button"
                            className="notification-row"
                            key={room.id}
                            onClick={() => {
                              setNotificationsOpen(false);
                              void navigate({ to: '/room/$roomId', params: { roomId: room.id } });
                            }}
                          >
                            <strong>{room.title}</strong>
                            <small>{room.chat.at(-1)?.message.slice(0, 60) || 'Private message'}</small>
                          </button>
                        ))}
                        {!incomingChallenges.length && !unreadPms.length && (
                          <p className="popover-empty">No challenges or unread messages.</p>
                        )}
                      </>
                    )}
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
                          {named ? `Signed in as ${username}.` : 'Pick a name to start battling.'}
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
                          placeholder="Pick any unused name"
                          autoComplete="username"
                          value={nameInput}
                          onChange={event => setNameInput(event.currentTarget.value)}
                        />
                      </label>
                      <label className={clsx(needsPassword && 'needs-attention')}>
                        <span>Password</span>
                        <input
                          aria-label="Password"
                          placeholder={needsPassword ? 'Required — this name is registered' : 'Only for registered accounts'}
                          type="password"
                          autoComplete="current-password"
                          value={passwordInput}
                          onChange={event => setPasswordInput(event.currentTarget.value)}
                        />
                      </label>
                      <p className="account-hint">
                        Unregistered names work immediately. Passwords are sent only to the
                        Showdown login server to obtain a one-time assertion.
                      </p>
                      {connection !== 'connected' && <StatusCallout tone="error">Connect before choosing a name.</StatusCallout>}
                      {loginPending && <StatusCallout>Waiting for server confirmation.</StatusCallout>}
                      {lastError && <StatusCallout tone={needsPassword ? 'warning' : 'error'}>{lastError}</StatusCallout>}
                      <div className="button-row">
                        <button className="primary-action" type="submit" disabled={loginPending || !nameInput.trim()}>
                          {loginPending ? 'Submitting…' : passwordInput ? 'Log in' : 'Choose name'}
                        </button>
                        {named && (
                          <button className="secondary-action" type="button" onClick={() => void logout()}>
                            Log out
                          </button>
                        )}
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

          <SessionTabs />

          <main id="workspace" className="workspace" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
