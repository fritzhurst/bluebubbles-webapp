// Render a single contact's avatar image, with initials as a fallback.
//
// Uses Dexie's `useLiveQuery` so the component reacts when the
// contactAvatars table updates — otherwise a mount that happens mid-sync
// (after contacts populate but before avatars do) would see an empty
// lookup and never retry. The subscription is cheap: Dexie only re-runs
// the query when the underlying table actually changes.

import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';

interface Props {
  contactId?: string | null;
  fallbackText: string;
  /** Pixel size of the circular avatar. Default: 40. */
  size?: number;
  /** Ring around the avatar (useful for overlapping group-chat bubbles). */
  ringColorClass?: string;
}

export default function ContactAvatar({
  contactId,
  fallbackText,
  size = 40,
  ringColorClass = '',
}: Props) {
  const row = useLiveQuery(
    () => (contactId ? db.contactAvatars.get(contactId) : undefined),
    [contactId],
  );

  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    // Revoke any previous URL — blob changed or contactId changed.
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    if (row?.blob) {
      const next = URL.createObjectURL(row.blob);
      urlRef.current = next;
      setUrl(next);
    } else {
      setUrl(null);
    }

    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [row]);

  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.4) };
  const ring = ringColorClass ? `ring-2 ${ringColorClass}` : '';

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`rounded-full object-cover flex-shrink-0 ${ring}`}
        style={style}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-slate-700 flex items-center justify-center text-slate-200 font-medium flex-shrink-0 ${ring}`}
      style={style}
    >
      {fallbackText}
    </div>
  );
}
