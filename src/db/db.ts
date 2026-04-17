// Singleton Dexie instance plus helpers for upsert and settings.
//
// Upserts dominate our write path: every REST response and every socket event
// ends in an upsert. We use Dexie's `put()` which is effectively INSERT OR
// REPLACE on the primary key. For hot loops we batch via `bulkPut()`.

import {
  BlueBubblesDatabase,
  SETTING_KEYS,
  type SettingKey,
  type StoredAttachmentBlob,
  type StoredChat,
  type StoredContact,
  type StoredContactAvatar,
  type StoredHandle,
  type StoredMessage,
  type StoredSetting,
} from './schema';

export const db = new BlueBubblesDatabase();

// --- settings helpers -------------------------------------------------------

export async function setSetting<T>(key: SettingKey, value: T): Promise<void> {
  const row: StoredSetting = { key, value, updatedAt: Date.now() };
  await db.settings.put(row);
}

export async function getSetting<T>(key: SettingKey): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function clearSettings(): Promise<void> {
  await db.settings.clear();
}

/** Clear everything (on logout). */
export async function wipeDatabase(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.chats,
      db.messages,
      db.handles,
      db.attachmentBlobs,
      db.settings,
      db.contacts,
      db.contactAvatars,
    ],
    async () => {
      await Promise.all([
        db.chats.clear(),
        db.messages.clear(),
        db.handles.clear(),
        db.attachmentBlobs.clear(),
        db.settings.clear(),
        db.contacts.clear(),
        db.contactAvatars.clear(),
      ]);
    },
  );
}

// --- upsert helpers ---------------------------------------------------------

export async function upsertChats(rows: StoredChat[]): Promise<void> {
  if (rows.length === 0) return;
  await db.chats.bulkPut(rows);
}

export async function upsertChat(row: StoredChat): Promise<void> {
  await db.chats.put(row);
}

export async function upsertMessages(rows: StoredMessage[]): Promise<void> {
  if (rows.length === 0) return;
  await db.messages.bulkPut(rows);
}

export async function upsertMessage(row: StoredMessage): Promise<void> {
  await db.messages.put(row);
}

export async function upsertHandles(rows: StoredHandle[]): Promise<void> {
  if (rows.length === 0) return;
  await db.handles.bulkPut(rows);
}

export async function upsertAttachmentBlob(row: StoredAttachmentBlob): Promise<void> {
  await db.attachmentBlobs.put(row);
}

export async function upsertContacts(rows: StoredContact[]): Promise<void> {
  if (rows.length === 0) return;
  await db.contacts.bulkPut(rows);
}

export async function upsertContactAvatars(rows: StoredContactAvatar[]): Promise<void> {
  if (rows.length === 0) return;
  await db.contactAvatars.bulkPut(rows);
}

export { SETTING_KEYS };
