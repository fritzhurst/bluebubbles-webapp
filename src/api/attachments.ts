// Attachment download with IndexedDB Blob cache.
//
// Strategy: before hitting the network, check `attachmentBlobs` in Dexie.
// If present, return the cached Blob. Otherwise fetch, store, and return.
// The UI can safely call `getAttachmentBlobUrl(guid)` on every render — it's
// cheap after the first hit.

import { Endpoints } from './endpoints';
import { apiBlob, apiGet } from './rest';
import { db, upsertAttachmentBlob } from '@/db/db';
import type { Attachment } from '@/types/bluebubbles';

export async function getAttachmentMetadata(guid: string): Promise<Attachment> {
  return apiGet<Attachment>(Endpoints.attachmentMeta(guid));
}

/**
 * Returns a Blob for the given attachment, fetching from the server on a
 * cache miss. Subsequent calls hit IndexedDB.
 */
export async function getAttachmentBlob(guid: string, mimeType?: string): Promise<Blob> {
  const cached = await db.attachmentBlobs.get(guid);
  if (cached) return cached.blob;
  const blob = await apiBlob(Endpoints.attachmentDownload(guid));
  await upsertAttachmentBlob({
    guid,
    blob,
    mimeType: mimeType ?? blob.type ?? 'application/octet-stream',
    fetchedAt: Date.now(),
  });
  return blob;
}

/**
 * Convenience helper: returns an object URL suitable for `<img src>` or
 * `<video src>`. Caller is responsible for `URL.revokeObjectURL` on unmount.
 */
export async function getAttachmentObjectUrl(guid: string, mimeType?: string): Promise<string> {
  const blob = await getAttachmentBlob(guid, mimeType);
  return URL.createObjectURL(blob);
}

/** Evict everything older than `maxAgeMs`. Good for a future "clear cache" button. */
export async function evictOldAttachments(maxAgeMs: number): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  return db.attachmentBlobs.where('fetchedAt').below(cutoff).delete();
}
