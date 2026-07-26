import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import {
  Bell,
  ClipboardCopy,
  ExternalLink,
  FileCode2,
  Monitor,
  Moon,
  Paintbrush,
  RadioTower,
  RefreshCw,
  Scale,
  Server,
  Sun,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDefaultServerConfig } from '../compat/protocol-client';
import { useArenaStore } from '../stores/arena-store';
import { useWorkspaceStore } from '../stores/workspace-store';

/**
 * Settings: one narrow column, one section per intent, one row anatomy.
 * The protocol log renders only while diagnostics is on — wire frames are
 * not furniture.
 */
export function SettingsScreen() {
  const {
    connect, connection, disconnect, lastError, protocolLogEnabled, rawProtocolLog,
    reconnect, resetServer, server, setServer, toggleProtocolLog,
  } = useArenaStore(
    useShallow(state => ({
      connect: state.connect, connection: state.connection, disconnect: state.disconnect,
      lastError: state.lastError, protocolLogEnabled: state.protocolLogEnabled,
      rawProtocolLog: state.rawProtocolLog, reconnect: state.reconnect,
      resetServer: state.resetServer, server: state.server, setServer: state.setServer,
      toggleProtocolLog: state.toggleProtocolLog,
    }))
  );
  const [serverInput, setServerInput] = useState('');
  const [logCopied, setLogCopied] = useState(false);
  const isDefaultServer = server.host === getDefaultServerConfig().host;
  const { notificationsEnabled, setNotificationsEnabled, setTheme, theme } = useWorkspaceStore();

  return (
    <section className="settings-page" aria-label="Settings">
      <header className="settings-heading">
        <h1>Settings</h1>
        <p>Stored in this browser. Nothing leaves your machine except what you send to the battle server.</p>
      </header>

      <section className="settings-section" aria-labelledby="appearance-settings">
        <h2 id="appearance-settings"><Paintbrush size={15} aria-hidden /> Appearance</h2>
        <div className="setting-row">
          <span><strong>Theme</strong><small>Match the system, or pin light or dark.</small></span>
          <div className="setting-segmented" aria-label="Theme">
            <button type="button" className={theme === 'light' ? 'is-active' : ''} onClick={() => setTheme('light')}>
              <Sun size={13} aria-hidden /> Light
            </button>
            <button type="button" className={theme === 'dark' ? 'is-active' : ''} onClick={() => setTheme('dark')}>
              <Moon size={13} aria-hidden /> Dark
            </button>
            <button type="button" className={theme === 'system' ? 'is-active' : ''} onClick={() => setTheme('system')}>
              <Monitor size={13} aria-hidden /> System
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="notification-settings">
        <h2 id="notification-settings"><Bell size={15} aria-hidden /> Notifications</h2>
        <div className="setting-row">
          <span><strong>Activity notifications</strong><small>Track battle sessions, challenges, and private messages.</small></span>
          <Switch.Root
            className="switch-root"
            checked={notificationsEnabled}
            onCheckedChange={setNotificationsEnabled}
            aria-label="Activity notifications"
          >
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="connection-settings">
        <h2 id="connection-settings"><RadioTower size={15} aria-hidden /> Connection</h2>
        <div className="setting-row">
          <span>
            <strong className="server-name">
              <i className={`server-state is-${connection}`} aria-hidden />
              {server.id}
            </strong>
            <small>{server.host}:{server.port}{server.prefix} · {connection}</small>
          </span>
          <div className="setting-actions">
            <button type="button" className="secondary-action" onClick={reconnect}>
              <RefreshCw size={13} aria-hidden /> Reconnect
            </button>
            <button type="button" className="secondary-action" onClick={() => connection === 'connected' ? disconnect() : connect()}>
              {connection === 'connected' ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
        <form
          className="setting-field"
          onSubmit={event => {
            event.preventDefault();
            if (setServer(serverInput)) setServerInput('');
          }}
        >
          <span><strong>Custom server</strong><small>Connect to any PS-compatible server, e.g. <code>localhost:8000</code>.</small></span>
          <div className="setting-field-controls">
            <span className="setting-field-icon" aria-hidden><Server size={14} /></span>
            <input
              aria-label="Server address"
              placeholder={`${server.host}:${server.port}${server.prefix}`}
              value={serverInput}
              onChange={event => setServerInput(event.currentTarget.value)}
            />
            <button type="submit" className="secondary-action" disabled={!serverInput.trim()}>Use server</button>
            {!isDefaultServer && (
              <button type="button" className="secondary-action" onClick={resetServer}>Reset</button>
            )}
          </div>
        </form>
        {lastError && <p className="settings-error" role="alert">{lastError}</p>}
      </section>

      <section className="settings-section" aria-labelledby="diagnostics-settings">
        <h2 id="diagnostics-settings"><FileCode2 size={15} aria-hidden /> Diagnostics</h2>
        <div className="setting-row">
          <span><strong>Protocol log</strong><small>Keep a redacted local log of server traffic for troubleshooting.</small></span>
          <div className="setting-actions">
            {protocolLogEnabled && (
              <Dialog.Root onOpenChange={() => setLogCopied(false)}>
                <Dialog.Trigger asChild>
                  <button type="button" className="secondary-action">View log</button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="dialog-overlay" />
                  <Dialog.Content className="account-dialog protocol-dialog">
                    <div className="dialog-heading">
                      <div>
                        <Dialog.Title>Protocol log</Dialog.Title>
                        <Dialog.Description>
                          Newest first · redacted · the latest {rawProtocolLog.length} of up to 240 frames.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close className="icon-button" aria-label="Close protocol log"><X size={17} /></Dialog.Close>
                    </div>
                    <pre className="protocol-log" aria-label="Protocol log" role="region" tabIndex={0}>
                      {rawProtocolLog.join('\n') || 'No protocol messages yet.'}
                    </pre>
                    <div className="button-row">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => {
                          void navigator.clipboard.writeText(rawProtocolLog.join('\n'));
                          setLogCopied(true);
                        }}
                      >
                        <ClipboardCopy size={13} aria-hidden /> {logCopied ? 'Copied' : 'Copy log'}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            )}
            <Switch.Root
              className="switch-root"
              checked={protocolLogEnabled}
              onCheckedChange={toggleProtocolLog}
              aria-label="Protocol diagnostics"
            >
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="about-settings">
        <h2 id="about-settings"><ExternalLink size={15} aria-hidden /> About</h2>
        <div className="setting-row">
          <span>
            <strong>Showdown Arena</strong>
            <small>An independent, open-source client for Pokémon Showdown.</small>
          </span>
          <div className="setting-actions">
            <a className="secondary-action" href="https://github.com/abhishekpradhan/pokemon-showdown-client">
              Source code <ExternalLink size={13} aria-hidden />
            </a>
            <a className="secondary-action" href="https://github.com/abhishekpradhan/pokemon-showdown-client/blob/main/LICENSE">
              License <ExternalLink size={13} aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="legal-settings">
        <h2 id="legal-settings"><Scale size={15} aria-hidden /> Legal</h2>
        <div className="setting-legal">
          <p>
            Showdown Arena is not affiliated with or endorsed by Smogon, Nintendo,
            Creatures, or GAME FREAK. Pokémon and Pokémon character names are
            trademarks of Nintendo.
          </p>
          <p>
            This site runs no game servers and hosts no game data. Battles, chat,
            accounts, and ladder standings live on the Pokémon Showdown server you
            connect to, under that server&apos;s{' '}
            <a href="https://pokemonshowdown.com/rules">rules</a> and moderation —
            room content comes from its community, not from this site. Your
            settings and teams exist only in this browser.
          </p>
          <p>
            The software is provided as-is, without warranty of any kind, under
            the{' '}
            <a href="https://www.gnu.org/licenses/agpl-3.0.html">AGPL-3.0-or-later</a>{' '}
            license.
          </p>
        </div>
      </section>
    </section>
  );
}
