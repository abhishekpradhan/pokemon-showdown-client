import { useParams } from '@tanstack/react-router';
import * as Switch from '@radix-ui/react-switch';
import { motion } from 'motion/react';
import { FastForward, Flag, MessageSquare, Pause, Play, RotateCcw, Send, TimerReset } from 'lucide-react';
import { BattleField } from '../components/battle-field';
import { MoveControls } from '../components/move-controls';
import { TeamBench } from '../components/team-bench';
import { useArenaStore } from '../stores/arena-store';

export function BattleScreen() {
  const params = useParams({ from: '/battle/$battleId' });
  const { battle, submitBattleChoice, toggleHardcore, hardcoreMode } = useArenaStore();

  return (
    <section className="battle-layout battle-console" aria-label={`Battle ${params.battleId}`}>
      <div className="battle-stage">
        <div className="battle-toolbar">
          <div>
            <span className="eyebrow">Gen 9 OU</span>
            <h2>{battle.p1.name} vs {battle.p2.name}</h2>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="icon-button" aria-label="Replay"><RotateCcw size={17} /></button>
            <button type="button" className="icon-button" aria-label="Pause"><Pause size={17} /></button>
            <button type="button" className="icon-button" aria-label="Play"><Play size={17} /></button>
            <button type="button" className="icon-button" aria-label="Fast forward"><FastForward size={17} /></button>
          </div>
        </div>
        <BattleField battle={battle} />
        <motion.div className="decision-dock" layout>
          <div className="decision-heading">
            <div>
              <span className="eyebrow">Turn {battle.turn}</span>
              <h3>What will {battle.active.name} do?</h3>
            </div>
            <div className="timer-chip">
              <TimerReset size={16} aria-hidden />
              1:42
            </div>
          </div>
          <MoveControls moves={battle.moves} onChoose={submitBattleChoice} />
          <TeamBench team={battle.team} onSwitch={submitBattleChoice} />
        </motion.div>
      </div>

      <aside className="battle-side" aria-label="Battle context">
        <section className="side-panel log-panel" aria-label="Battle log">
          <div className="panel-heading">
            <span>Battle log</span>
            <strong>Live</strong>
          </div>
          <ol className="battle-log-list">
            {battle.log.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
          </ol>
        </section>

        <section className="side-panel chat-panel" aria-label="Battle chat">
          <div className="panel-heading">
            <span>Chat</span>
            <strong>Room</strong>
          </div>
          <div className="chat-feed">
            <p><strong>system</strong> Rated battle started.</p>
            <p><strong>spectator</strong> clean opening position</p>
          </div>
          <form className="chat-entry" onSubmit={event => event.preventDefault()}>
            <MessageSquare size={17} aria-hidden />
            <input aria-label="Chat message" placeholder="Message battle room" />
            <button type="submit" aria-label="Send"><Send size={16} /></button>
          </form>
        </section>

        <section className="side-panel options-panel">
          <label className="switch-row">
            <span>Hardcore mode</span>
            <Switch.Root
              className="switch-root"
              checked={hardcoreMode}
              onCheckedChange={toggleHardcore}
              aria-label="Toggle hardcore mode"
            >
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </label>
          <button className="forfeit-button" type="button">
            <Flag size={16} aria-hidden /> Forfeit
          </button>
        </section>
      </aside>
    </section>
  );
}
