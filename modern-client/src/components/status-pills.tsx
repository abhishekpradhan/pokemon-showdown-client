import { Circle, LoaderCircle, WifiOff } from 'lucide-react';
import type { ConnectionState } from '../compat/protocol-client';

export function ConnectionPill({ state }: { state: ConnectionState }) {
  const Icon = state === 'connected' ? Circle : state === 'reconnecting' ? LoaderCircle : WifiOff;
  return (
    <div className={`connection-pill is-${state}`}>
      <Icon size={12} aria-hidden />
      <span>{state}</span>
    </div>
  );
}
