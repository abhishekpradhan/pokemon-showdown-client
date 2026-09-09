/** Shared diagnostics omit message bodies, identity assertions, requests and teams at capture time. */
export function sanitizeProtocolLog(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map(line => {
      if (line.startsWith('>')) return '>[room]';
      const command = line.match(/^\|([^|]*)\|/)?.[1];
      if (
        command &&
        [
          'challstr',
          'pm',
          'c',
          'c:',
          'chat',
          'raw',
          'html',
          'uhtml',
          'uhtmlchange',
          'request',
          'popup',
          'queryresponse',
          'updateuser',
          'updatechallenges',
          'users',
          'player',
          'j',
          'J',
          'l',
          'L',
          'n',
          'N',
        ].includes(command)
      )
        return `|${command}|[private payload omitted]`;
      if (/\/(?:utm|trn|pm|msg|challenge|accept|reject|savereplay|avatar)\b/i.test(line))
        return '[private command omitted]';
      // Unknown extension messages can carry tokens or arbitrary user data. Retain only their command name.
      if (command) return `|${command}|[payload omitted]`;
      return line ? '[payload omitted]' : '';
    })
    .join('\n');
}

export type ClientErrorRecord = {
  at: string;
  /** Which layer failed: `router` (a protocol line), `protocol-client` (a subscriber). */
  source: string;
  message: string;
  /** The offending input, sanitized the same way as the protocol log. */
  context?: string;
};

const CLIENT_ERROR_LIMIT = 32;
const clientErrorLog: ClientErrorRecord[] = [];

/**
 * Bounded record of client-side failures that were contained rather than
 * thrown. It ships with the diagnostic report so a swallowed error is still
 * visible to whoever debugs a session; nothing here goes to the console.
 */
export function recordClientError(source: string, error: unknown, context?: string): ClientErrorRecord {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const record: ClientErrorRecord = {
    at: new Date().toISOString(),
    source,
    message: message.slice(0, 200),
    context: context === undefined ? undefined : sanitizeProtocolLog(context.slice(0, 2_000)).slice(0, 240),
  };
  clientErrorLog.push(record);
  if (clientErrorLog.length > CLIENT_ERROR_LIMIT)
    clientErrorLog.splice(0, clientErrorLog.length - CLIENT_ERROR_LIMIT);
  return record;
}

export function clientErrors(): ClientErrorRecord[] {
  return [...clientErrorLog];
}

export function resetClientErrors() {
  clientErrorLog.length = 0;
}

export function diagnosticReport(frames: string[], context: { connection: string; server: string }): string {
  return JSON.stringify(
    {
      application: 'Showdown Arena',
      capturedAt: new Date().toISOString(),
      connection: context.connection,
      server: context.server,
      browser: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      frames: frames.map(sanitizeProtocolLog),
      errors: clientErrors(),
    },
    null,
    2,
  );
}
