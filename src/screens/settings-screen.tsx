import * as Switch from '@radix-ui/react-switch';
import {
  Bell,
  CircleGauge,
  Contrast,
  ExternalLink,
  FileCode2,
  Gauge,
  RadioTower,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDefaultServerConfig } from '../compat/protocol-client';
import { useArenaStore } from '../stores/arena-store';
import { useWorkspaceStore } from '../stores/workspace-store';

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
  const isDefaultServer = server.host === getDefaultServerConfig().host;
  const {
    contrast,
    density,
    motion,
    notificationsEnabled,
    setContrast,
    setDensity,
    setMotion,
    setNotificationsEnabled,
  } = useWorkspaceStore();

  return (
    <section className="utility-workspace settings-workspace" aria-label="Settings">
      <main className="workspace-stage settings-stage">
        <header className="stage-heading">
          <span>
            <small>Client preferences</small>
            <h1>Settings</h1>
          </span>
        </header>

        <section className="settings-section" aria-labelledby="appearance-settings">
          <div className="settings-section-heading">
            <span><CircleGauge size={16} aria-hidden /><strong id="appearance-settings">Workspace</strong></span>
            <small>Saved in this browser</small>
          </div>
          <div className="setting-row">
            <span className="setting-icon"><Gauge size={16} aria-hidden /></span>
            <span><strong>Interface density</strong><small>Control spacing across lists and inspectors.</small></span>
            <div className="setting-segmented" aria-label="Interface density">
              <button type="button" className={density === 'compact' ? 'is-active' : ''} onClick={() => setDensity('compact')}>Compact</button>
              <button type="button" className={density === 'comfortable' ? 'is-active' : ''} onClick={() => setDensity('comfortable')}>Comfortable</button>
            </div>
          </div>
          <div className="setting-row">
            <span className="setting-icon"><Contrast size={16} aria-hidden /></span>
            <span><strong>High contrast</strong><small>Increase dividers and supporting text contrast.</small></span>
            <Switch.Root
              className="switch-root"
              checked={contrast === 'high'}
              onCheckedChange={checked => setContrast(checked ? 'high' : 'standard')}
              aria-label="High contrast"
            >
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
          <div className="setting-row">
            <span className="setting-icon"><CircleGauge size={16} aria-hidden /></span>
            <span><strong>Reduced motion</strong><small>Disable workspace transitions and ambient animation.</small></span>
            <Switch.Root
              className="switch-root"
              checked={motion === 'reduced'}
              onCheckedChange={checked => setMotion(checked ? 'reduced' : 'full')}
              aria-label="Reduced motion"
            >
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
          <div className="setting-row">
            <span className="setting-icon"><Bell size={16} aria-hidden /></span>
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
          <div className="settings-section-heading">
            <span><RadioTower size={16} aria-hidden /><strong id="connection-settings">Connection</strong></span>
            <small>{connection}</small>
          </div>
          <div className="setting-row">
            <span className={`server-state is-${connection}`} />
            <span><strong>{server.id}</strong><small>{server.host}:{server.port}{server.prefix}</small></span>
            <button type="button" className="secondary-action" onClick={() => connection === 'connected' ? disconnect() : connect()}>
              {connection === 'connected' ? 'Disconnect' : 'Connect'}
            </button>
          </div>
          <form
            className="setting-row server-form"
            onSubmit={event => {
              event.preventDefault();
              if (setServer(serverInput)) setServerInput('');
            }}
          >
            <span className="setting-icon"><Server size={16} aria-hidden /></span>
            <span>
              <strong>Custom server</strong>
              <small>Connect to any PS-compatible server, e.g. <code>localhost:8000</code>.</small>
              <input
                aria-label="Server address"
                placeholder={`${server.host}:${server.port}${server.prefix}`}
                value={serverInput}
                onChange={event => setServerInput(event.currentTarget.value)}
              />
            </span>
            <span className="server-form-actions">
              <button type="submit" className="secondary-action" disabled={!serverInput.trim()}>Use server</button>
              {!isDefaultServer && (
                <button type="button" className="secondary-action" onClick={resetServer}>Reset</button>
              )}
            </span>
          </form>
          <div className="setting-row">
            <span className="setting-icon"><RefreshCw size={16} aria-hidden /></span>
            <span><strong>Reconnect sessions</strong><small>Reconnect and rejoin rooms tracked by this workspace.</small></span>
            <button type="button" className="secondary-action" onClick={reconnect}>Reconnect</button>
          </div>
          <div className="setting-row">
            <span className="setting-icon"><FileCode2 size={16} aria-hidden /></span>
            <span><strong>Protocol diagnostics</strong><small>Keep a redacted local log for troubleshooting.</small></span>
            <Switch.Root
              className="switch-root"
              checked={protocolLogEnabled}
              onCheckedChange={toggleProtocolLog}
              aria-label="Protocol diagnostics"
            >
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
          {lastError && <p className="settings-error" role="alert">{lastError}</p>}
        </section>

        <section className="settings-section source-section" aria-labelledby="source-settings">
          <div className="settings-section-heading">
            <span><FileCode2 size={16} aria-hidden /><strong id="source-settings">Source and license</strong></span>
            <small>AGPL-3.0</small>
          </div>
          <p>This fork keeps its source and license visible for deployed copies.</p>
          <div className="button-row">
            <a className="secondary-action" href="https://github.com/abhishekpradhan/pokemon-showdown-client">
              Source code <ExternalLink size={13} aria-hidden />
            </a>
            <a className="secondary-action" href="https://github.com/abhishekpradhan/pokemon-showdown-client/blob/main/LICENSE">
              License <ExternalLink size={13} aria-hidden />
            </a>
          </div>
        </section>
      </main>

      <aside className="workspace-inspector diagnostics-inspector">
        <header className="inspector-heading">
          <span>
            <small>Diagnostics</small>
            <strong>Protocol activity</strong>
          </span>
          <em>{protocolLogEnabled ? 'Recording' : 'Off'}</em>
        </header>
        <dl className="inspector-facts">
          <div><dt>State</dt><dd>{connection}</dd></div>
          <div><dt>Host</dt><dd>{server.host}</dd></div>
          <div><dt>Port</dt><dd>{server.port}</dd></div>
          <div><dt>Path</dt><dd>{server.prefix}</dd></div>
        </dl>
        <pre className="protocol-log" aria-label="Protocol log">
          {protocolLogEnabled ? rawProtocolLog.slice(0, 80).join('\n') || 'No protocol messages yet.' : 'Enable protocol diagnostics to inspect redacted traffic.'}
        </pre>
      </aside>
    </section>
  );
}
