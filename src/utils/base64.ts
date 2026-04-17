/**
 * Decode a base64-encoded binary (optionally a data: URI) to a Blob.
 * Used to turn BB-server-reported avatars into something we can cache in
 * IndexedDB and hand to <img src=objectURL>.
 *
 * The caller can pass an explicit MIME type, but by default we sniff the
 * first few base64 characters to guess. BlueBubbles Server returns JPEG
 * for avatars (`/9j/...`), but we detect PNG / GIF / WebP too so the same
 * helper works for other binary payloads.
 */
export function base64ToBlob(base64: string, mimeType?: string): Blob {
  const cleaned = base64.startsWith('data:')
    ? base64.slice(base64.indexOf(',') + 1)
    : base64;
  const finalMime = mimeType ?? detectMimeFromBase64(cleaned);
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: finalMime });
}

/** Best-effort MIME sniff from the first few base64 characters. */
export function detectMimeFromBase64(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'application/octet-stream';
}
