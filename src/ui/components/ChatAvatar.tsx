// Avatar for a whole chat — delegates to ContactAvatar for a 1:1 chat, and
// overlaps two smaller avatars for group chats (iMessage-style bubbles).

import ContactAvatar from './ContactAvatar';
import type { StoredChat, StoredContact } from '@/db/schema';
import { findContact } from '@/utils/contacts';

interface Props {
  chat: StoredChat;
  contactMap: Map<string, StoredContact>;
  size?: number;
}

export default function ChatAvatar({ chat, contactMap, size = 40 }: Props) {
  const participants = chat.participants ?? [];

  if (participants.length <= 1) {
    const p = participants[0];
    // Use findContact (multi-key lookup) so we match even when the
    // chat's participant address is formatted differently than the
    // stored contact (e.g. +12108382045 vs +1 (210) 838-2045).
    const contact = p ? findContact(p.address, contactMap) : undefined;
    const fallback = initials(
      contact?.displayName ?? p?.address ?? chat.chatIdentifier ?? chat.guid,
    );
    return (
      <ContactAvatar
        contactId={contact?.contactId}
        fallbackText={fallback}
        size={size}
      />
    );
  }

  // Group chat — overlap the first two participants' avatars.
  const [first, second] = participants;
  const c1 = findContact(first.address, contactMap);
  const c2 = findContact(second.address, contactMap);
  const sub = Math.round(size * 0.7);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="absolute left-0 top-0">
        <ContactAvatar
          contactId={c1?.contactId}
          fallbackText={initials(c1?.displayName ?? first.address)}
          size={sub}
          ringColorClass="ring-slate-900"
        />
      </div>
      <div className="absolute right-0 bottom-0">
        <ContactAvatar
          contactId={c2?.contactId}
          fallbackText={initials(c2?.displayName ?? second.address)}
          size={sub}
          ringColorClass="ring-slate-900"
        />
      </div>
    </div>
  );
}

function initials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}
