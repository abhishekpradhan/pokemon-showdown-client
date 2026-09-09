type ProxyOptions = {
  upstream: string;
  requestLimit: number;
  responseLimit: number;
  timeout: number;
  label: string;
  validate: (form: URLSearchParams) => string | null;
};

class BodyLimitError extends Error {}

const reply = (body: string | null, status: number, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });

/** Count network bytes before decoding; cancel immediately when the limit is exceeded. */
export async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal,
): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason || new DOMException('Timed out', 'TimeoutError'));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parts: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new BodyLimitError('Body too large');
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join('');
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

export async function proxyForm(request: Request, options: ProxyOptions): Promise<Response> {
  const origin = request.headers.get('origin');
  // CLI clients may omit Origin. Browser cross-site and opaque origins are
  // rejected; absent CORS headers alone would not stop form submissions.
  if (
    (origin !== null && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    return reply('Cross-origin requests are not supported.', 403);
  }
  if (request.method === 'OPTIONS') return reply(null, 204, { Allow: 'POST, OPTIONS' });
  if (request.method !== 'POST') return reply('Only POST is supported.', 405, { Allow: 'POST, OPTIONS' });
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/x-www-form-urlencoded'
  ) {
    return reply('Use application/x-www-form-urlencoded.', 415);
  }
  const declaredLength = request.headers.get('content-length');
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > options.requestLimit)
  ) {
    return reply('Request body too large.', 413);
  }
  let body: string;
  try {
    body = await readBoundedBody(request.body, options.requestLimit, AbortSignal.timeout(10_000));
  } catch (error) {
    if (error instanceof BodyLimitError) return reply('Request body too large.', 413);
    if (error instanceof Error && error.name === 'TimeoutError') return reply('Request body timed out.', 408);
    return reply('Invalid request body.', 400);
  }
  const form = new URLSearchParams(body);
  const invalid = options.validate(form);
  if (invalid) return reply(invalid, 400);
  let stage = 'upstream-fetch';
  try {
    const upstreamUrl = new URL(options.upstream);
    if (!['https:', 'http:'].includes(upstreamUrl.protocol) || upstreamUrl.username || upstreamUrl.password) {
      return reply('Invalid upstream configuration.', 503);
    }
    const signal = AbortSignal.timeout(options.timeout);
    const upstream = await fetch(upstreamUrl.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Showdown-Arena/1.1 (https://github.com/abhishekpradhan/pokemon-showdown-client)',
      },
      body: form.toString(),
      signal,
      // The hosted Edge fetch implementation throws for redirect: 'error'
      // even on a non-redirect response. Manual mode plus the status guard
      // below preserves the no-forwarding boundary on that runtime.
      redirect: 'manual',
    });
    stage = 'upstream-response';
    if (upstream.status >= 300 && upstream.status < 400) {
      stage = 'upstream-redirect';
      void upstream.body?.cancel().catch(() => {});
      throw new Error('Upstream redirects are not supported');
    }
    const text = await readBoundedBody(upstream.body, options.responseLimit, signal);
    return reply([204, 205].includes(upstream.status) ? null : text, upstream.status);
  } catch (error) {
    const kind =
      error instanceof Error &&
      ['Error', 'TypeError', 'RangeError', 'TimeoutError', 'AbortError', 'BodyLimitError'].includes(
        error.name,
      )
        ? error.name
        : 'UnknownError';
    // Error messages, causes, URLs and request/response contents can contain
    // credentials. Record only fixed categories useful for runtime diagnosis.
    console.error('Upstream request failed', { service: options.label, stage, kind });
    return reply(`The ${options.label} server did not respond successfully.`, 502);
  }
}
