import * as Switch from '@radix-ui/react-switch';
import { Music2 } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { isMusicTrack, MUSIC_TRACKS } from '../../preferences/options';
import { playTurnPing } from '../../battle/sound';

export function AudioSettings() {
  const preferences = useWorkspaceStore();
  const { soundEnabled, setSoundEnabled, setPreference, musicEnabled, musicTrack } = preferences;
  return (
    <section className="settings-section" aria-labelledby="audio-settings">
      <h2 id="audio-settings">
        <Music2 size={15} aria-hidden /> Audio
      </h2>
      <div className="setting-row">
        <span>
          <strong>Battle sounds</strong>
          <small>Mute or enable all audio without losing your volume settings.</small>
        </span>
        <Switch.Root
          className="switch-root"
          aria-label="Battle sounds"
          checked={soundEnabled}
          onCheckedChange={setSoundEnabled}
        >
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
      </div>
      {(
        [
          ['effectsVolume', 'Effects volume'],
          ['notificationVolume', 'Notification volume'],
          ['musicVolume', 'Music volume'],
        ] as const
      ).map(([key, label]) => (
        <label className="setting-row" key={key}>
          <strong>{label}</strong>
          <span className="volume-control">
            <input
              aria-label={label}
              type="range"
              min={0}
              max={100}
              value={preferences[key]}
              onChange={event => setPreference(key, Number(event.target.value))}
            />
            <output>{preferences[key]}%</output>
          </span>
        </label>
      ))}
      <div className="setting-row">
        <span>
          <strong>Battle music</strong>
          <small>
            Plays in the battle you are viewing. Pauses when you leave, hide the tab, or the battle ends.
          </small>
        </span>
        <Switch.Root
          className="switch-root"
          aria-label="Battle music"
          checked={musicEnabled}
          onCheckedChange={enabled => setPreference('musicEnabled', enabled)}
        >
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
      </div>
      <label className="setting-row">
        <strong>Music track</strong>
        <select
          aria-label="Music track"
          value={musicTrack}
          onChange={event => {
            if (isMusicTrack(event.target.value)) setPreference('musicTrack', event.target.value);
          }}
        >
          {Object.entries(MUSIC_TRACKS).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="secondary-action"
        type="button"
        disabled={!soundEnabled || !preferences.notificationVolume}
        onClick={() => playTurnPing((preferences.notificationVolume / 100) * 0.5)}
      >
        Test notification sound
      </button>
      <p>
        Music and cries stream from Pokémon Showdown. Playback needs a page interaction and a network
        connection; browser autoplay settings still apply.
      </p>
    </section>
  );
}
