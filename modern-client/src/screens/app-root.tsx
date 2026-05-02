import { Link, Outlet, useLocation } from '@tanstack/react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  ChevronDown,
  Gamepad2,
  MessageSquareText,
  RadioTower,
  Settings,
  Shield,
  Trophy,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useArenaStore } from '../stores/arena-store';
import { CommandBar } from '../components/command-bar';
import { LegalFooter } from '../components/legal-footer';
import { ConnectionPill } from '../components/status-pills';

const navItems = [
  { to: '/', label: 'Battle', icon: Gamepad2 },
  { to: '/teambuilder', label: 'Teams', icon: Shield },
  { to: '/rooms', label: 'Rooms', icon: Users },
  { to: '/ladder', label: 'Ladder', icon: Trophy },
  { to: '/replays', label: 'Replays', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppRoot() {
  const location = useLocation();
  const { connection, notifications, username, setConnection } = useArenaStore();

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="arena-app">
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
              const active = location.pathname === item.to;
              return (
                <Tooltip.Root key={item.to}>
                  <Tooltip.Trigger asChild>
                    <Link to={item.to} className={clsx('nav-link', active && 'is-active')}>
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
              onClick={() => setConnection(connection === 'connected' ? 'reconnecting' : 'connected')}
            >
              <RadioTower size={16} aria-hidden />
              <span>{connection === 'connected' ? 'Live server' : 'Reconnect'}</span>
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

          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              className="workspace"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Outlet />
            </motion.main>
          </AnimatePresence>
          <LegalFooter />
        </div>
      </div>
    </Tooltip.Provider>
  );
}
