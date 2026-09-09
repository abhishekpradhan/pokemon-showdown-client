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
    },
    null,
    2,
  );
}
