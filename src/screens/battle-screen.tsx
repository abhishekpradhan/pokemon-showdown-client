import { Link, useParams } from '@tanstack/react-router';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import {
  CloudSun,
  Download,
  Film,
  Crosshair,
  Flag,
  Info,
  ListTree,
  MessageSquare,
  PanelRightClose,
  RotateCcw,
  Send,
  TimerReset,
  X,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { buildMoveDeck } from '../compat/battle-adapter';
import { BattleField } from '../components/battle-field';
import { BattleTimerChip } from '../components/battle-timer';
import { ChatFeed } from '../components/chat-feed';
import { MoveControls } from '../components/move-controls';
import { TeamBench } from '../components/team-bench';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';

type InspectorTab = 'log' | 'chat' | 'info';

export function BattleScreen() {
  const params = useParams({ from: '/battle/$battleId' });
  const { replayStatus, rooms, saveReplay, username, connection, focusRoom, forfeitBattle, getBattleDecision, hardcoreMode, joinRoom, resetBattleChoiceSession, sendBattleChat, submitBattleChoice, submitBattleTarget, toggleBattleTimer, toggleHardcore, undoBattleChoice } = useArenaStore(
    useShallow(state => ({ replayStatus: state.replayStatus, rooms: state.rooms, saveReplay: state.saveReplay, username: state.username, connection: state.connection, focusRoom: state.focusRoom, forfeitBattle: state.forfeitBattle, getBattleDecision: state.getBattleDecision, hardcoreMode: state.hardcoreMode, joinRoom: state.joinRoom, resetBattleChoiceSession: state.resetBattleChoiceSession, sendBattleChat: state.sendBattleChat, submitBattleChoice: state.submitBattleChoice, submitBattleTarget: state.submitBattleTarget, toggleBattleTimer: state.toggleBattleTimer, toggleHardcore: state.toggleHardcore, undoBattleChoice: state.undoBattleChoice }))
  );
  const [chatMessage, setChatMessage] = useState('');
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('log');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const demoFixturesEnabled = import.meta.env.MODE === 'test' || import.meta.env.VITE_ENABLE_DEMO_FIXTURES === 'true';
  const room = rooms[params.battleId];
  const battleRoom = room?.type === 'battle' ? room : null;
  const battle = battleRoom?.battle ?? null;

  const battleRoomId = battleRoom?.id;
  useEffect(() => {
    if (battleRoomId) {
      focusRoom(battleRoomId);
      return;
    }
    if (params.battleId.startsWith('battle-') && connection === 'connected') joinRoom(params.battleId);
  }, [battleRoomId, connection, focusRoom, joinRoom, params.battleId]);

  if (!battle || (params.battleId === 'demo-gen9ou' && !demoFixturesEnabled)) {
    return (
      <section className="empty-state battle-loading" aria-label="Battle room unavailable">
        <span className="eyebrow">Battle session</span>
        <h1>{connection === 'connected' ? 'Joining battle room…' : 'Battle room unavailable'}</h1>
        <p>{connection === 'connected' ? params.battleId : 'Reconnect or start a new matchmaking search.'}</p>
        <Link to="/" className="primary-action">Return to matchmaking</Link>
      </section>
    );
  }

  const decision = getBattleDecision(battle.id);
  const pendingTarget = decision.draft.pendingMove;

  // Doubles: the session collects one choice per active slot; the deck and
  // the title track the slot currently being decided. (While a move waits on
  // its target the cursor still points at the mover.)
  const activeCount = battleRoom?.lastRequest?.active?.length ?? 1;
  const choiceCursor = Math.min(decision.draft.choices.length, Math.max(0, activeCount - 1));
  const activeDeck = choiceCursor > 0 && battleRoom?.lastRequest ?
    buildMoveDeck(
      battleRoom.lastRequest,
      battle.opponentActive.terastallized ? [battle.opponentActive.terastallized] : battle.opponentActive.types,
      battle.format,
      choiceCursor
    ) :
    battle.moves;
  const cursorName = battle.actives?.find(pokemon => pokemon.slot === choiceCursor + 1)?.name ?? battle.active.name;

  const pendingMoveCard = pendingTarget ? activeDeck.find(move => move.slot === pendingTarget.slot) : undefined;
  const targetOptions = pendingTarget ? pendingMoveCard?.targetOptions || [1, 2, -1, -2] : [];
  /** Resolves a protocol target slot (+foe / −ally) to the Pokémon standing there. */
  const describeTarget = (target: number) => {
    const foe = target > 0;
    const pool = foe ?
      (battle.opponentActives?.length ? battle.opponentActives : [battle.opponentActive]) :
      (battle.actives?.length ? battle.actives : [battle.active]);
    const pokemon = pool.find(entry => entry.slot === Math.abs(target));
    const self = !foe && Math.abs(target) - 1 === (pendingTarget?.activeIndex ?? choiceCursor);
    return {
      foe,
      name: pokemon?.name,
      // Empty or fainted slots are not legal targets; your own slot only is
      // for adjacentAllyOrSelf moves.
      disabled: !pokemon || pokemon.fainted || pokemon.hp <= 0 ||
        (self && pendingMoveCard?.target !== 'adjacentAllyOrSelf'),
    };
  };
  const playerControls = decision.mode === 'player' && decision.requestType !== 'wait';
  const decisionTitle = battle.ended ?
    battle.winner ? `${battle.winner} won the battle` : 'Battle ended in a tie' :
    battle.waiting ? 'Waiting for opponent' :
    pendingTarget ? `Choose ${pendingMoveCard?.name ?? 'a move'}’s target` :
    playerControls ? `Choose ${cursorName}’s action` : 'Spectating battle';

  const downloadLog = () => {
    if (!battleRoom) return;
    // |request| lines carry our full team — private — and never appear in
    // official replay logs either.
    const log = battleRoom.rawLog.filter(line => !line.startsWith('|request|')).join('\n');
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${battleRoom.id}.log`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const submitChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendBattleChat(chatMessage, battle.id);
    setChatMessage('');
  };

  const openInspector = (tab: InspectorTab) => {
    setInspectorTab(tab);
    setInspectorOpen(true);
  };

  return (
    <section className="battle-layout battle-console" aria-label={`Battle ${params.battleId}`}>
      <div className="battle-stage">
        <header className="battle-toolbar">
          <div className="battle-room-title">
            <span className="battle-state-dot" data-state={battle.ended ? 'ended' : battle.waiting ? 'waiting' : 'live'} />
            <span>
              <strong>{battle.p1.name} <i>vs</i> {battle.p2.name}</strong>
              <small>{battle.format} · Turn {battle.turn || '—'}</small>
            </span>
          </div>
          <div className="battle-toolbar-state">
            {battleRoom && <BattleTimerChip timer={battleRoom.timer} />}
            {battle.weather && <span><CloudSun size={13} aria-hidden /> {battle.weather}</span>}
            <span>{decision.mode}</span>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="icon-button mobile-inspector-button" aria-label="Open battle log" onClick={() => openInspector('log')}>
              <ListTree size={17} />
            </button>
            <button type="button" className="icon-button mobile-inspector-button" aria-label="Open battle chat" onClick={() => openInspector('chat')}>
              <MessageSquare size={17} />
            </button>
            <button type="button" className="icon-button" aria-label="Undo choice" disabled={decision.noCancel} onClick={() => undoBattleChoice(battle.id)}>
              <RotateCcw size={17} />
            </button>
            <button type="button" className="icon-button" aria-label="Reset choice draft" onClick={() => resetBattleChoiceSession(battle.id)}>
              <X size={17} />
            </button>
          </div>
        </header>

        <BattleField battle={battle} hardcore={hardcoreMode} lastEvent={battleRoom?.lastEvent} />

        <div className="decision-dock" aria-label="Battle action deck">
          <div className="decision-heading">
            <div>
              <span className="eyebrow">Action deck · Turn {battle.turn}</span>
              <h2>{decisionTitle}</h2>
              {battle.requestType === 'team' && <p className="decision-note">Team preview: choose your lead slot.</p>}
              {battle.requestType === 'switch' && <p className="decision-note">A replacement is required.</p>}
              {battle.trapped && <p className="decision-note">Your active Pokémon is trapped.</p>}
              {decision.error && <p className="decision-error" role="alert">{decision.error}</p>}
            </div>
            <span className={`decision-mode is-${decision.mode}`}>{decision.mode}</span>
          </div>

          {pendingTarget && (
            <div className="target-grid" aria-label="Move targets">
              {targetOptions.map(target => {
                const described = describeTarget(target);
                return (
                  <button
                    type="button"
                    className="target-button"
                    key={target}
                    data-side={described.foe ? 'foe' : 'ally'}
                    disabled={described.disabled}
                    onClick={() => submitBattleTarget(target, battle.id)}
                  >
                    <Crosshair size={15} aria-hidden />
                    <span>
                      <strong>{described.name ?? `Slot ${Math.abs(target)}`}</strong>
                      <small>{described.foe ? 'Opponent' : 'Your side'}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="decision-controls">
            <div className="move-deck">
              {playerControls && battle.requestType !== 'switch' && battle.requestType !== 'team' && !pendingTarget ? (
                <MoveControls moves={activeDeck} onChoose={choice => submitBattleChoice(choice, battle.id)} />
              ) : !pendingTarget && (
                <div className="waiting-state" role="status" aria-live="polite">
                  <span className="waiting-pulse" />
                  <span>{battle.ended ? 'This session is complete.' : battle.waiting ? 'Your choice has been submitted.' : 'Battle controls are read-only.'}</span>
                </div>
              )}
            </div>
            {battle.team.length > 0 && (
              <div className="bench-deck">
                <span className="deck-label">Your team</span>
                <TeamBench team={battle.team} onSwitch={playerControls && !pendingTarget ? choice => submitBattleChoice(choice, battle.id) : undefined} />
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className={`battle-side ${inspectorOpen ? 'is-open' : ''}`} aria-label="Battle inspector">
        <header className="inspector-tabs">
          <button type="button" className={inspectorTab === 'log' ? 'is-active' : ''} onClick={() => setInspectorTab('log')}>
            <ListTree size={14} aria-hidden /> Log
          </button>
          <button type="button" className={inspectorTab === 'chat' ? 'is-active' : ''} onClick={() => setInspectorTab('chat')}>
            <MessageSquare size={14} aria-hidden /> Chat
          </button>
          <button type="button" className={inspectorTab === 'info' ? 'is-active' : ''} onClick={() => setInspectorTab('info')}>
            <Info size={14} aria-hidden /> Info
          </button>
          <button type="button" className="inspector-close" aria-label="Close battle inspector" onClick={() => setInspectorOpen(false)}>
            <PanelRightClose size={16} />
          </button>
        </header>

        <div className="battle-inspector-content">
          {inspectorTab === 'log' && (
            <section className="battle-log-panel" aria-label="Battle log">
              <div className="panel-heading">
                <span>Protocol events</span>
                <strong>Live</strong>
              </div>
              <ol className="battle-log-list" aria-live="polite">
                {(battleRoom?.log ?? []).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
              </ol>
            </section>
          )}

          {inspectorTab === 'chat' && (
            <section className="battle-chat-panel" aria-label="Battle chat">
              <div className="chat-feed">
                <ChatFeed messages={battleRoom?.chat ?? []} selfName={username} />
              </div>
              <form className="chat-entry" onSubmit={submitChat}>
                <MessageSquare size={16} aria-hidden />
                <input
                  aria-label="Chat message"
                  placeholder="Message battle room"
                  value={chatMessage}
                  onChange={event => setChatMessage(event.currentTarget.value)}
                />
                <button type="submit" aria-label="Send"><Send size={15} /></button>
              </form>
            </section>
          )}

          {inspectorTab === 'info' && (
            <section className="battle-info-panel" aria-label="Battle information">
              <dl className="battle-facts">
                <div><dt>Format</dt><dd>{battle.format}</dd></div>
                <div><dt>Room</dt><dd>{battle.id}</dd></div>
                <div><dt>Mode</dt><dd>{decision.mode}</dd></div>
                <div><dt>Timer</dt><dd>{battle.timerOn ? 'Enabled' : 'Disabled'}</dd></div>
                <div><dt>Weather</dt><dd>{battle.weather || 'Clear'}</dd></div>
                <div><dt>Field</dt><dd>{battle.fieldConditions?.join(', ') || 'No effects'}</dd></div>
              </dl>
              <label className="switch-row">
                <span>
                  <strong>Hardcore display</strong>
                  <small>Hide inferred battle information.</small>
                </span>
                <Switch.Root
                  className="switch-root"
                  checked={hardcoreMode}
                  onCheckedChange={toggleHardcore}
                  aria-label="Toggle hardcore mode"
                >
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
              </label>
            </section>
          )}
        </div>

        <footer className="battle-inspector-actions">
          {battle.ended ? (
            replayStatus?.state === 'uploaded' && replayStatus.url ? (
              <a className="battle-command is-link" href={replayStatus.url} target="_blank" rel="noopener noreferrer">
                <Film size={15} aria-hidden /> View replay
              </a>
            ) : (
              <button
                className="battle-command"
                type="button"
                disabled={replayStatus?.state === 'saving'}
                onClick={() => saveReplay(battle.id)}
              >
                <Film size={15} aria-hidden />
                {replayStatus?.state === 'saving' ? 'Saving…' :
                  replayStatus?.state === 'failed' ? 'Retry save' : 'Save replay'}
              </button>
            )
          ) : (
            <button className="battle-command" type="button" onClick={() => toggleBattleTimer(battle.id)}>
              <TimerReset size={15} aria-hidden /> Timer {battle.timerOn ? 'on' : 'off'}
            </button>
          )}
          <button className="battle-command" type="button" onClick={downloadLog}>
            <Download size={15} aria-hidden /> Log
          </button>
          <Dialog.Root open={forfeitOpen} onOpenChange={setForfeitOpen}>
            <Dialog.Trigger className="forfeit-button">
              <Flag size={15} aria-hidden /> Forfeit
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
                  }}>Forfeit battle</button>
                  <Dialog.Close className="secondary-action">Cancel</Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </footer>
      </aside>
    </section>
  );
}
