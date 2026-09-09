/** Room failures outlive a failed join, but never accumulate across a long session. */
export function setRoomError(
  errors: Record<string, string>,
  roomId: string,
  message?: string,
): Record<string, string> {
  const entries = Object.entries(errors).filter(([id, error]) => id !== roomId && !!error);
  if (message) entries.push([roomId, message]);
  return Object.fromEntries(entries.slice(-32));
}
