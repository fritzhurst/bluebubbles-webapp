import type { Chat } from '@/types/bluebubbles';
import type { StoredContact } from '@/db/schema';
import { resolveContactName } from './contacts';

/**
 * Generate a temporary GUID for outgoing messages. The server echoes this
 * back on `new-message` so we can reconcile the optimistic insert.
 */
export function tempGuid(): string {
  return 'temp-' + crypto.randomUUID();
}

/**
 * A chat's display label.
 *
 * Preference order:
 *   1. The server-provided group name (`displayName`) if set
 *   2. Contact names for each participant, joined by commas
 *   3. Raw participant addresses, joined by commas
 *   4. Chat identifier or guid as a last resort
 *
 * Pass a `contactMap` to get names from macOS Contacts; omit it and you'll
 * get raw phone numbers/emails.
 */
export function chatDisplayName(
  chat: Chat,
  contactMap?: Map<string, StoredContact>,
): string {
  if (chat.displayName && chat.displayName.trim()) return chat.displayName;
  const participants = chat.participants ?? [];
  if (participants.length > 0) {
    const labels = participants.map((h) =>
      contactMap ? resolveContactName(h.address, contactMap) : h.address,
    );
    return labels.join(', ');
  }
  return chat.chatIdentifier ?? chat.guid;
}

/** A chat is a group iff it has more than one other participant. */
export function isGroupChat(chat: Chat): boolean {
  return (chat.participants?.length ?? 0) > 1;
}
