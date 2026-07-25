import { Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BattleTimer as BattleTimerState } from '../rooms/types';

/**
 * Countdown chip fed by |inactive| messages. The server only speaks when the
 * clock changes, so the display ticks locally from the last known value.
 */
export function BattleTimerChip({ timer }: { timer: BattleTimerState }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer.on || timer.secondsLeft === undefined) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timer.on, timer.secondsLeft, timer.asOf]);

  if (!timer.on || timer.secondsLeft === undefined || !timer.asOf) return null;

  const elapsed = Math.floor((now - timer.asOf) / 1000);
  const remaining = Math.max(0, timer.secondsLeft - elapsed);
  const urgent = remaining <= 30;

  return (
    <span className="battle-timer-chip" data-urgent={urgent} role="timer" aria-label={`${remaining} seconds to choose`}>
      <Timer size={13} aria-hidden />
      {remaining}s
    </span>
  );
}
