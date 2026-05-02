import { useParams } from '@tanstack/react-router';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import { motion } from 'motion/react';
import { Crosshair, Flag, MessageSquare, RotateCcw, Send, TimerReset, X } from 'lucide-react';
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
    sendBattleChat,
    undoBattleChoice,
    submitBattleTarget,
    toggleBattleTimer,
    forfeitBattle,
    getBattleDecision,
    resetBattleChoiceSession,
  } = useArenaStore();
  const [chatMessage, setChatMessage] = useState('');
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const demoFixturesEnabled = import.meta.env.MODE === 'test' || import.meta.env.VITE_ENABLE_DEMO_FIXTURES === 'true';
  const routeBattle = battles[params.battleId];
  const battle = routeBattle || (focusedBattle.id === params.battleId ? focusedBattle : null);

  if (!battle || (params.battleId === 'demo-gen9ou' && !demoFixturesEnabled)) {
    return (
      <section className="empty-state" aria-label="Battle room unavailable">
        <span className="eyebrow">Battle</span>
        <h1>Battle room unavailable</h1>
        <p>Join a live battle or start a mock-server search to load battle controls.</p>
      </section>
    );
  }

  const decision = getBattleDecision(battle.id);
  const pendingTarget = decision.draft.pendingMove;
  const targetOptions = pendingTarget ? battle.moves.find(move => move.slot === pendingTarget.slot)?.targetOptions || [-1, -2, 1, 2] : [];
  const playerControls = decision.mode === 'player' && decision.requestType !== 'wait';

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
            <span className="eyebrow">{battle.format}</span>
            <h2>{battle.p1.name} vs {battle.p2.name}</h2>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="icon-button" aria-label="Undo choice" onClick={() => undoBattleChoice(battle.id)}>
              <RotateCcw size={17} />
            </button>
            <button type="button" className="icon-button" aria-label="Reset choice draft" onClick={() => resetBattleChoiceSession(battle.id)}>
              <X size={17} />
            </button>
          </div>
        </div>
        <BattleField battle={battle} />
        <motion.div className="decision-dock" layout>
          <div className="decision-heading">
            <div>
              <span className="eyebrow">Turn {battle.turn}</span>
              <h3>{battle.waiting ? 'Waiting for opponent' : pendingTarget ? 'Choose a target' : playerControls ? `What will ${battle.active.name} do?` : 'Spectating battle'}</h3>
              {battle.requestType === 'team' && <p className="decision-note">Team preview: choose your lead slot.</p>}
              {battle.requestType === 'switch' && <p className="decision-note">Force switch request active.</p>}
              {battle.trapped && <p className="decision-note">Your active Pokemon is trapped.</p>}
              {decision.error && <p className="decision-error">{decision.error}</p>}
            </div>
            <div className="timer-chip">
              <TimerReset size={16} aria-hidden />
              {decision.mode}
            </div>
          </div>
          {pendingTarget && (
            <div className="target-grid" aria-label="Move targets">
              {targetOptions.map(target => (
                <button type="button" className="target-button" key={target} onClick={() => submitBattleTarget(target, battle.id)}>
                  <Crosshair size={15} aria-hidden />
                  {target > 0 ? `Ally +${target}` : `Foe ${target}`}
                </button>
              ))}
            </div>
          )}
          {playerControls && battle.requestType !== 'switch' && battle.requestType !== 'team' && !pendingTarget && (
            <MoveControls moves={battle.moves} onChoose={choice => submitBattleChoice(choice, battle.id)} />
          )}
          <TeamBench team={battle.team} onSwitch={playerControls && !pendingTarget ? choice => submitBattleChoice(choice, battle.id) : undefined} />
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
          <Dialog.Root open={forfeitOpen} onOpenChange={setForfeitOpen}>
            <Dialog.Trigger className="forfeit-button">
              <Flag size={16} aria-hidden /> Forfeit
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content className="account-dialog">
                <div className="dialog-heading">
                  <div>
                    <Dialog.Title>Forfeit battle?</Dialog.Title>
                    <Dialog.Description>This sends `/forfeit` to the current battle room.</Dialog.Description>
                  </div>
                  <Dialog.Close className="icon-button" aria-label="Close forfeit dialog"><X size={17} /></Dialog.Close>
                </div>
                <div className="button-row">
                  <button className="forfeit-button" type="button" onClick={() => {
                    forfeitBattle(battle.id);
                    setForfeitOpen(false);
                  }}>Forfeit</button>
                  <Dialog.Close className="secondary-action">Cancel</Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </section>
      </aside>
    </section>
  );
}
