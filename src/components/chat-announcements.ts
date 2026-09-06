import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../rooms/types';
import { toId } from '../compat/protocol-parsers';
import { useWorkspaceStore } from '../stores/workspace-store';

// Redact before truncating so a spoiler crossing the announcement length limit
// cannot expose its opening fragment. The transcript offers a reveal button.
const spokenText = (message: ChatMessage) => `${message.user.replace(/^[^a-z0-9]/i, '')}: ${message.message.replace(/\|\|[^|\n]+\|\|/g, '[spoiler]').slice(0, 300)}`;

/** Announce additions independently from the browsable transcript. A snapshot
 * replacement has no shared tail and must not replay retained history. */
export function useChatAnnouncements(messages: ChatMessage[], enabled: boolean, selfName?: string) {
  const region = useRef<HTMLDivElement>(null);
  const previous = useRef({ last: messages.at(-1), enabled });
  const mountedAt = useRef(0);
  const queued = useRef<ChatMessage[]>([]);
  const pendingCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!mountedAt.current) mountedAt.current = Date.now();
    const prior = previous.current;
    previous.current = { last: messages.at(-1), enabled };
    const index = prior.last ? messages.lastIndexOf(prior.last) : -1;
    if (!enabled || !prior.enabled || (prior.last && index < 0)) {
      clearTimeout(timer.current); timer.current = undefined; queued.current = []; pendingCount.current = 0;
      if (region.current) region.current.textContent = '';
      return;
    }
    const ignored = useWorkspaceStore.getState().ignoredUsers;
    const additions = messages.slice(index + 1).filter(message =>
      (!message.kind || ['chat', 'pm', 'me', 'announce'].includes(message.kind)) &&
      !ignored.includes(toId(message.user)) && (!selfName || toId(message.user) !== toId(selfName)) &&
      // Timestamped backlog can arrive over multiple frames after an empty init.
      (!message.timestamp || message.timestamp >= mountedAt.current - 1000)
    );
    if (!additions.length || document.hidden) return;
    pendingCount.current += additions.length;
    queued.current = [...queued.current, ...additions].slice(-3);
    if (timer.current !== undefined) return;
    // Coalesce a frame burst rather than queue hundreds of separate utterances.
    timer.current = setTimeout(() => {
      const count = pendingCount.current;
      const recent = queued.current;
      const message = count > 3 ? `${count} new chat messages. Latest: ${spokenText(recent[recent.length - 1])}` : recent.map(spokenText).join('\n');
      if (region.current && !document.hidden) region.current.replaceChildren(document.createTextNode(message));
      timer.current = undefined; queued.current = []; pendingCount.current = 0;
    }, 180);
  }, [messages, enabled, selfName]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return region;
}
