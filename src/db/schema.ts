// IndexedDB schema.
//
// We use Dexie (wrapper over IndexedDB) because its `liveQuery` integrates
// cleanly with React. Every write to the DB — whether from a user action or
// a Socket.IO event — propagates to the UI automatically. That's the whole
// reason this app feels real-time.
//
// All time fields are stored as JS epoch milliseconds (not Apple epoch).
// The API client does the conversion on the way in.

import Dexie, { type Table } from 'dexie';
import type { Chat, Message, Handle, ServerInfo } from '@/types/bluebubbles';

/**
 * A row in the `chats` table. We store the server-provided Chat plus derived
 * sort fields that make the chat-list query fast.
 */
export interface StoredChat extends Chat {
  /** guid is the primary key */
  guid: string;
  /** Most recent message timestamp in JS epoch ms, for sorting the chat list */
  sortTimestamp: number;
  /** Last time we successfully pulled messages for this chat */
  lastSyncedAt: number;
  /** True if the user has unread messages in this chat */
  hasUnread: boolean;
}

export interface StoredMessage extends Message {
  /** guid is the primary key */
  guid: string;
  /** Foreign key back to chats.guid (many-to-many in iMessage, but in practice 1) */
  chatGuid: string;
  /** JS epoch ms, copied from dateCreated for indexing */
  dateCreatedMs: number;
}

export interface StoredHandle extends Handle {
  /** address is the primary key */
  address: string;
  /** First time we saw this handle */
  firstSeenAt: number;
}

/**
 * A single name-mapping for one phone number or email.
 *
 * macOS contacts can have many phones/emails per person. Rather than joining
 * at read time, we flatten each address into its own row so
 * `contacts.get(address)` is a single indexed read.
 */
export interface StoredContact {
  /** address is the primary key — phone number or email as returned by BB Server */
  address: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  sourceType?: string;
  /** ID of the underlying macOS Contact; multiple addresses can share one */
  contactId?: string;
  updatedAt: number;
}

/**
 * One avatar image per macOS contact, keyed by `contactId`. Avatars can be
 * large, so we store them in a dedicated table instead of inline on every
 * StoredContact row (which would duplicate the blob across every phone /
 * email a person has).
 */
export interface StoredContactAvatar {
  contactId: string;
  blob: Blob;
  mimeType: string;
  updatedAt: number;
}

/**
 * Blob cache for attachments. We store the actual Blob so they don't need
 * to be re-downloaded on future sessions. Large attachments can be cleared
 * via the Settings page (TODO) or by eviction (future enhancement).
 */
export interface StoredAttachmentBlob {
  /** attachment guid */
  guid: string;
  blob: Blob;
  mimeType: string;
  fetchedAt: number;
}

/**
 * Key/value settings store. Holds the server URL, password, last sync
 * timestamps, and user preferences. Using an object store instead of
 * localStorage because the password belongs in the same transactional
 * domain as everything else — and because localStorage can be wiped more
 * aggressively by browsers.
 */
export interface StoredSetting {
  key: string;
  value: unknown;
  updatedAt: number;
}

export const SETTING_KEYS = {
  SERVER_URL: 'server.url',
  SERVER_PASSWORD: 'server.password',
  SERVER_INFO: 'server.info',
  LAST_FULL_SYNC: 'sync.lastFullSync',
  LAST_INCREMENTAL_SYNC: 'sync.lastIncrementalSync',
  SEND_METHOD: 'pref.sendMethod',
  THEME: 'pref.theme',
} as const;

export type SendMethod = 'apple-script' | 'private-api';
export const DEFAULT_SEND_METHOD: SendMethod = 'private-api';

export type Theme = 'light' | 'dark';
export const DEFAULT_THEME: Theme = 'dark';

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export interface SettingRow<T = unknown> extends StoredSetting {
  value: T;
}

export class BlueBubblesDatabase extends Dexie {
  chats!: Table<StoredChat, string>;
  messages!: Table<StoredMessage, string>;
  handles!: Table<StoredHandle, string>;
  attachmentBlobs!: Table<StoredAttachmentBlob, string>;
  settings!: Table<StoredSetting, string>;
  contacts!: Table<StoredContact, string>;
  contactAvatars!: Table<StoredContactAvatar, string>;

  constructor() {
    super('bluebubbles');

    // Schema version 1 — initial tables.
    // Indexes are listed after the primary key. Prefix-match indexes use `*`.
    this.version(1).stores({
      chats: 'guid, sortTimestamp, lastSyncedAt, hasUnread',
      messages: 'guid, chatGuid, dateCreatedMs, [chatGuid+dateCreatedMs]',
      handles: 'address, service',
      attachmentBlobs: 'guid, fetchedAt',
      settings: 'key, updatedAt',
    });

    // Schema version 2 — add `contacts` table so we can map addresses to
    // real names pulled from macOS Contacts.app via /api/v1/contact.
    this.version(2).stores({
      chats: 'guid, sortTimestamp, lastSyncedAt, hasUnread',
      messages: 'guid, chatGuid, dateCreatedMs, [chatGuid+dateCreatedMs]',
      handles: 'address, service',
      attachmentBlobs: 'guid, fetchedAt',
      settings: 'key, updatedAt',
      contacts: 'address, contactId, displayName',
    });

    // Schema version 3 — add `contactAvatars` table. Separate from contacts
    // so the Blob isn't duplicated across every phone/email a person has.
    this.version(3).stores({
      chats: 'guid, sortTimestamp, lastSyncedAt, hasUnread',
      messages: 'guid, chatGuid, dateCreatedMs, [chatGuid+dateCreatedMs]',
      handles: 'address, service',
      attachmentBlobs: 'guid, fetchedAt',
      settings: 'key, updatedAt',
      contacts: 'address, contactId, displayName',
      contactAvatars: 'contactId, updatedAt',
    });
  }
}

export type { ServerInfo };
