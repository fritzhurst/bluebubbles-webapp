import { Endpoints } from './endpoints';
import { apiGet, apiPost } from './rest';
import type { Chat } from '@/types/bluebubbles';

export interface ChatQueryParams {
  limit?: number;
  offset?: number;
  /** Extra fields to hydrate on each chat. Common: lastMessage, participants */
  with?: Array<'lastMessage' | 'participants' | 'sms' | 'archived'>;
  /** Sort order. 'lastmessage' is what the iOS/desktop clients use. */
  sort?: 'lastmessage' | 'id';
}

export async function queryChats(params: ChatQueryParams = {}): Promise<Chat[]> {
  const body = {
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
    with: params.with ?? ['lastMessage', 'participants'],
    sort: params.sort ?? 'lastmessage',
  };
  return apiPost<Chat[]>(Endpoints.chatQuery, body);
}

export async function getChatMessages(
  chatGuid: string,
  params: { limit?: number; offset?: number; after?: number; before?: number } = {},
) {
  return apiGet<import('@/types/bluebubbles').Message[]>(Endpoints.chatMessages(chatGuid), {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    with: 'attachment,handle',
    sort: 'DESC',
    after: params.after,
    before: params.before,
  });
}

export async function markChatRead(chatGuid: string): Promise<void> {
  await apiPost<unknown>(Endpoints.chatRead(chatGuid), {});
}

export interface CreateChatParams {
  /** Recipient handles. One address = 1:1 chat. Multiple = group chat. */
  addresses: string[];
  /** Optional first message sent as part of chat creation. */
  message?: string;
  /** Server-side dispatch path; same choice as /message/text. */
  method?: 'apple-script' | 'private-api';
  service?: 'iMessage' | 'SMS';
  /** For group chats — the friendly name. */
  displayName?: string;
  /** Optional temp guid the server echoes back. */
  tempGuid?: string;
}

/**
 * Create a new chat with the given recipient(s), optionally sending an
 * initial message. The BB Server creates the chat in Messages.app (if it
 * doesn't already exist with exactly these participants) and returns the
 * Chat object.
 */
export async function createChat(params: CreateChatParams): Promise<Chat> {
  const body: Record<string, unknown> = {
    addresses: params.addresses,
    method: params.method ?? 'apple-script',
    service: params.service ?? 'iMessage',
  };
  if (params.message !== undefined) body.message = params.message;
  if (params.displayName !== undefined) body.displayName = params.displayName;
  if (params.tempGuid !== undefined) body.tempGuid = params.tempGuid;
  return apiPost<Chat>(Endpoints.chatNew, body);
}
