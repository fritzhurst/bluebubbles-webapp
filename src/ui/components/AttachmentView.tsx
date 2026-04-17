import { useEffect, useRef, useState } from 'react';
import type { Attachment } from '@/types/bluebubbles';
import { getAttachmentObjectUrl } from '@/api/attachments';

interface Props {
  attachment: Attachment;
}

/**
 * Renders an attachment. On first mount it fetches the Blob (hitting the
 * IndexedDB cache if present), creates an object URL, and renders it.
 * Images are inlined; video/audio get a player; everything else becomes a
 * download link.
 */
export default function AttachmentView({ attachment }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  const mime = attachment.mimeType ?? '';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const u = await getAttachmentObjectUrl(attachment.guid, attachment.mimeType ?? undefined);
      urlRef.current = u;
      setUrl(u);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // Auto-load for images & video/audio. For "other", let the user click.
  useEffect(() => {
    if (isImage || isVideo || isAudio) {
      load();
    }
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.guid]);

  if (error) {
    return (
      <div className="text-xs text-red-300 underline cursor-pointer" onClick={load}>
        Attachment failed to load — retry
      </div>
    );
  }

  if (loading && !url) {
    return <div className="text-xs text-slate-400 italic">Loading attachment…</div>;
  }

  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={attachment.transferName ?? 'attachment'}
          className="max-h-64 max-w-xs rounded-lg"
          loading="lazy"
        />
      </a>
    );
  }

  if (isVideo && url) {
    return <video src={url} controls className="max-h-64 max-w-xs rounded-lg" />;
  }

  if (isAudio && url) {
    return <audio src={url} controls className="w-full" />;
  }

  // Fallback: download link.
  return (
    <button
      onClick={load}
      className="text-xs underline text-slate-300 hover:text-white"
    >
      {url ? (
        <a href={url} download={attachment.transferName ?? 'attachment'}>
          Download {attachment.transferName ?? 'file'}
        </a>
      ) : (
        <>Load {attachment.transferName ?? 'attachment'}</>
      )}
    </button>
  );
}
