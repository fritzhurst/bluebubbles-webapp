// Incremental sync: runs on every socket (re)connect, plus periodically.
// Fills the gap between "the newest thing we have in Dexie" and "now".
//
// We could drive this off socket events alone, but that's fragile — if the
// tab was asleep or the user's laptop was closed, we'd miss events. Pulling
// explicitly after reconnect makes the design robust.

import { queryMessages } from '@/api/messages';
import { db, upsertMessages, setSetting, SETTING_KEYS } from '@/db/db';
import { toStoredMessage } from './socketHandlers';
import { maxMessageTimestamp } from '@/db/queries';

/**
 * Pull any messages created after the most recent message we have stored,
 * across all chats. Caps at PAGE_LIMIT to avoid runaway requests.
 */
export async function runIncrementalSync(): Promise<number> {
  const all = await db.chats.toArray();
  let totalNew = 0;

  for (const chat of all) {
    const mostRecent = await maxMessageTimestamp(chat.guid);
    // Skip chats with no local messages — initial sync handles those.
    if (mostRecent === 0) continue;

    try {
      const newMessages = await queryMessages({
        chatGuid: chat.guid,
        after: mostRecent + 1, // server treats `after` as inclusive or exclusive
        limit: 50,
        sort: 'ASC',
      });
      if (newMessages.length > 0) {
        await upsertMessages(newMessages.map((m) => toStoredMessage(m, chat.guid)));
        totalNew += newMessages.length;
      }
    } catch (err) {
      console.warn('[incrementalSync] failed for', chat.guid, err);
    }
  }

  await setSetting(SETTING_KEYS.LAST_INCREMENTAL_SYNC, Date.now());
  return totalNew;
}
