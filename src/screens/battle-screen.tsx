import { useParams } from '@tanstack/react-router';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import {
  Download,
  Eye,
  Film,
  Crosshair,
  Flag,
  Info,
  ListTree,
  MessageSquare,
  PanelRightClose,
  RotateCcw,
  TimerReset,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { availableSwitches, buildMoveDeck, canPassBattleChoice, defensiveTypes, isBattleChoiceComplete, isReviving } from '../compat/battle-adapter';
import { BattleField } from '../components/battle-field';
import { JoiningState } from '../components/joining-state';
import { BattleTimerChip } from '../components/battle-timer';
import { ChatFeed } from '../components/chat-feed';
import { ChatComposer } from '../components/chat-composer';
import { createBattleHistory, flipBattleView, type BattleHistoryPoint } from '../battle/engine';
import { UserCard, type UserCardAnchor } from '../components/user-card';
import { MoveControls } from '../components/move-controls';
import { TeamBench } from '../components/team-bench';
import { useShallow } from 'zustand/react/shallow';
import { useArenaStore } from '../stores/arena-store';
import { useWorkspaceStore } from '../stores/workspace-store';

type InspectorTab = 'log' | 'chat' | 'info';

export function BattleScreen() {
  const params = useParams({ from: '/battle/$battleId' });
  const { replayStatus, rooms, saveReplay, username, connection, focusRoom, forfeitBattle, getBattleDecision, hardcoreMode, joinRoom, resetBattleChoiceSession, sendBattleChat, submitBattleChoice, submitBattleTarget, toggleBattleTimer, toggleHardcore, undoBattleChoice } = useArenaStore(
    useShallow(state => ({ replayStatus: state.replayStatuses[params.battleId], rooms: state.rooms, saveReplay: state.saveReplay, username: state.username, connection: state.connection, focusRoom: state.focusRoom, forfeitBattle: state.forfeitBattle, getBattleDecision: state.getBattleDecision, hardcoreMode: state.hardcoreMode, joinRoom: state.joinRoom, resetBattleChoiceSession: state.resetBattleChoiceSession, sendBattleChat: state.sendBattleChat, submitBattleChoice: state.submitBattleChoice, submitBattleTarget: state.submitBattleTarget, toggleBattleTimer: state.toggleBattleTimer, toggleHardcore: state.toggleHardcore, undoBattleChoice: state.undoBattleChoice }))
  );
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('log');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [userCard, setUserCard] = useState<UserCardAnchor | null>(null);
  const { soundEnabled, reducedMotion, setSoundEnabled } = useWorkspaceStore(
    useShallow(state => ({ soundEnabled: state.soundEnabled, reducedMotion: state.reducedMotion, setSoundEnabled: state.setSoundEnabled }))
  );
  const demoFixturesEnabled = import.meta.env.MODE === 'test' || import.meta.env.VITE_ENABLE_DEMO_FIXTURES === 'true';
  const room = rooms[params.battleId];
  const battleRoom = room?.type === 'battle' ? room : null;
  const battle = battleRoom?.battle ?? null;
  const historyRef = useRef<{ id: string; timeline: ReturnType<typeof createBattleHistory> } | null>(null);
  const [history, setHistory] = useState<readonly BattleHistoryPoint[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [flipped, setFlipped] = useState(false);
  const [narration, setNarration] = useState<readonly BattleHistoryPoint[]>([]);
  const narratedThrough = useRef(-1);
  const rawLog = battleRoom?.rawLog;
  const engine = battleRoom?.engine;
  useEffect(() => {
    if (!rawLog || !engine) return;
    if (historyRef.current?.id !== params.battleId || !historyRef.current.timeline) {
      historyRef.current = { id: params.battleId, timeline: createBattleHistory(params.battleId, username) };
      setHistoryCursor(null);
      setPlaying(false);
      narratedThrough.current = -1;
    }
    const points = historyRef.current.timeline?.synchronize(rawLog);
    if (points) {
      setHistory([...points]);
      const fresh = points.filter(point => point.line > narratedThrough.current);
      if (fresh.length) {
        const latest = fresh[fresh.length - 1];
        if (narratedThrough.current < 0 || reducedMotion) setNarration([latest]);
        else setNarration(current => [...current, ...fresh].slice(-40));
        narratedThrough.current = latest.line;
      }
    }
  }, [rawLog, engine, params.battleId, username, reducedMotion]);
  useEffect(() => {
    if (narration.length < 2) return;
    const timer = window.setTimeout(() => setNarration(current => current.slice(1)), reducedMotion ? 0 : 1200 / speed);
    return () => window.clearTimeout(timer);
  }, [narration, speed, reducedMotion]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const next = (historyCursor ?? -1) + 1;
      if (next >= history.length) { setPlaying(false); return null; }
      setHistoryCursor(next);
    }, 900 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, speed, history.length, historyCursor]);

  const battleRoomId = battleRoom?.id;
  useEffect(() => {
    if (battleRoomId) {
      focusRoom(battleRoomId);
      return () => { if (useArenaStore.getState().activeRoomId === battleRoomId) focusRoom(undefined); };
    }
    if (params.battleId.startsWith('battle-') && connection === 'connected') joinRoom(params.battleId);
  }, [battleRoomId, connection, focusRoom, joinRoom, params.battleId]);

  if (!battle || (params.battleId === 'demo-gen9ou' && !demoFixturesEnabled)) {
    // The stage frame renders immediately; only the field itself waits.
    return (
      <section className="battle-layout battle-console" aria-label={`Battle ${params.battleId}`}>
        <div className="battle-stage">
          <header className="battle-toolbar">
            <div className="battle-room-title">
              <span className="battle-state-dot" data-state="waiting" />
              <span>
                <strong>Joining battle</strong>
                <small>{params.battleId}</small>
              </span>
            </div>
          </header>
          <JoiningState
            title="Joining battle"
            detail={params.battleId}
            connected={connection === 'connected'}
            backTo="/"
            backLabel="Return to matchmaking"
          />
        </div>
        <aside className="battle-side" aria-label="Battle inspector" />
      </section>
    );
  }

  const decision = getBattleDecision(battle.id);
  const historyPoint = historyCursor !== null ? history[Math.min(historyCursor, history.length - 1)] : undefined;
  const fieldBattle = historyPoint?.battle || battle;
  const viewBattle = flipped ? flipBattleView(fieldBattle) : fieldBattle;
  const pendingTarget = decision.draft.pendingMove;

  // Doubles: the session collects one choice per active slot; the deck and
  // the title track the slot currently being decided. (While a move waits on
  // its target the cursor still points at the mover.)
  const session = battleRoom?.choiceSession;
  const activeCount = battleRoom?.lastRequest?.active?.length || (Array.isArray(battleRoom?.lastRequest?.forceSwitch) ? battleRoom.lastRequest.forceSwitch.length : 1);
  const choiceCursor = Math.min(decision.draft.choices.length, Math.max(0, activeCount - 1));
  const deck = battleRoom?.lastRequest ?
    buildMoveDeck(
      battleRoom.lastRequest,
      defensiveTypes(battle.opponentActive),
      `gen${battle.generation || 9}`,
      choiceCursor,
      battle.opponentActive,
      battle.actives?.find(pokemon => pokemon.slot === choiceCursor + 1) || battle.active,
      battle.weather,
    ) :
    battle.moves;
  const activeDeck = deck.map(move => ({ ...move, canMegaEvo: move.canMegaEvo && !session?.alreadyMega,
    canDynamax: move.canDynamax && !session?.alreadyMax, canZMove: move.canZMove && !session?.alreadyZ,
    canTerastallize: move.canTerastallize && !session?.alreadyTera }));
  const cursorName = battle.actives?.find(pokemon => pokemon.slot === choiceCursor + 1)?.name ?? battle.active.name;

  const pendingBase = pendingTarget ? activeDeck.find(move => move.slot === pendingTarget.slot) : undefined;
  const pendingMoveCard = pendingTarget?.z ? pendingBase?.zMove : pendingTarget?.max ? pendingBase?.maxMove : pendingBase;
  const targetOptions = pendingTarget ? pendingMoveCard?.targetOptions || [] : [];
  /** Resolves a protocol target slot (+foe / −ally) to the Pokémon standing there. */
  const describeTarget = (target: number) => {
    const foe = target > 0;
    const pool = foe ?
      (battle.opponentActives?.length ? battle.opponentActives : [battle.opponentActive]) :
      (battle.actives?.length ? battle.actives : [battle.active]);
    const pokemon = pool.find(entry => entry.slot === Math.abs(target));
    const self = !foe && Math.abs(target) - 1 === (pendingTarget?.activeIndex ?? choiceCursor);
    const targetBase = pokemon && battleRoom?.lastRequest ? buildMoveDeck(battleRoom.lastRequest, defensiveTypes(pokemon),
      `gen${battle.generation || 9}`, choiceCursor, pokemon, battle.actives?.find(entry => entry.slot === choiceCursor + 1) || battle.active, battle.weather)
      .find(move => move.slot === pendingTarget?.slot) : undefined;
    const targetMove = pendingTarget?.z ? targetBase?.zMove : pendingTarget?.max ? targetBase?.maxMove : targetBase;
    return {
      foe,
      name: pokemon?.name,
      effectiveness: targetMove?.effectiveness,
      // Empty or fainted slots are not legal targets; your own slot only is
      // for adjacentAllyOrSelf moves.
      disabled: !pokemon || pokemon.fainted || pokemon.hp <= 0 ||
        (self && pendingMoveCard?.target !== 'adjacentAllyOrSelf'),
    };
  };
  const playerControls = decision.mode === 'player' && decision.requestType !== 'wait' && !battle.waiting && !battle.ended &&
    !battle.supportReason && !battle.engineWarning && connection === 'connected' && !!battleRoom?.connected && session?.status !== 'submitted' && session?.status !== 'cancelling';
  const previewSelection = decision.draft.choices.map(choice => /^team (\d+)$/.exec(choice)?.[1]).filter(Boolean).map(Number);
  const revival = session ? isReviving(session) : false;
  const decisionTitle = battle.ended ?
    battle.winner ? `${battle.winner} won the battle` : 'Battle ended in a tie' :
    session?.status === 'cancelling' ? 'Waiting for cancellation' :
    battle.waiting ? 'Waiting for opponent' :
    revival ? 'Choose a Pokémon to revive' :
    battle.requestType === 'team' ? `Choose your team · ${previewSelection.length}/${decision.requestLength}` :
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
            {decision.mode === 'spectator' && (
              <span className="spectate-chip"><Eye size={12} aria-hidden /> Spectating</span>
            )}
            {battleRoom && <BattleTimerChip timer={battleRoom.timer} running={!battle.waiting && decision.mode === 'player'} ended={battle.ended} />}
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="icon-button"
              aria-label={soundEnabled ? 'Mute battle sounds' : 'Unmute battle sounds'}
              aria-pressed={soundEnabled}
              title={soundEnabled ? 'Battle sounds on — cries and turn pings' : 'Battle sounds muted'}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button type="button" className="icon-button mobile-inspector-button" aria-label="Open battle log" onClick={() => openInspector('log')}>
              <ListTree size={17} />
            </button>
            <button type="button" className="icon-button mobile-inspector-button" aria-label="Open battle chat" onClick={() => openInspector('chat')}>
              <MessageSquare size={17} />
            </button>
            {decision.mode === 'player' && !battle.ended && (
              <>
                <button type="button" className="icon-button" aria-label="Undo choice" disabled={decision.noCancel || session?.status === 'cancelling' || (!battle.waiting && !decision.draft.choices.length && !pendingTarget)} onClick={() => undoBattleChoice(battle.id)}>
                  <RotateCcw size={17} />
                </button>
                <button type="button" className="icon-button" aria-label="Reset choice draft" disabled={battle.waiting || !decision.draft.choices.length && !pendingTarget} onClick={() => resetBattleChoiceSession(battle.id)}>
                  <X size={17} />
                </button>
              </>
            )}
          </div>
        </header>

        {(decision.mode === 'spectator' || battle.ended) && history.length > 0 && !battle.logTruncated && <div className="battle-playback" aria-label="Battle playback">
          <button type="button" onClick={() => { if (historyCursor === null) setHistoryCursor(0); setPlaying(!playing); }}>{playing ? 'Pause' : 'Play history'}</button>
          <button type="button" aria-label="Previous turn" onClick={() => {
            const current = historyPoint?.turn ?? battle.turn;
            const index = history.map(point => point.turn < current).lastIndexOf(true);
            setPlaying(false); setHistoryCursor(Math.max(0, index));
          }}>Previous turn</button>
          <button type="button" aria-label="Next turn" onClick={() => {
            const current = historyPoint?.turn ?? battle.turn;
            const index = history.findIndex(point => point.turn > current);
            setPlaying(false); setHistoryCursor(index < 0 ? null : index);
          }}>Next turn</button>
          <input type="range" aria-label="Battle history position" min={0} max={Math.max(0, history.length - 1)} value={historyCursor ?? history.length - 1} onChange={event => { setPlaying(false); setHistoryCursor(Number(event.currentTarget.value)); }} />
          <label>Speed <select aria-label="Playback speed" value={speed} onChange={event => setSpeed(Number(event.currentTarget.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
          <button type="button" onClick={() => { setPlaying(false); setHistoryCursor(null); }}>{battle.ended ? 'Latest' : 'Live'}</button>
          <button type="button" aria-pressed={flipped} onClick={() => setFlipped(!flipped)}>Switch viewpoint</button>
          <span role="status">{historyPoint ? `Turn ${historyPoint.turn}` : battle.ended ? 'Final position' : 'Live position'}</span>
        </div>}
        {!historyPoint && narration.length > 1 && <div className="battle-playback" aria-label="Battle narration">
          <span>{narration.length - 1} actions queued</span>
          <select aria-label="Narration speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
          </select>
          <button type="button" onClick={() => setNarration(current => current.slice(-1))}>Skip to latest action</button>
        </div>}
        <BattleField battle={viewBattle} hardcore={hardcoreMode} lastEvent={historyPoint ? { kind: 'note', side: 'near', at: historyPoint.line, label: historyPoint.label } : narration.length ? { ...(battleRoom?.lastEvent || { kind: 'note', side: 'near' }), at: narration[0].line, label: narration[0].label, side: flipped ? battleRoom?.lastEvent?.side === 'near' ? 'far' : 'near' : battleRoom?.lastEvent?.side || 'near' } : battleRoom?.lastEvent} />

        <div className="decision-dock" aria-label="Battle action deck">
          <div className="decision-heading">
            <div>
              <span className="eyebrow">Action deck · Turn {battle.turn}</span>
              <h2>{decisionTitle}</h2>
              {battle.requestType === 'team' && <p className="decision-note">Select Pokémon in order, then confirm. Select again to remove one.</p>}
              {battle.requestType === 'switch' && <p className="decision-note">A replacement is required.</p>}
              {battle.trapped && <p className="decision-note">Your active Pokémon is trapped.</p>}
              {decision.error && <p className="decision-error" role="alert">{decision.error}</p>}
              {battle.supportReason && <p className="decision-error" role="alert">{battle.supportReason} <a href={`https://play.pokemonshowdown.com/${battle.id}`} target="_blank" rel="noopener noreferrer">Open original client</a></p>}
              {battle.engineWarning && <p className="decision-error" role="alert">{battle.engineWarning} <button type="button" onClick={() => joinRoom(battle.id)}>Synchronize battle</button></p>}
              {battle.logTruncated && <p className="decision-note">This very long session retains the latest 50,000 events. The server replay remains the complete record.</p>}
              {connection !== 'connected' && <p className="decision-note" role="status">Disconnected. Your draft is preserved; reconnect before submitting.</p>}
            </div>
            <span className={`decision-mode is-${decision.mode}`}>{decision.mode}</span>
          </div>

          {pendingTarget && playerControls && (
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
                      <small>{described.foe ? 'Opponent' : 'Your side'}{described.effectiveness ? ` · ${described.effectiveness}` : ''}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="decision-controls">
            <div className="move-deck">
              {playerControls && battle.requestType !== 'switch' && battle.requestType !== 'team' && !pendingTarget ? (
                <MoveControls key={`${battle.id}-${battle.rqid}-${choiceCursor}`} moves={activeDeck} format={`gen${battle.generation || 9}`} onChoose={choice => submitBattleChoice(choice, battle.id)} />
              ) : !pendingTarget && (
                <div className="waiting-state" role="status" aria-live="polite">
                  <span className="waiting-pulse" />
                  <span>{battle.ended ? 'This session is complete.' : battle.waiting ? 'Your choice has been submitted.' : battle.requestType === 'team' ? 'Choose and review your team below.' : revival ? 'Select a fainted teammate below.' : battle.requestType === 'switch' ? `Choose a replacement for position ${choiceCursor + 1}.` : 'Battle controls are read-only.'}</span>
                </div>
              )}
            </div>
            {battle.team.length > 0 && (
              <div className="bench-deck">
                <span className="deck-label">
                  {decision.mode === 'player' ? 'Your team' : `${battle.playerSide === 'p2' ? battle.p2.name : battle.p1.name}’s team`}
                </span>
                <TeamBench team={battle.team} format={`gen${battle.generation || 9}`} preview={battle.requestType === 'team'} selection={previewSelection}
                  allowedSlots={battle.requestType === 'team' ? undefined : session ? session.request.active?.[choiceCursor]?.trapped ? [] : availableSwitches(session) : []}
                  onOrderChange={playerControls ? order => submitBattleChoice({ kind: 'team', order }, battle.id) : undefined}
                  onSwitch={playerControls && !pendingTarget ? choice => submitBattleChoice(choice, battle.id) : undefined} />
                {battle.requestType === 'team' && <button type="button" className="primary-action" disabled={!playerControls || !session || !isBattleChoiceComplete(session)} onClick={() => submitBattleChoice({ kind: 'confirm' }, battle.id)}>Confirm team order</button>}
                {playerControls && session && canPassBattleChoice(session) && <button type="button" className="secondary-action" onClick={() => submitBattleChoice({ kind: 'pass' }, battle.id)}>Keep position {choiceCursor + 1} empty</button>}
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
                <ChatFeed
                  key={battle.id}
                  announce={connection === 'connected'}
                  label="Battle chat history"
                  messages={battleRoom?.chat ?? []}
                  selfName={username}
                  onCommand={command => sendBattleChat(command, battle.id)}
                  onUserClick={(name, at) => setUserCard({ name, ...at })}
                />
              </div>
              <ChatComposer key={battle.id} roomId={battle.id} title="battle" users={battleRoom?.users} send={message => sendBattleChat(message, battle.id)} disabled={connection !== 'connected'} />
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
                  <small>Hide exact numbers and type intel; the HP gauge stays.</small>
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
          ) : decision.mode === 'player' ? (
            <button className="battle-command" type="button" onClick={() => toggleBattleTimer(battle.id)}>
              <TimerReset size={15} aria-hidden /> Timer {battle.timerOn ? 'on' : 'off'}
            </button>
          ) : null}
          <button className="battle-command" type="button" onClick={downloadLog}>
            <Download size={15} aria-hidden /> Log
          </button>
          {decision.mode === 'player' && !battle.ended && <Dialog.Root open={forfeitOpen} onOpenChange={setForfeitOpen}>
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
          </Dialog.Root>}
        </footer>
      </aside>
      {userCard && <UserCard anchor={userCard} onClose={() => setUserCard(null)} />}
    </section>
  );
}
