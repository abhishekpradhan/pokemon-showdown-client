import * as Dialog from '@radix-ui/react-dialog';
import { UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../../stores/arena-store';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { avatarName, avatarUrl, PUBLIC_AVATARS } from '../../preferences/avatars';
import { isServerLanguage, SERVER_LANGUAGES } from '../../preferences/options';

const labelForAvatar = (name: string) => name.replaceAll('-', ' ');

function AvatarPicker({ value, onChoose }: { value: string; onChoose: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(value);
  const [limit, setLimit] = useState(48);
  const results = PUBLIC_AVATARS.filter(([id, name]) =>
    `${id} ${labelForAvatar(name)}`.includes(query.trim().toLowerCase()),
  );
  return (
    <Dialog.Root
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (next) {
          setSelected(value);
          setQuery('');
          setLimit(48);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="secondary-action">
          Choose avatar
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="account-dialog avatar-dialog">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>Choose an avatar</Dialog.Title>
              <Dialog.Description>Select a public trainer avatar, then apply your choice.</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close avatar picker">
              <X size={17} />
            </Dialog.Close>
          </div>
          <label className="setting-field">
            <span>Search avatars</span>
            <input
              aria-label="Search avatars"
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setLimit(48);
              }}
            />
          </label>
          <div className="avatar-grid" role="group" aria-label="Trainer avatars">
            {results.slice(0, limit).map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-label={labelForAvatar(name)}
                aria-pressed={selected === name}
                onClick={() => setSelected(name)}
              >
                <img src={avatarUrl(name)} width={64} height={64} loading="lazy" alt="" />
                <span>{labelForAvatar(name)}</span>
              </button>
            ))}
          </div>
          {!results.length && <p role="status">No avatars match that search.</p>}
          {results.length > limit && (
            <button className="secondary-action" type="button" onClick={() => setLimit(count => count + 48)}>
              Show more avatars
            </button>
          )}
          <div className="button-row">
            <button
              className="primary-action"
              type="button"
              disabled={!selected || !PUBLIC_AVATARS.some(([, name]) => name === selected)}
              onClick={() => {
                onChoose(selected);
                setOpen(false);
              }}
            >
              Apply avatar
            </button>
            <Dialog.Close className="secondary-action">Cancel</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PendingPreferences({ retry }: { retry: () => void }) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(timeout);
  }, []);
  return (
    <>
      <p role="status">
        {timedOut
          ? 'The server has not confirmed these preferences. Try again, or check your connection.'
          : 'Applying preferences…'}
      </p>
      {timedOut && (
        <button className="secondary-action" type="button" onClick={retry}>
          Retry profile preferences
        </button>
      )}
    </>
  );
}

export function ProfileSettings() {
  const {
    avatar,
    serverLanguage: confirmedLanguage,
    named,
    connection,
  } = useArenaStore(
    useShallow(state => ({
      avatar: state.avatar,
      serverLanguage: state.serverLanguage,
      named: state.named,
      connection: state.connection,
    })),
  );
  const { preferredAvatar, serverLanguage, setPreference } = useWorkspaceStore();
  const connected = named && connection === 'connected';
  const pendingAvatar = !!preferredAvatar && avatarName(avatar || '') !== preferredAvatar;
  const pendingLanguage = serverLanguage !== (confirmedLanguage || 'english');
  const pending = connected && (pendingAvatar || pendingLanguage);
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    const state = useArenaStore.getState();
    if (!state.named || state.connection !== 'connected') return;
    if (pendingAvatar) state.applyAvatarPreference();
    if (pendingLanguage) state.protocol.send(`/language ${serverLanguage}`);
    setAttempt(value => value + 1);
  };
  return (
    <section className="settings-section" aria-labelledby="profile-settings">
      <h2 id="profile-settings">
        <UserRound size={15} aria-hidden /> Profile and language
      </h2>
      <div className="setting-row">
        <span>
          <strong>Trainer avatar</strong>
          <small>
            {connected
              ? 'Current avatar confirmed by the server.'
              : 'Your preference applies when you choose a name.'}
          </small>
        </span>
        <div className="setting-actions">
          {avatarUrl(avatar) && (
            <img src={avatarUrl(avatar)} alt="Current trainer avatar" width={48} height={48} />
          )}
          <AvatarPicker
            value={preferredAvatar || avatarName(avatar || '')}
            onChoose={value => {
              if (value === preferredAvatar && pendingAvatar && connected)
                useArenaStore.getState().applyAvatarPreference();
              setPreference('preferredAvatar', value);
              setAttempt(count => count + 1);
            }}
          />
        </div>
      </div>
      {preferredAvatar && (
        <p>
          Saved avatar: {labelForAvatar(preferredAvatar)}.{' '}
          {pendingAvatar && connected ? 'Waiting for the server to apply it.' : ''}
        </p>
      )}
      <label className="setting-row">
        <span>
          <strong>Server language</strong>
          <small>
            Language for translated server messages. Rooms can choose their own language. Arena’s interface
            remains in English.
          </small>
        </span>
        <select
          aria-label="Server language"
          value={serverLanguage}
          onChange={event => {
            if (isServerLanguage(event.target.value)) setPreference('serverLanguage', event.target.value);
          }}
        >
          {Object.entries(SERVER_LANGUAGES).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {pending ? (
        <PendingPreferences key={`${preferredAvatar}:${serverLanguage}:${attempt}`} retry={retry} />
      ) : (
        <p role="status">
          {connected
            ? 'Profile preferences are in sync.'
            : 'Preferences are saved here and apply on your next named connection.'}
        </p>
      )}
    </section>
  );
}
