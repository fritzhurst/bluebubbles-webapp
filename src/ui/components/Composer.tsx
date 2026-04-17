// Composer: textarea + attachment handling.
//
// Attachments can arrive from three channels:
//   - File picker button (paperclip icon opens <input type=file multiple>)
//   - Clipboard paste (onPaste pulls image blobs out of clipboardData)
//   - Drag-and-drop (onDrop handler on the composer area)
//
// All three funnel into `pendingAttachments`, which the user reviews in a
// preview strip above the textarea before sending. On send we POST each
// file as its own /message/attachment request, then if there's text we
// POST /message/text. A combined send (first attachment with caption)
// would be slightly more efficient but gets complicated when there are
// multiple attachments plus text.

import { useEffect, useMemo, useRef, useState } from 'react';
import { sendAttachment, sendText } from '@/api/messages';
import { ApiError } from '@/api/rest';
import { useUIStore } from '@/state/store';
import { tempGuid } from '@/utils/guid';
import { db, upsertMessage } from '@/db/db';
import { toJsEpochMs } from '@/utils/time';
import { useSendMethod } from '@/ui/hooks/useSendMethod';

interface Props {
  chatGuid: string;
}

/** Pull all File objects out of a DataTransfer (drag-drop or paste). */
function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  if (dt.files && dt.files.length > 0) return Array.from(dt.files);
  // Some paste events expose items but not files — e.g. Chrome with inline
  // images on Windows. Walk items and extract.
  const out: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

/** Try to pick a sensible filename for a paste-source image Blob. */
function nameFor(file: File, index: number): string {
  if (file.name) return file.name;
  const ext =
    file.type === 'image/png' ? 'png' :
    file.type === 'image/jpeg' ? 'jpg' :
    file.type === 'image/gif' ? 'gif' :
    file.type === 'image/webp' ? 'webp' :
    'bin';
  return `pasted-${Date.now()}-${index}.${ext}`;
}

export default function Composer({ chatGuid }: Props) {
  const draft = useUIStore((s) => s.composerDrafts[chatGuid] ?? '');
  const setDraft = useUIStore((s) => s.setDraft);
  const [sendMethod] = useSendMethod();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Object URLs for image previews — revoke on unmount / list change.
  const previewUrls = useMemo(
    () =>
      pending.map((f) =>
        f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      ),
    [pending],
  );
  useEffect(() => {
    return () => {
      for (const url of previewUrls) if (url) URL.revokeObjectURL(url);
    };
  }, [previewUrls]);

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setPending((prev) => [...prev, ...files]);
  }

  function removePending(index: number) {
    setPending((prev) => prev.filter((_, i) => i !== index));
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    addFiles(files);
    // Reset so picking the same file twice in a row re-triggers onChange.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = filesFromDataTransfer(e.clipboardData);
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
    // Otherwise: plain text paste happens via the default handler.
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const files = filesFromDataTransfer(e.dataTransfer);
    addFiles(files);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    // Required to enable drop.
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
    }
  }

  async function onSend() {
    const text = draft.trim();
    if ((!text && pending.length === 0) || sending) return;
    setSending(true);
    setError(null);

    // Optimistic placeholder row(s). For each attachment, insert a stub
    // so the UI shows something immediately; server echo will replace it.
    // Text gets its own placeholder too.
    const captured = [...pending]; // snapshot
    const textTemp = text ? tempGuid() : null;
    const attachmentTemps = captured.map(() => tempGuid());

    try {
      // Placeholders
      if (textTemp) {
        await upsertMessage({
          guid: textTemp,
          chatGuid,
          dateCreated: Date.now(),
          dateCreatedMs: Date.now(),
          text,
          isFromMe: true,
        });
      }
      setDraft(chatGuid, '');
      setPending([]);

      // Send attachments sequentially. Parallel uploads would be faster
      // but BB Server tends to serialize sends internally and we risk
      // out-of-order delivery; serial keeps it predictable.
      for (let i = 0; i < captured.length; i++) {
        const file = captured[i];
        const serverMsg = await sendAttachment({
          chatGuid,
          file,
          name: nameFor(file, i),
          method: sendMethod,
          tempGuid: attachmentTemps[i],
        });
        await db.transaction('rw', db.messages, async () => {
          await db.messages.put({
            ...serverMsg,
            chatGuid,
            dateCreatedMs: toJsEpochMs(serverMsg.dateCreated),
          });
          await db.messages.delete(attachmentTemps[i]);
        });
      }

      // Then send any text.
      if (textTemp) {
        const serverMsg = await sendText({
          chatGuid,
          message: text,
          tempGuid: textTemp,
          method: sendMethod,
        });
        await db.transaction('rw', db.messages, async () => {
          await db.messages.put({
            ...serverMsg,
            chatGuid,
            dateCreatedMs: toJsEpochMs(serverMsg.dateCreated),
          });
          await db.messages.delete(textTemp);
        });
      }
    } catch (err: unknown) {
      console.warn('[Composer] send failed', err);
      if (err instanceof ApiError) {
        console.warn('[Composer] full server payload:', err.payload);
      }
      // Mark any still-pending optimistic rows as errored.
      for (const g of [textTemp, ...attachmentTemps]) {
        if (!g) continue;
        try {
          const row = await db.messages.get(g);
          if (row) await db.messages.put({ ...row, error: 1 });
        } catch {
          /* best-effort */
        }
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  const canSend = !sending && (draft.trim().length > 0 || pending.length > 0);

  return (
    <div
      className="border-t border-white/10 p-3"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {error && (
        <div className="mb-2 rounded bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20">
          <div className="break-words">{error}</div>
          <div className="mt-1 text-red-400/70">
            See the browser console for the full server response payload.
          </div>
        </div>
      )}

      {/* Pending attachment preview strip */}
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((f, i) => (
            <div
              key={i}
              className="relative flex items-center gap-2 rounded-lg bg-slate-800 px-2 py-1 ring-1 ring-white/10"
            >
              {previewUrls[i] ? (
                <img
                  src={previewUrls[i]!}
                  alt={f.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-700 text-xs text-slate-300">
                  {f.type.split('/')[0] || 'file'}
                </div>
              )}
              <div className="flex flex-col text-xs">
                <span className="max-w-[12rem] truncate text-slate-200">
                  {f.name || 'pasted image'}
                </span>
                <span className="text-slate-500">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                onClick={() => removePending(i)}
                className="ml-1 text-slate-400 hover:text-white"
                aria-label="Remove attachment"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Paperclip button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="h-9 w-9 flex-shrink-0 rounded-full text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-40 flex items-center justify-center"
          aria-label="Attach file"
          title="Attach file"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={onFilePick}
        />

        <textarea
          value={draft}
          onChange={(e) => setDraft(chatGuid, e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={pending.length > 0 ? 'Caption (optional)' : 'iMessage'}
          rows={1}
          className="flex-1 resize-none rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-imessage-blue max-h-40"
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          className="rounded-full bg-imessage-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
