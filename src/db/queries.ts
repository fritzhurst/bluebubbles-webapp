// Read queries used by the UI. These return Promises; in React we wrap them
// with Dexie's `useLiveQuery` so the UI subscribes to changes automatically.

import { db } from './db';
import type { StoredChat, StoredMessage } from './schema';

/** Chat list, newest activity first. */
/** Chat list, newest activity first. Optionally filtered by time range. */
export async function listChats(limit = 200, minActivityTimeMs?: number): Promise<StoredChat[]> {
  let rows = await db.chats
    .orderBy('sortTimestamp')
    .reverse()
    .limit(limit)
    .toArray();

  if (minActivityTimeMs !== undefined) {
    rows = rows.filter((c) => (c.sortTimestamp ?? 0) >= minActivityTimeMs);
  }

  return rows.sort((a, b) => {
    const pinnedA = a.pinned ? 1 : 0;
    const pinnedB = b.pinned ? 1 : 0;
    if (pinnedA !== pinnedB) return pinnedB - pinnedA;
    return (b.sortTimestamp ?? 0) - (a.sortTimestamp ?? 0);
  });
}

/** Messages for a single chat, oldest-first (natural display order). */
export async function listMessages(chatGuid: string, limit = 200): Promise<StoredMessage[]> {
  // We use the compound index [chatGuid+dateCreatedMs] for fast ranged reads.
  const rows = await db.messages
    .where('[chatGuid+dateCreatedMs]')
    .between([chatGuid, 0], [chatGuid, Number.MAX_SAFE_INTEGER])
    .reverse() // DESC by time
    .limit(limit)
    .toArray();
  // Flip to ascending for display.
  return rows.reverse();
}

export async function getChat(guid: string): Promise<StoredChat | undefined> {
  return db.chats.get(guid);
}

export async function getAttachmentBlob(guid: string): Promise<Blob | undefined> {
  const row = await db.attachmentBlobs.get(guid);
  return row?.blob;
}

/** Used during incremental sync to learn "what's the newest we have for this chat?". */
export async function maxMessageTimestamp(chatGuid: string): Promise<number> {
  const row = await db.messages
    .where('[chatGuid+dateCreatedMs]')
    .between([chatGuid, 0], [chatGuid, Number.MAX_SAFE_INTEGER])
    .reverse()
    .first();
  return row?.dateCreatedMs ?? 0;
}
