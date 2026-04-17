// Initial sync: pull everything the user needs to see a full chat list and
// recent messages in each chat. Runs on first login, and again if the user
// explicitly requests a "full refresh".
//
// Strategy:
//   1. Page through chats until the server returns fewer than `limit`.
//   2. For each chat, pull the most recent N messages.
//   3. Pull handles in one shot so the address book is fresh.
//   4. Pull macOS contacts and flatten into address→name rows.
//
// We deliberately do NOT deep-paginate old messages. BB chats can have tens
// of thousands of messages. The app pulls older history on demand when the
// user scrolls up (see `loadMoreMessages`).

import { queryChats, getChatMessages } from '@/api/chats';
import { queryHandles } from '@/api/handles';
import { getAllContacts } from '@/api/contacts';
import {
  db,
  upsertChats,
  upsertContacts,
  upsertContactAvatars,
  upsertHandles,
  upsertMessages,
  setSetting,
  SETTING_KEYS,
} from '@/db/db';
import type { StoredContact, StoredContactAvatar } from '@/db/schema';
import type { Contact } from '@/types/bluebubbles';
import { mergeServerChats, toStoredMessage } from './socketHandlers';
import { base64ToBlob, detectMimeFromBase64 } from '@/utils/base64';

const CHAT_PAGE = 100;
const MESSAGES_PER_CHAT = 50;

export interface InitialSyncProgress {
  chatsPulled: number;
  messagesPulled: number;
  contactsPulled: number;
  phase: 'idle' | 'chats' | 'messages' | 'handles' | 'contacts' | 'done';
}

export type ProgressCallback = (p: InitialSyncProgress) => void;

export async function runInitialSync(onProgress?: ProgressCallback): Promise<void> {
  const progress: InitialSyncProgress = {
    chatsPulled: 0,
    messagesPulled: 0,
    contactsPulled: 0,
    phase: 'idle',
  };
  const report = () => onProgress?.({ ...progress });

  // 1. Chats (paged)
  progress.phase = 'chats';
  report();

  let offset = 0;
  const allChats: Awaited<ReturnType<typeof queryChats>> = [];
  for (;;) {
    const page = await queryChats({ limit: CHAT_PAGE, offset });
    if (page.length === 0) break;
    allChats.push(...page);
    // `mergeServerChats` preserves locally-set hasUnread when the chat's
    // last-message GUID is unchanged, so opening a chat and then refreshing
    // doesn't bounce the unread dot back on.
    await upsertChats(await mergeServerChats(page));
    offset += page.length;
    progress.chatsPulled = offset;
    report();
    if (page.length < CHAT_PAGE) break;
  }

  // 2. Messages per chat
  progress.phase = 'messages';
  report();

  for (const chat of allChats) {
    try {
      const msgs = await getChatMessages(chat.guid, { limit: MESSAGES_PER_CHAT, offset: 0 });
      if (msgs.length > 0) {
        await upsertMessages(msgs.map((m) => toStoredMessage(m, chat.guid)));
        progress.messagesPulled += msgs.length;
        report();
      }
    } catch (err) {
      console.warn('[initialSync] failed to pull messages for', chat.guid, err);
    }
  }

  // 3. Handles
  progress.phase = 'handles';
  report();

  try {
    const handles = await queryHandles({ limit: 1000 });
    await upsertHandles(
      handles.map((h) => ({ ...h, address: h.address, firstSeenAt: Date.now() })),
    );
  } catch (err) {
    console.warn('[initialSync] handle/query failed', err);
  }

  // 4. Contacts (macOS Contacts.app, via BB Server). Flatten each contact's
  // phone numbers and emails into one row per address. Failures here are
  // non-fatal — the app still works, it'll just show raw phone numbers.
  progress.phase = 'contacts';
  report();

  try {
    const contacts = await getAllContacts(true);
    const rows = flattenContacts(contacts);
    // Clear first — the server's contact IDs and address formats can shift
    // between syncs (different sourceType versions of the same person), so
    // we wipe and rewrite to avoid leaving stale rows keyed by old IDs.
    await db.contacts.clear();
    await upsertContacts(rows);
    progress.contactsPulled = rows.length;
    report();

    // Extract any base64 avatars that came back on the contact response
    // and store them as Blobs in the contactAvatars table. Most contacts
    // come back with `avatar: ""` — only persist the ones with data.
    const avatarRows: StoredContactAvatar[] = [];
    for (const c of contacts) {
      if (!c.id || !c.avatar) continue;
      try {
        // BlueBubbles returns JPEG for most macOS contact photos. The base64
        // signature tells us which encoding so the stored Blob's MIME type
        // matches — browsers won't render a JPEG served as image/png.
        const mimeType = detectMimeFromBase64(c.avatar);
        avatarRows.push({
          contactId: String(c.id),
          blob: base64ToBlob(c.avatar, mimeType),
          mimeType,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.warn('[initialSync] failed to decode avatar for contact', c.id, err);
      }
    }
    if (avatarRows.length > 0) {
      try {
        // Clear first so any stale rows from an earlier sync (e.g. with
        // the old numeric-id keys before we switched to UUIDs) don't
        // linger alongside the fresh ones.
        await db.contactAvatars.clear();
        await upsertContactAvatars(avatarRows);
      } catch (err) {
        console.warn('[initialSync] upsertContactAvatars failed:', err);
      }
    }
  } catch (err) {
    console.warn('[initialSync] contact pull failed', err);
  }

  await setSetting(SETTING_KEYS.LAST_FULL_SYNC, Date.now());

  progress.phase = 'done';
  report();
}

/**
 * Turn a list of macOS contacts into StoredContact rows, one per address.
 *
 * Critical: BB Server returns the same person multiple times in one response
 * (db-source with numeric id + avatar; api-source with UUID and no avatar).
 * Both versions typically share phone numbers. Since the `contacts` table
 * is keyed by address, naive flattening ends up with whichever version
 * came last in the response — usually the api-source UUID one, which means
 * we lose the link to the avatar.
 *
 * This implementation keeps ONE winner per address, prioritizing:
 *   1. entries that have an avatar attached
 *   2. then db-source entries (numeric id, most complete data)
 *   3. finally api-source entries as the fallback
 */
export function flattenContacts(contacts: Contact[]): StoredContact[] {
  const winnerByAddress = new Map<string, { priority: number; row: StoredContact }>();
  const now = Date.now();

  for (const c of contacts) {
    const displayName = resolveContactDisplay(c);
    if (!displayName) continue;

    const base = {
      displayName,
      firstName: c.firstName ?? null,
      lastName: c.lastName ?? null,
      nickname: c.nickname ?? null,
      sourceType: c.sourceType,
      contactId: c.id !== undefined ? String(c.id) : undefined,
      updatedAt: now,
    };

    const pri = contactPriority(c);

    for (const p of c.phoneNumbers ?? []) {
      if (!p.address) continue;
      const row: StoredContact = { ...base, address: p.address };
      maybeReplace(winnerByAddress, p.address, pri, row);
    }
    for (const e of c.emails ?? []) {
      if (!e.address) continue;
      const row: StoredContact = { ...base, address: e.address };
      maybeReplace(winnerByAddress, e.address, pri, row);
    }
  }

  return Array.from(winnerByAddress.values()).map((w) => w.row);
}

function contactPriority(c: Contact): number {
  // Lower number = higher priority.
  if (c.avatar) return 0;                   // has avatar — always wins
  if (c.sourceType === 'db') return 1;      // db-source is more complete
  return 2;                                 // api-source fallback
}

function maybeReplace(
  map: Map<string, { priority: number; row: StoredContact }>,
  address: string,
  priority: number,
  row: StoredContact,
): void {
  const existing = map.get(address);
  if (!existing || priority < existing.priority) {
    map.set(address, { priority, row });
  }
}

function resolveContactDisplay(c: Contact): string {
  if (c.displayName && c.displayName.trim()) return c.displayName.trim();
  const parts = [c.firstName, c.lastName].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(' ');
  if (c.nickname && c.nickname.trim()) return c.nickname.trim();
  return '';
}
