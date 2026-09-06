import { isBattleSideID, type BattleSideID } from './battle-adapter';
import { toId } from './protocol-parsers';

/** Official /challenge format|teambuilderFormat|message|acceptLabel|rejectLabel. */
export type ChallengeDetails = {
  format: string;
  /** Empty means a team is already supplied; undefined is the legacy protocol. */
  teambuilderFormat?: string;
  message: string;
  acceptLabel: string;
  rejectLabel: string;
};

export function parseChallengeDetails(message: string): ChallengeDetails | null {
  if (message.length > 4096 || !/^\/challenge(?: |$)/.test(message)) return null;
  const parts = message.slice('/challenge'.length).trim().split('|');
  if (!parts[0] || parts[0].length > 120 || (parts[1]?.length || 0) > 120) return null;
  return { format: parts[0], teambuilderFormat: parts.length > 1 ? parts[1] : undefined,
    message: (parts[2] || '').slice(0, 1000), acceptLabel: (parts[3] || 'Accept').slice(0, 120), rejectLabel: (parts[4] || 'Reject').slice(0, 120) };
}

export type BattleInvitationSlot = { slot: BattleSideID; name?: string; invited?: string; canInvite: boolean };

/** Read only the official seat form schema; never execute server-supplied commands. */
export function parseBattleInvitations(html: string, roomId: string): BattleInvitationSlot[] | undefined {
  if (html.length > 65_536 || !/^battle-[a-z0-9-]+$/.test(roomId)) return;
  // Template content stays inert: even unrelated images/iframes must not
  // initiate requests. This fragment is never attached to the live document.
  const template = document.createElement('template');
  template.innerHTML = html;
  const slots: BattleInvitationSlot[] = [];
  for (const form of template.content.querySelectorAll('form')) {
    const match = /^Player ([1-4]):/.exec(form.textContent?.trim() || '');
    const slot = match && `p${match[1]}`;
    if (!isBattleSideID(slot) || slots.some(entry => entry.slot === slot)) continue;
    const command = form.getAttribute('data-submitsend');
    const name = form.querySelector('strong')?.textContent?.trim();
    if (!command && name) slots.push({ slot, name, canInvite: false });
    else if (command === `/msgroom ${roomId},/invitebattle {username}, ${slot}`) slots.push({ slot, canInvite: true });
    else {
      const prefix = `/msgroom ${roomId},/uninvitebattle `;
      const invited = command?.startsWith(prefix) ? command.slice(prefix.length) : '';
      if (invited && invited === toId(invited)) slots.push({ slot, invited, canInvite: false });
    }
  }
  return slots.length ? slots : undefined;
}
