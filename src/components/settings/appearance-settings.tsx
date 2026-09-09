import { Monitor, Moon, Paintbrush, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { BACKGROUNDS, isBackground } from '../../preferences/options';
import {
  backgroundChanged,
  readBackground,
  removeBackground,
  saveBackground,
} from '../../preferences/background';

export function AppearanceSettings() {
  const { theme, setTheme, background, setPreference } = useWorkspaceStore();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [hasImage, setHasImage] = useState(false);
  useEffect(() => {
    let current = true;
    void readBackground()
      .then(blob => {
        if (!current) return;
        setHasImage(!!blob);
        if (background === 'custom' && !blob)
          setNotice('Your image is no longer stored here. Choose it again, or use a built-in background.');
      })
      .catch(() => {
        if (current && background === 'custom')
          setNotice('Your image could not be loaded. Choose a built-in background or try uploading again.');
      });
    return () => {
      current = false;
    };
  }, [background]);
  return (
    <section className="settings-section" aria-labelledby="appearance-settings">
      <h2 id="appearance-settings">
        <Paintbrush size={15} aria-hidden /> Appearance
      </h2>
      <div className="setting-row">
        <span>
          <strong>Theme</strong>
          <small>Match the system, or pin light or dark.</small>
        </span>
        <div className="setting-segmented" role="group" aria-label="Theme">
          {(
            [
              ['light', 'Light', Sun],
              ['dark', 'Dark', Moon],
              ['system', 'System', Monitor],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              className={theme === value ? 'is-active' : ''}
              onClick={() => setTheme(value)}
            >
              <Icon size={13} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="setting-row">
        <span>
          <strong>Background</strong>
          <small>Controls keep their solid background for readability.</small>
        </span>
        <select
          aria-label="Background"
          disabled={busy}
          value={background}
          onChange={event => {
            if (isBackground(event.target.value)) {
              setPreference('background', event.target.value);
              setNotice('');
            }
          }}
        >
          {Object.entries(BACKGROUNDS).map(([value, label]) => (
            <option key={value} value={value} disabled={value === 'custom' && !hasImage}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="setting-field">
        <span>
          <strong>Use your own image</strong>
          <small>PNG, JPEG or WebP, up to 1 MB. Stored only in this browser; never uploaded.</small>
        </span>
        <input
          aria-label="Background image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            setBusy(true);
            setNotice('Opening image…');
            void saveBackground(file)
              .then(() => {
                setHasImage(true);
                if (useWorkspaceStore.getState().background === background)
                  setPreference('background', 'custom');
                backgroundChanged();
                setNotice('Background saved in this browser.');
              })
              .catch((error: unknown) =>
                setNotice(error instanceof Error ? error.message : 'The image could not be saved.'),
              )
              .finally(() => setBusy(false));
          }}
        />
      </label>
      {hasImage && (
        <button
          className="secondary-action"
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void removeBackground()
              .then(() => {
                setHasImage(false);
                if (background === 'custom') setPreference('background', 'none');
                backgroundChanged();
                setNotice('Your stored image was removed.');
              })
              .catch(() => setNotice('The stored image could not be removed. Please try again.'))
              .finally(() => setBusy(false));
          }}
        >
          Remove stored image
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
