import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * The shared "joining" experience: a live spinner while the room resolves,
 * honest copy when it is taking too long, and a way out. Every surface that
 * waits on a server room renders this instead of a bare text flash.
 */
export function JoiningState({ title, detail, connected, backTo, backLabel }: {
  title: string;
  detail?: string;
  connected: boolean;
  backTo: string;
  backLabel: string;
}) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="joining-state" aria-label={title} role="status" aria-live="polite">
      <span className="joining-spinner" aria-hidden />
      <h1>{connected ? title : 'Waiting for the server'}</h1>
      {detail && <p className="joining-detail">{detail}</p>}
      <p className="joining-hint">
        {!connected ? 'Reconnect to the battle server to continue.' :
          slow ? 'Still trying — the room may be full, private, or already gone.' :
          'This usually takes a moment.'}
      </p>
      {(slow || !connected) && (
        <Link to={backTo} className="secondary-action">{backLabel}</Link>
      )}
    </section>
  );
}
