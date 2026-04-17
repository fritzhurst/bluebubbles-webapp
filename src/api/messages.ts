import { Endpoints } from './endpoints';
import { apiPost } from './rest';
import type { Message } from '@/types/bluebubbles';

export interface SendTextParams {
  chatGuid: string;
  message: string;
  /** Server decides which actual mechanism to use; 'private-api' enables
   *  reactions / tapbacks / edits on supported servers. */
  method?: 'apple-script' | 'private-api';
  /** Optional temp GUID the server will echo back in new-message */
  tempGuid?: string;
  subject?: string;
  effectId?: string;
  selectedMessageGuid?: string;
  partIndex?: number;
  ddScan?: boolean;
}

export async function sendText(params: SendTextParams): Promise<Message> {
  // Only include fields the caller actually set. Several optional fields
  // (ddScan, subject, effectId, selectedMessageGuid, partIndex) enable
  // Private-API-only features — if the server doesn't have Private API
  // enabled, their mere presence in the request triggers validation errors
  // like 'iMessage Private API is not enabled'. So we send a minimal body
  // for basic text sends.
  const body: Record<string, unknown> = {
    chatGuid: params.chatGuid,
    message: params.message,
    method: params.method ?? 'apple-script',
  };
  if (params.tempGuid !== undefined) body.tempGuid = params.tempGuid;
  if (params.subject !== undefined) body.subject = params.subject;
  if (params.effectId !== undefined) body.effectId = params.effectId;
  if (params.selectedMessageGuid !== undefined) body.selectedMessageGuid = params.selectedMessageGuid;
  if (params.partIndex !== undefined) body.partIndex = params.partIndex;
  if (params.ddScan !== undefined) body.ddScan = params.ddScan;

  return apiPost<Message>(Endpoints.messageText, body);
}

export interface SendAttachmentParams {
  chatGuid: string;
  /** The actual file to upload — from <input type=file>, clipboard, or drop. */
  file: File | Blob;
  /** Filename to present to the server / recipient. */
  name: string;
  /** Optional caption text sent alongside the attachment. */
  message?: string;
  method?: 'apple-script' | 'private-api';
  tempGuid?: string;
  subject?: string;
  effectId?: string;
  /** True to run Apple's Data Detectors over the caption. Private-API only. */
  ddScan?: boolean;
}

/**
 * Upload and send an attachment. BlueBubbles Server's
 * POST /api/v1/message/attachment takes a multipart body with:
 *   - chatGuid (field)
 *   - name (field)          filename shown to recipient
 *   - method (field)        apple-script | private-api
 *   - tempGuid (field)      optional; server echoes this on new-message
 *   - message (field)       optional caption text
 *   - attachment (file)     the binary blob
 */
export async function sendAttachment(params: SendAttachmentParams): Promise<Message> {
  const form = new FormData();
  form.append('chatGuid', params.chatGuid);
  form.append('name', params.name);
  form.append('method', params.method ?? 'apple-script');
  if (params.tempGuid) form.append('tempGuid', params.tempGuid);
  if (params.message) form.append('message', params.message);
  if (params.subject) form.append('subject', params.subject);
  if (params.effectId) form.append('effectId', params.effectId);
  if (params.ddScan !== undefined) form.append('ddScan', String(params.ddScan));
  form.append('attachment', params.file, params.name);

  return apiPost<Message>(Endpoints.messageAttachment, form);
}

export interface MessageQueryParams {
  chatGuid?: string;
  limit?: number;
  offset?: number;
  after?: number;
  before?: number;
  with?: Array<'attachment' | 'handle' | 'chat' | 'chat.participants'>;
  sort?: 'ASC' | 'DESC';
}

export async function queryMessages(params: MessageQueryParams = {}): Promise<Message[]> {
  const body = {
    chatGuid: params.chatGuid,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    after: params.after,
    before: params.before,
    with: params.with ?? ['attachment', 'handle'],
    sort: params.sort ?? 'DESC',
  };
  return apiPost<Message[]>(Endpoints.messageQuery, body);
}
