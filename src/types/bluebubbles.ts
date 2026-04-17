// Types that mirror the shape of BlueBubbles Server API responses.
// These are deliberately loose (lots of ?) because BB's API evolves and
// the Windows/desktop client tolerates missing fields. We follow the same policy.

export interface Handle {
  /** e.g. iMessage;-;+15551234567 */
  address: string;
  country?: string | null;
  service?: 'iMessage' | 'SMS' | string;
  uncanonicalizedId?: string | null;
}

export interface Attachment {
  guid: string;
  uti?: string | null;
  mimeType?: string | null;
  transferName?: string | null;
  totalBytes?: number | null;
  isOutgoing?: boolean;
  hideAttachment?: boolean;
  transferState?: number;
  // Some servers return a partial message ref; we don't rely on it.
}

export interface Message {
  guid: string;
  text?: string | null;
  subject?: string | null;
  /** Apple epoch milliseconds (since 2001-01-01 UTC). We normalize in utils/time.ts */
  dateCreated: number;
  dateRead?: number | null;
  dateDelivered?: number | null;
  dateEdited?: number | null;
  dateRetracted?: number | null;
  isFromMe: boolean;
  isDelayed?: boolean;
  isAutoReply?: boolean;
  isSystemMessage?: boolean;
  isServiceMessage?: boolean;
  isForward?: boolean;
  isArchived?: boolean;
  cacheRoomnames?: string | null;
  isAudioMessage?: boolean;
  datePlayed?: number | null;
  itemType?: number;
  groupTitle?: string | null;
  groupActionType?: number;
  isExpired?: boolean;
  balloonBundleId?: string | null;
  associatedMessageGuid?: string | null;
  associatedMessageType?: string | null;
  expressiveSendStyleId?: string | null;
  timeExpressiveSendStyleId?: number | null;
  handle?: Handle | null;
  otherHandle?: number | null;
  attachments?: Attachment[];
  error?: number;
  chats?: Array<{ guid: string }>;
}

export interface Chat {
  guid: string;
  chatIdentifier?: string;
  displayName?: string | null;
  style?: number; // 43 = group, 45 = direct (varies)
  groupId?: string | null;
  isArchived?: boolean;
  /** Apple epoch milliseconds of last activity (server-reported) */
  lastMessageTimestamp?: number | null;
  participants?: Handle[];
  lastMessage?: Message | null;
  properties?: Array<Record<string, unknown>>;
}

export interface ServerInfo {
  os_version?: string;
  server_version?: string;
  private_api?: boolean;
  proxy_service?: string;
  helper_connected?: boolean;
  detected_imessage?: string;
  macos_version?: string;
}

export interface ApiEnvelope<T> {
  status: number;
  message: string;
  data: T;
  metadata?: Record<string, unknown>;
}

/** A single phone number or email entry inside a macOS Contacts record. */
export interface ContactAddress {
  address: string;
  id?: string;
  label?: string | null;
}

/**
 * A named contact record, pulled from macOS Contacts.app via the
 * BlueBubbles Server `/api/v1/contact` endpoint. One contact can carry
 * multiple phone numbers and emails — we denormalize into one StoredContact
 * row per address at write time so address-based lookups are O(1).
 */
export interface Contact {
  /** BB Server returns numeric IDs (e.g. `407`); coerce to string at the edge. */
  id?: string | number;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  birthday?: string | null;
  sourceType?: string;
  phoneNumbers?: ContactAddress[];
  emails?: ContactAddress[];
  /**
   * Base64-encoded avatar, typically JPEG for macOS Contacts photos.
   * Starts with the format's base64 signature (JPEG: `/9j/`, PNG: `iVBOR`).
   * Empty string for contacts without a photo.
   */
  avatar?: string | null;
}
