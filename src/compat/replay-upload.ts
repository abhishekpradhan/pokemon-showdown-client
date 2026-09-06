const replayOrigin = () => (import.meta.env.VITE_PS_REPLAY_SERVER || 'https://replay.pokemonshowdown.com').replace(/\/$/, '');

/** Preserve the authoritative identifier, including custom-server prefixes and private passwords. */
export function replayUploadUrl(response: string, fallbackId?: string): string | undefined {
  const encoded = response.match(/https?:\/\/[^\s<>"'|]+/)?.[0]?.replace(/&amp;/g, '&').replace(/[).,]+$/, '');
  if (encoded) {
    try {
      const url = new URL(encoded);
      if (url.origin === new URL(replayOrigin()).origin && /^\/[a-z0-9-]+$/i.test(url.pathname)) return url.href;
    } catch { return undefined; }
  }
  const success = response.trim().match(/^success(?::([a-z0-9-]+))?$/i);
  const id = success?.[1] || (success && fallbackId);
  return id && /^[a-z0-9-]{1,500}$/i.test(id) ? `${replayOrigin()}/${id}` : undefined;
}
