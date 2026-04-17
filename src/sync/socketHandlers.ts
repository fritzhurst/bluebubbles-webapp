// Route BB socket events into Dexie upserts.
//
// Socket payloads from BlueBubbles mirror the REST models — a `new-message`
// event is a Message object with a `chats` array. We use the same mapper
// functions we use for REST so there's exactly one place that knows how
// the server's payload shape maps to our DB row shape.

import { SocketEvents } from '@/api/endpoints';
import { db, upsertChat, upsertMessage } from '@/db/db';
import type { StoredChat } from '@/db/schema';
import { getChat } from '@/db/queries';
import type { Chat, Message } from '@/types/bluebubbles';
import { toJsEpochMs } from '@/utils/time';

/** Convert a server Message into the shape we store in Dexie. */
export function toStoredMessage(m: Message, chatGuid: string) {
  return {
    ...m,
    guid: m.guid,
    chatGuid,
    dateCreatedMs: toJsEpochMs(m.dateCreated),
  };
}

/**
 * Convert a server Chat into the shape we store in Dexie (sync-only version,
 * no existing-state merge). Use `mergeServerChat` when you care about
 * preserving local read state across re-sync.
 */
export function toStoredChat(c: Chat): StoredChat {
  const lastTs = toJsEpochMs(c.lastMessage?.dateCreated ?? c.lastMessageTimestamp ?? 0);
  return {
    ...c,
    guid: c.guid,
    sortTimestamp: lastTs,
    lastSyncedAt: Date.now(),
    hasUnread: !!(c.lastMessage && !c.lastMessage.isFromMe && !c.lastMessage.dateRead),
  };
}

/**
 * Merge a server Chat with whatever we have locally. Preserves the local
 * `hasUnread` flag when the server's last-message GUID hasn't changed —
 * otherwise a refresh resets the unread indicator on chats the user has
 * already read (we can't push read-state back to the server without the
 * Private API helper, so the server keeps reporting them as unread).
 */
export async function mergeServerChat(c: Chat): Promise<StoredChat> {
  const fresh = toStoredChat(c);
  const existing = await db.chats.get(c.guid);
  if (!existing) return fresh;

  const lastMessageUnchanged =
    !!existing.lastMessage?.guid &&
    existing.lastMessage.guid === c.lastMessage?.guid;

  return {
    ...fresh,
    // If nothing new arrived, keep the local read flag. If a brand-new
    // message arrived, honor the fresh calculation (which will flag unread
    // iff the newest is an incoming, as before).
    hasUnread: lastMessageUnchanged ? existing.hasUnread : fresh.hasUnread,
  };
}

/** Batch-merge for initial sync. Reads all existing chats in one shot. */
export async function mergeServerChats(chats: Chat[]): Promise<StoredChat[]> {
  const guids = chats.map((c) => c.guid);
  const existingRows = await db.chats.bulkGet(guids);
  const existingByGuid = new Map<string, StoredChat | undefined>();
  guids.forEach((g, i) => existingByGuid.set(g, existingRows[i] ?? undefined));

  return chats.map((c) => {
    const fresh = toStoredChat(c);
    const existing = existingByGuid.get(c.guid);
    if (!existing) return fresh;
    const lastMessageUnchanged =
      !!existing.lastMessage?.guid &&
      existing.lastMessage.guid === c.lastMessage?.guid;
    return {
      ...fresh,
      hasUnread: lastMessageUnchanged ? existing.hasUnread : fresh.hasUnread,
    };
  });
}

/**
 * Apply a single socket event by upserting into the database.
 * The UI updates through Dexie's liveQuery subscriptions — we don't
 * need to do anything else here.
 */
export async function applySocketEvent(name: string, payload: unknown): Promise<void> {
  try {
    switch (name) {
      case SocketEvents.newMessage:
      case SocketEvents.updatedMessage: {
        const msg = payload as Message;
        if (!msg || !msg.guid) return;
        const chatGuid = msg.chats?.[0]?.guid;
        if (!chatGuid) return;

        await upsertMessage(toStoredMessage(msg, chatGuid));

        // Bump the chat's sort timestamp and unread flag.
        const existing = await getChat(chatGuid);
        if (existing) {
          await upsertChat({
            ...existing,
            sortTimestamp: Math.max(existing.sortTimestamp, toJsEpochMs(msg.dateCreated)),
            hasUnread: !msg.isFromMe && !msg.dateRead,
            lastMessage: msg,
          });
        } else {
          // Unknown chat — insert a stub; initial sync will fill it in.
          await upsertChat({
            guid: chatGuid,
            sortTimestamp: toJsEpochMs(msg.dateCreated),
            lastSyncedAt: Date.now(),
            hasUnread: !msg.isFromMe,
            lastMessage: msg,
          });
        }
        break;
      }

      case SocketEvents.chatReadStatusChanged: {
        const { chatGuid, read } = (payload as { chatGuid?: string; read?: boolean }) ?? {};
        if (!chatGuid) return;
        const existing = await getChat(chatGuid);
        if (existing) {
          await upsertChat({ ...existing, hasUnread: !read });
        }
        break;
      }

      case SocketEvents.groupNameChange: {
        const { chatGuid, newName } = (payload as { chatGuid?: string; newName?: string }) ?? {};
        if (!chatGuid) return;
        const existing = await getChat(chatGuid);
        if (existing) {
          await upsertChat({ ...existing, displayName: newName ?? existing.displayName });
        }
        break;
      }

      // Typing indicators are ephemeral; we could keep them in Zustand state,
      // but we skip persisting them for now.
      case SocketEvents.typingIndicator:
      case SocketEvents.participantAdded:
      case SocketEvents.participantRemoved:
      case SocketEvents.messageSendError:
      default:
        return;
    }
  } catch (err) {
    console.error('[socketHandlers] failed to apply event', name, err);
  }
}
