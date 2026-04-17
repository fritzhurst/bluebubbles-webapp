// Modal dialog for starting a new iMessage chat.
//
// The recipient field supports two input modes:
//   1. Type a contact name — we autocomplete against the contacts table
//      and let the user pick one of their known addresses.
//   2. Type a raw phone or email — we accept it as-is and use it directly.
//
// On send we call POST /chat/new, which creates (or finds) the chat in
// Messages.app and sends the first message in one shot. The returned
// Chat gets upserted and selected so the user lands inside it.

import { useMemo, useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, upsertChat } from '@/db/db';
import { createChat } from '@/api/chats';
import { ApiError } from '@/api/rest';
import { useUIStore } from '@/state/store';
import { useSendMethod } from '@/ui/hooks/useSendMethod';
import type { StoredContact } from '@/db/schema';
import { toStoredChat } from '@/sync/socketHandlers';

interface Suggestion {
  address: string;
  displayName?: string | null;
}

/** Look like an email address? */
function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Look like a phone number (digits plus punctuation)? */
function looksLikePhone(s: string): boolean {
  return /^[+\d][\d\s()\-.]{6,}$/.test(s);
}

export default function NewMessageDialog() {
  const open = useUIStore((s) => s.composeOpen);
  const setOpen = useUIStore((s) => s.setComposeOpen);
  const selectChat = useUIStore((s) => s.selectChat);
  const [sendMethod] = useSendMethod();

  const [recipientInput, setRecipientInput] = useState('');
  const [pickedAddress, setPickedAddress] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipientRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (open) {
      recipientRef.current?.focus();
    } else {
      // Reset when closing so the next open is fresh.
      setRecipientInput('');
      setPickedAddress(null);
      setMessage('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  // Live-query contacts so the suggestions reflect any fresh sync.
  const contacts = useLiveQuery<StoredContact[]>(
    () => db.contacts.toArray(),
    [],
    [] as StoredContact[],
  );

  const suggestions: Suggestion[] = useMemo(() => {
    const query = recipientInput.trim().toLowerCase();
    if (!query || pickedAddress) return [];
    // De-duplicate suggestions by "displayName + address" so one contact
    // with 3 phones doesn't flood the list — but still show multiple
    // addresses per person, since the user might want a specific one.
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const c of contacts ?? []) {
      const match =
        c.displayName.toLowerCase().includes(query) ||
        c.address.toLowerCase().includes(query);
      if (!match) continue;
      const key = c.displayName + '|' + c.address;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ address: c.address, displayName: c.displayName });
      if (out.length >= 8) break;
    }
    return out;
  }, [contacts, recipientInput, pickedAddress]);

  if (!open) return null;

  // The "To" text to use when sending — either the picked suggestion's
  // address or whatever the user typed (if it looks like a phone/email).
  const effectiveAddress =
    pickedAddress ??
    (looksLikePhone(recipientInput.trim()) || looksLikeEmail(recipientInput.trim())
      ? recipientInput.trim()
      : null);

  const canSend = !!effectiveAddress && message.trim().length > 0 && !busy;

  async function onSend() {
    if (!effectiveAddress || !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const chat = await createChat({
        addresses: [effectiveAddress],
        message: message.trim(),
        method: sendMethod,
      });
      // Persist locally and jump into it.
      await upsertChat(toStoredChat(chat));
      selectChat(chat.guid);
      setOpen(false);
    } catch (err: unknown) {
      console.error('[NewMessageDialog] createChat failed', err);
      if (err instanceof ApiError) console.error('payload:', err.payload);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function onRecipientKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && suggestions.length > 0) {
      // Accept top suggestion on Enter.
      e.preventDefault();
      const first = suggestions[0];
      setPickedAddress(first.address);
      setRecipientInput(first.displayName ? `${first.displayName} <${first.address}>` : first.address);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-20"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="text-base font-semibold text-slate-100">New Message</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-100 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="relative">
            <label className="block text-xs text-slate-400 mb-1">To</label>
            <input
              ref={recipientRef}
              type="text"
              value={recipientInput}
              onChange={(e) => {
                setRecipientInput(e.target.value);
                setPickedAddress(null);
              }}
              onKeyDown={onRecipientKeyDown}
              placeholder="Name, phone, or email"
              autoComplete="off"
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-imessage-blue"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg bg-slate-800 ring-1 ring-white/10 shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.displayName + '|' + s.address}>
                    <button
                      type="button"
                      onClick={() => {
                        setPickedAddress(s.address);
                        setRecipientInput(
                          s.displayName ? `${s.displayName} <${s.address}>` : s.address,
                        );
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-100 hover:bg-white/5 focus:bg-white/5 focus:outline-none"
                    >
                      <span className="font-medium">{s.displayName || '(no name)'}</span>
                      <span className="ml-2 text-slate-400 text-xs">{s.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="iMessage"
              rows={4}
              className="w-full resize-y rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-imessage-blue"
            />
          </div>

          {error && (
            <div className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onSend}
            disabled={!canSend}
            className="rounded-lg bg-imessage-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
