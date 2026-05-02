import { useParams } from '@tanstack/react-router';
import * as Switch from '@radix-ui/react-switch';
import { motion } from 'motion/react';
import { FastForward, Flag, MessageSquare, Pause, Play, RotateCcw, Send, TimerReset } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { BattleField } from '../components/battle-field';
import { MoveControls } from '../components/move-controls';
import { TeamBench } from '../components/team-bench';
import { useArenaStore } from '../stores/arena-store';

export function BattleScreen() {
  const params = useParams({ from: '/battle/$battleId' });
  const {
    battle: focusedBattle,
    battles,
    submitBattleChoice,
    toggleHardcore,
    hardcoreMode,
    recordBattleEvent,
    sendBattleChat,
    undoBattleChoice,
    toggleBattleTimer,
    forfeitBattle,
  } = useArenaStore();
  const [chatMessage, setChatMessage] = useState('');
  const battle = battles[params.battleId] || focusedBattle;

  const submitChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendBattleChat(chatMessage, battle.id);
    setChatMessage('');
  };

  return (
    <section className="battle-layout battle-console" aria-label={`Battle ${params.battleId}`}>
      <div className="battle-stage">
        <div className="battle-toolbar">
          <div>
            <span className="eyebrow">Gen 9 OU</span>
            <h2>{battle.p1.name} vs {battle.p2.name}</h2>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="icon-button" aria-label="Undo choice" onClick={() => undoBattleChoice(battle.id)}>
              <RotateCcw size={17} />
            </button>
            <button type="button" className="icon-button" aria-label="Pause" onClick={() => recordBattleEvent('Battle playback paused.', battle.id)}>
              <Pause size={17} />
            </button>
            <button type="button" className="icon-button" aria-label="Play" onClick={() => recordBattleEvent('Battle playback resumed.', battle.id)}>
              <Play size={17} />
            </button>
            <button type="button" className="icon-button" aria-label="Fast forward" onClick={() => recordBattleEvent('Skipped to the next decision point.', battle.id)}>
              <FastForward size={17} />
            </button>
          </div>
        </div>
        <BattleField battle={battle} />
        <motion.div className="decision-dock" layout>
          <div className="decision-heading">
            <div>
              <span className="eyebrow">Turn {battle.turn}</span>
              <h3>{battle.waiting ? 'Waiting for opponent' : `What will ${battle.active.name} do?`}</h3>
              {battle.requestType === 'team' && <p className="decision-note">Team preview: choose your lead slot.</p>}
              {battle.requestType === 'switch' && <p className="decision-note">Force switch request active.</p>}
              {battle.trapped && <p className="decision-note">Your active Pokemon is trapped.</p>}
            </div>
            <div className="timer-chip">
              <TimerReset size={16} aria-hidden />
              {battle.requestType || 'live'}
            </div>
          </div>
          {battle.requestType !== 'switch' && battle.requestType !== 'team' && (
            <MoveControls moves={battle.moves} onChoose={choice => submitBattleChoice(choice, battle.id)} />
          )}
          <TeamBench team={battle.team} onSwitch={choice => submitBattleChoice(choice, battle.id)} />
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
            {battle.chat.map((line, index) => (
              <p key={`${line.user}-${line.message}-${index}`}><strong>{line.user}</strong> {line.message}</p>
            ))}
          </div>
          <form className="chat-entry" onSubmit={submitChat}>
            <MessageSquare size={17} aria-hidden />
            <input
              aria-label="Chat message"
              placeholder="Message battle room"
              value={chatMessage}
              onChange={event => setChatMessage(event.currentTarget.value)}
            />
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
          <button className="secondary-action battle-command" type="button" onClick={() => toggleBattleTimer(battle.id)}>
            <TimerReset size={16} aria-hidden /> Timer
          </button>
          <button
            className="forfeit-button"
            type="button"
            onClick={() => {
              if (window.confirm('Forfeit this battle?')) forfeitBattle(battle.id);
            }}
          >
            <Flag size={16} aria-hidden /> Forfeit
          </button>
        </section>
      </aside>
    </section>
  );
}
