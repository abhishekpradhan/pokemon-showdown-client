import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, Bot, ChevronDown, CircleDot, MonitorCog, Moon, ShieldCheck, Sun, X } from 'lucide-react';
import { clsx } from 'clsx';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { CommandBar } from '../components/command-bar';
import { SessionTabs } from '../components/session-tabs';
import { StatusCallout } from '../components/status-callout';
import { navItems } from '../navigation';
import { ChallengeDialog } from '../components/challenge-dialog';
import { useBattleAudio } from '../battle/use-battle-audio';
import { useBackground } from '../preferences/use-background';
import { openChallenge } from '../compat/ui-events';

export function AppRoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    challenges,
    chooseName,
    connect,
    connection,
    lastError,
    loginPending,
    loginWithOAuth,
    logout,
    named,
    oauthAvailable,
    reconnect,
    rejectChallenge,
    rooms,
    username,
  } = useArenaStore(
    useShallow(state => ({
      challenges: state.challenges,
      rejectChallenge: state.rejectChallenge,
      chooseName: state.chooseName,
      connect: state.connect,
      connection: state.connection,
      lastError: state.lastError,
      loginPending: state.loginPending,
      loginWithOAuth: state.loginWithOAuth,
      logout: state.logout,
      named: state.named,
      oauthAvailable: state.oauthAvailable,
      reconnect: state.reconnect,
      rooms: state.rooms,
      username: state.username,
    })),
  );
  const { notificationsEnabled, setTheme, theme, reducedMotion } = useWorkspaceStore();
  const sessionNotice = useArenaStore(state => state.sessionNotice);
  const loginStage = useArenaStore(state => state.loginStage);
  const [nameInput, setNameInput] = useState(named ? username : '');
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const submittedAccountRef = useRef(false);
  const pendingAccountRef = useRef(false);
  const [accountAttempted, setAccountAttempted] = useState(false);
  const accountOpenerRef = useRef<HTMLElement | null>(null);
  const accountInputRef = useRef<HTMLInputElement>(null);
  const accountNavigationRef = useRef(false);
  const previousPathRef = useRef(location.pathname);
  const accountLabel = named ? username : 'Unnamed guest';
  const focusWorkspace = () => document.getElementById('workspace')?.focus();
  const openAccount = (opener: HTMLElement) => {
    accountOpenerRef.current = opener;
    accountNavigationRef.current = false;
    setNameInput(named ? username : '');
    setAccountAttempted(false);
    setNotificationsOpen(false);
    setAccountOpen(true);
  };
  const cancelAccountLogin = () => {
    submittedAccountRef.current = false;
    pendingAccountRef.current = false;
    useArenaStore.getState().cancelLogin();
  };
  const routeBattleId = location.pathname.startsWith('/battle/')
    ? location.pathname.slice('/battle/'.length)
    : undefined;
  const routeBattle = routeBattleId ? rooms[routeBattleId] : undefined;
  useBackground();
  useBattleAudio(
    !!(
      routeBattle?.type === 'battle' &&
      routeBattle.connected &&
      routeBattle.battle.turn >= 1 &&
      !routeBattle.battle.ended
    ),
  );
  const routeRoom = location.pathname.startsWith('/room/')
    ? rooms[location.pathname.slice('/room/'.length)]
    : undefined;
  const context = routeBattleId
    ? {
        label: (routeBattle?.type === 'battle' ? routeBattle.battle.format : undefined) || 'Live battle',
        meta: routeBattleId,
      }
    : location.pathname.startsWith('/room/')
      ? {
          label: routeRoom?.title || 'Conversation',
          meta: routeRoom?.type === 'pm' ? 'Private message' : 'Chat room',
        }
      : location.pathname === '/teambuilder'
        ? { label: 'Teams', meta: 'Saved in this browser' }
        : location.pathname === '/rooms'
          ? { label: 'Rooms', meta: 'Community' }
          : location.pathname === '/battles'
            ? { label: 'Live battles', meta: 'Spectate' }
            : location.pathname === '/ladder'
              ? { label: 'Ladder', meta: 'Player rankings' }
              : location.pathname === '/replays'
                ? { label: 'Replays', meta: 'Battle review' }
                : location.pathname === '/settings'
                  ? { label: 'Settings', meta: 'Preferences' }
                  : { label: 'Battle', meta: 'Find an opponent' };
  const incomingChallenges = Object.entries(challenges.from);
  // The badge tells the truth: it counts exactly what the popover lists.

  const unreadPms = Object.values(rooms)
    .filter(room => room.type === 'pm' && room.unread > 0)
    .slice(0, 4);
  const badgeCount = incomingChallenges.length + unreadPms.length;
  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submittedAccountRef.current = true;
    setAccountAttempted(true);
    void chooseName(nameInput);
  };

  useEffect(() => {
    if (import.meta.env.MODE !== 'test' && import.meta.env.VITE_PS_AUTOCONNECT !== 'false') connect();
  }, [connect]);

  useEffect(() => {
    const sync = () => {
      const match = location.pathname.match(/^\/(battle|room)\/([^/]+)/);
      let id: string | undefined;
      try {
        id = match ? decodeURIComponent(match[2]) : undefined;
      } catch {
        /* Invalid route has no focused room. */
      }
      useArenaStore.getState().focusRoom(document.hidden ? undefined : id);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [location.pathname]);

  useEffect(() => {
    const open = (event: Event) => {
      const path = (event as CustomEvent<string>).detail;
      if (/^\/(?:room|battle)\/[a-z0-9-]+$/.test(path)) void navigate({ to: path });
    };
    const account = (event: Event) => {
      const opener = (event as CustomEvent<unknown>).detail;
      accountNavigationRef.current = false;
      accountOpenerRef.current =
        opener instanceof HTMLElement
          ? opener
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      const state = useArenaStore.getState();
      setNameInput(state.named ? state.username : '');
      setAccountAttempted(false);
      setNotificationsOpen(false);
      setAccountOpen(true);
    };
    window.addEventListener('arena:open-room', open);
    window.addEventListener('arena:open-account', account);
    return () => {
      window.removeEventListener('arena:open-room', open);
      window.removeEventListener('arena:open-account', account);
    };
  }, [navigate]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    if (previousPathRef.current === location.pathname) return;
    previousPathRef.current = location.pathname;
    setNotificationsOpen(false);
    const workspace = document.getElementById('workspace');
    if (workspace) {
      workspace.scrollTop = 0;
      workspace.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  useEffect(() => {
    if (submittedAccountRef.current && accountOpen && loginPending) pendingAccountRef.current = true;
    if (
      submittedAccountRef.current &&
      pendingAccountRef.current &&
      accountOpen &&
      named &&
      !loginPending &&
      !lastError
    ) {
      submittedAccountRef.current = false;
      pendingAccountRef.current = false;
      setAccountOpen(false);
    }
  }, [accountOpen, lastError, loginPending, named]);

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
      <a
        className="skip-link"
        href="#workspace"
        onClick={event => {
          event.preventDefault();
          focusWorkspace();
        }}
      >
        Skip to workspace
      </a>
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
          <span>
            {connection === 'connected'
              ? 'Live'
              : connection === 'offline' || connection === 'error'
                ? 'Off'
                : 'Wait'}
          </span>
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
            <div className="theme-segment" role="group" aria-label="Theme">
              {(
                [
                  { value: 'light', label: 'Light theme', icon: Sun },
                  { value: 'dark', label: 'Dark theme', icon: Moon },
                  { value: 'system', label: 'Follow system theme', icon: MonitorCog },
                ] as const
              ).map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={theme === option.value}
                  aria-label={option.label}
                  className={clsx(theme === option.value && 'is-selected')}
                  onClick={() => setTheme(option.value)}
                >
                  <option.icon size={14} aria-hidden />
                </button>
              ))}
            </div>
            <div className="notification-wrap">
              <Dialog.Root open={notificationsOpen} onOpenChange={setNotificationsOpen} modal={false}>
                <Dialog.Trigger asChild>
                  <button
                    className={clsx('notification-button', notificationsOpen && 'is-active')}
                    type="button"
                    aria-label="Notifications"
                    aria-expanded={notificationsOpen}
                  >
                    <Bell size={17} aria-hidden />
                    {notificationsEnabled && badgeCount > 0 && <span>{badgeCount}</span>}
                  </button>
                </Dialog.Trigger>
                <Dialog.Content className="notification-popover">
                  <div className="popover-heading">
                    <Dialog.Title asChild>
                      <strong>Updates</strong>
                    </Dialog.Title>
                    <Dialog.Close className="icon-button" aria-label="Close notifications">
                      <X size={15} />
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="visually-hidden">
                    Incoming challenges and unread private messages.
                  </Dialog.Description>
                  {!notificationsEnabled ? (
                    <p className="popover-empty">Activity notifications are disabled in Settings.</p>
                  ) : (
                    <>
                      {incomingChallenges.map(([challenger, format]) => (
                        <div className="notification-row is-challenge" key={challenger}>
                          <span>
                            <strong>{challenger} challenged you</strong>
                            <small>
                              {challenges.details?.[challenger.toLowerCase().replace(/[^a-z0-9]/g, '')]
                                ?.message || format}
                            </small>
                          </span>
                          <span className="challenge-actions">
                            <button
                              type="button"
                              className="primary-action"
                              onClick={() => {
                                openChallenge(challenger, format, true);
                                setNotificationsOpen(false);
                              }}
                            >
                              {challenges.details?.[challenger.toLowerCase().replace(/[^a-z0-9]/g, '')]
                                ?.acceptLabel || 'Accept'}
                            </button>
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => rejectChallenge(challenger)}
                            >
                              {challenges.details?.[challenger.toLowerCase().replace(/[^a-z0-9]/g, '')]
                                ?.rejectLabel || 'Reject'}
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
                </Dialog.Content>
              </Dialog.Root>
            </div>
            <Dialog.Root
              open={accountOpen}
              onOpenChange={open => {
                setAccountOpen(open);
                if (!open) cancelAccountLogin();
              }}
            >
              <Dialog.Trigger asChild>
                <button
                  className="user-trigger"
                  type="button"
                  aria-label={accountLabel}
                  onClick={event => openAccount(event.currentTarget)}
                >
                  <Bot size={18} aria-hidden />
                  <span>{named ? username : 'Choose name'}</span>
                  <ChevronDown size={13} aria-hidden />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay" />
                <Dialog.Content
                  className="account-dialog"
                  onOpenAutoFocus={event => {
                    event.preventDefault();
                    accountInputRef.current?.focus();
                    accountInputRef.current?.select();
                  }}
                  onCloseAutoFocus={event => {
                    if (accountNavigationRef.current) {
                      event.preventDefault();
                      document.getElementById('workspace')?.focus({ preventScroll: true });
                    } else if (accountOpenerRef.current?.isConnected) {
                      event.preventDefault();
                      accountOpenerRef.current.focus();
                    }
                  }}
                >
                  <div className="dialog-heading">
                    <div>
                      <Dialog.Title>{named ? 'Account connected' : 'Choose name'}</Dialog.Title>
                      <Dialog.Description>
                        {named
                          ? `Playing as ${username}.`
                          : 'Use a guest name, or sign in to your existing account.'}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close className="icon-button" aria-label="Close account dialog">
                      <X size={17} />
                    </Dialog.Close>
                  </div>
                  <form className="account-form" onSubmit={submitName}>
                    <label>
                      <span>Guest name</span>
                      <input
                        ref={accountInputRef}
                        aria-label="Username"
                        placeholder="Pick any unused name"
                        autoComplete="username"
                        value={nameInput}
                        onChange={event => setNameInput(event.currentTarget.value)}
                      />
                    </label>
                    <p className="account-hint">Guest names are temporary and are not reserved for you.</p>
                    {connection !== 'connected' && (
                      <StatusCallout tone="error">Connect before choosing a name.</StatusCallout>
                    )}
                    {loginPending && (
                      <StatusCallout>
                        {loginStage === 'authorization'
                          ? 'Complete sign-in in the authorization window.'
                          : 'Waiting for server confirmation.'}
                      </StatusCallout>
                    )}
                    {loginPending && (
                      <button className="secondary-action" type="button" onClick={cancelAccountLogin}>
                        Cancel sign-in
                      </button>
                    )}
                    {sessionNotice && <StatusCallout>{sessionNotice}</StatusCallout>}
                    {accountAttempted && lastError && <StatusCallout tone="error">{lastError}</StatusCallout>}
                    <div className="button-row">
                      <button
                        className="primary-action"
                        type="submit"
                        disabled={loginPending || !nameInput.trim() || connection !== 'connected'}
                      >
                        {loginPending ? 'Submitting…' : 'Use guest name'}
                      </button>
                      {named && (
                        <button className="secondary-action" type="button" onClick={() => void logout()}>
                          Log out
                        </button>
                      )}
                      {connection !== 'connected' && (
                        <button className="secondary-action" type="button" onClick={reconnect}>
                          Reconnect
                        </button>
                      )}
                      <Link
                        className="secondary-action"
                        to="/settings"
                        onClick={() => {
                          accountNavigationRef.current = true;
                          cancelAccountLogin();
                          setAccountOpen(false);
                        }}
                      >
                        Settings
                      </Link>
                    </div>
                  </form>
                  <div className="account-oauth">
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={loginPending || !oauthAvailable || connection !== 'connected'}
                      onClick={() => {
                        submittedAccountRef.current = true;
                        setAccountAttempted(true);
                        void loginWithOAuth();
                      }}
                    >
                      <ShieldCheck size={15} aria-hidden />
                      {loginPending ? 'Signing in…' : 'Sign in with Pokémon Showdown'}
                    </button>
                    <p className="account-hint">
                      {oauthAvailable
                        ? 'Sign in securely on Pokémon Showdown. Your password stays there.'
                        : 'Registered sign-in is unavailable on this installation. You can use an unregistered guest name, or play on the official client.'}
                    </p>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </header>

        <SessionTabs />
        <ChallengeDialog />
        {sessionNotice && (
          <div className="global-notice" role="status">
            {sessionNotice}
            <button type="button" className="secondary-action" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss notice"
              onClick={() => useArenaStore.setState({ sessionNotice: undefined })}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <main id="workspace" className="workspace" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
