import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Bell,
  Bot,
  ChevronDown,
  CircleDot,
  MonitorCog,
  Moon,
  ShieldCheck,
  Sun,
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
  const { acceptChallenge, challenges, chooseName, connect, connection, disconnect, lastError, loginPending, loginWithOAuth, logout, named, oauthAvailable, reconnect, rejectChallenge, rooms, username } = useArenaStore(
    useShallow(state => ({ acceptChallenge: state.acceptChallenge, challenges: state.challenges, rejectChallenge: state.rejectChallenge, chooseName: state.chooseName, connect: state.connect, connection: state.connection, disconnect: state.disconnect, lastError: state.lastError, loginPending: state.loginPending, loginWithOAuth: state.loginWithOAuth, logout: state.logout, named: state.named, oauthAvailable: state.oauthAvailable, reconnect: state.reconnect, rooms: state.rooms, username: state.username }))
  );
  const { notificationsEnabled, setTheme, theme } = useWorkspaceStore();
  const [nameInput, setNameInput] = useState(named ? username : '');
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const submittedAccountRef = useRef(false);
  const accountLabel = named ? username : 'Unnamed guest';
  const focusWorkspace = () => document.getElementById('workspace')?.focus();
  const routeBattleId = location.pathname.startsWith('/battle/') ?
    location.pathname.slice('/battle/'.length) : undefined;
  const routeBattle = routeBattleId ? rooms[routeBattleId] : undefined;
  const context = routeBattleId ?
    {
      label: (routeBattle?.type === 'battle' ? routeBattle.battle.format : undefined) || 'Live battle',
      meta: routeBattleId,
    } :
    location.pathname === '/teambuilder' ? { label: 'Team workspace', meta: 'Local teams' } :
    location.pathname === '/rooms' ? { label: 'Room console', meta: 'Community' } :
    location.pathname === '/ladder' ? { label: 'Rankings', meta: 'Public ladder' } :
    location.pathname === '/replays' ? { label: 'Replay lab', meta: 'Review' } :
    location.pathname === '/settings' ? { label: 'Client settings', meta: 'Preferences' } :
    { label: 'Matchmaking', meta: 'Battle queue' };
  const incomingChallenges = Object.entries(challenges.from);
  // The badge tells the truth: it counts exactly what the popover lists.

  const unreadPms = Object.values(rooms)
    .filter(room => room.type === 'pm' && room.unread > 0)
    .slice(0, 4);
  const badgeCount = incomingChallenges.length + unreadPms.length;
  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submittedAccountRef.current = true;
    void chooseName(nameInput);
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

  // Resolve the theme preference to a concrete data-theme, tracking the OS
  // when set to "system".
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  // A battle takes focus exactly once, when it opens (matched or joined) —
  // continuously steering to it trapped spectators on the battle screen.
  const handledBattlesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const battleIds = Object.values(rooms)
      // Server battle rooms only — the demo fixture room must never steal
      // focus (it exists at boot under test fixtures).
      .filter(room => room.type === 'battle' && room.connected && room.id.startsWith('battle-'))
      .map(room => room.id);
    const fresh = battleIds.filter(id => !handledBattlesRef.current.has(id));
    for (const id of battleIds) handledBattlesRef.current.add(id);
    if (!fresh.length) return;
    const target = fresh[fresh.length - 1];
    if (location.pathname !== `/battle/${target}`) {
      void navigate({ to: '/battle/$battleId', params: { battleId: target } });
    }
  }, [rooms, location.pathname, navigate]);

  return (
    <div className="arena-app">
        <button className="skip-link" type="button" onClick={focusWorkspace}>
          Skip to workspace
        </button>
        <aside className="primary-rail" aria-label="Primary">
          <Link to="/" className="brand-mark" aria-label="Showdown Arena home">
            <img src="/favicon.svg" alt="" />
          </Link>
          <nav className="primary-nav" aria-label="Primary">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = item.activePattern.test(location.pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={clsx('primary-nav-link', active && 'is-active')}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={19} aria-hidden />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <Link
            to="/settings"
            className={clsx('rail-status', `is-${connection}`)}
            aria-label={`Server ${connection} — connection settings`}
            title={`Server ${connection}`}
          >
            <i aria-hidden />
            <span>{connection === 'connected' ? 'Live' : connection === 'offline' || connection === 'error' ? 'Off' : 'Wait'}</span>
          </Link>
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
              <div className="theme-segment" role="radiogroup" aria-label="Theme">
                {([
                  { value: 'light', label: 'Light theme', icon: Sun },
                  { value: 'dark', label: 'Dark theme', icon: Moon },
                  { value: 'system', label: 'Follow system theme', icon: MonitorCog },
                ] as const).map(option => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={theme === option.value}
                    aria-label={option.label}
                    className={clsx(theme === option.value && 'is-selected')}
                    onClick={() => setTheme(option.value)}
                  >
                    <option.icon size={14} aria-hidden />
                  </button>
                ))}
              </div>
              <div className="notification-wrap">
                <button
                  className={clsx('notification-button', notificationsOpen && 'is-active')}
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={notificationsOpen}
                  onClick={() => setNotificationsOpen(open => !open)}
                >
                  <Bell size={17} aria-hidden />
                  {notificationsEnabled && badgeCount > 0 && <span>{badgeCount}</span>}
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
                    <div className="account-oauth">
                      <button
                        className="primary-action"
                        type="button"
                        disabled={loginPending || !oauthAvailable || connection !== 'connected'}
                        onClick={() => { submittedAccountRef.current = true; void loginWithOAuth(); }}
                      >
                        <ShieldCheck size={15} aria-hidden />
                        {loginPending ? 'Signing in…' : 'Sign in with Pokémon Showdown'}
                      </button>
                      <p className="account-hint">
                        {oauthAvailable ?
                          'Opens Pokémon Showdown to authorize this client. Your password is never typed here, and this browser stays signed in for two weeks.' :
                          'Registered-account sign-in needs an OAuth client ID (VITE_PS_OAUTH_CLIENT_ID). Until then, unregistered names below work immediately.'}
                      </p>
                    </div>
                    <form className="account-form" onSubmit={submitName}>
                      <label>
                        <span>Guest name</span>
                        <input
                          aria-label="Username"
                          placeholder="Pick any unused name"
                          autoComplete="username"
                          value={nameInput}
                          onChange={event => setNameInput(event.currentTarget.value)}
                        />
                      </label>
                      <p className="account-hint">
                        Unregistered names work immediately and claim nothing — registered
                        accounts must use the button above.
                      </p>
                      {connection !== 'connected' && <StatusCallout tone="error">Connect before choosing a name.</StatusCallout>}
                      {loginPending && <StatusCallout>Waiting for server confirmation.</StatusCallout>}
                      {lastError && <StatusCallout tone="error">{lastError}</StatusCallout>}
                      <div className="button-row">
                        <button className="secondary-action" type="submit" disabled={loginPending || !nameInput.trim()}>
                          {loginPending ? 'Submitting…' : 'Use guest name'}
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
  );
}
