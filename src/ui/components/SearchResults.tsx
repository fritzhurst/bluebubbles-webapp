// Sidebar search results.
//
// When the user has typed something in the search box, this replaces the
// normal ChatList. It surfaces two sections:
//
//   • Chats — chats whose display name or any participant address/name
//     matches the query.
//   • Messages — individual messages whose text contains the query. Each
//     row shows the owning chat's name and a snippet. Clicking a message
//     row selects its chat AND tells MessageView to scroll to that
//     message (see Zustand's scrollToMessageGuid).
//
// Message search is implemented as an in-memory scan of Dexie's messages
// table. That's fine up to tens of thousands of rows; if it ever feels
// sluggish we can move to a dedicated search index.

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/db';
import { useUIStore } from '@/state/store';
import { useContactMap } from '@/ui/hooks/useContacts';
import { resolveContactName } from '@/utils/contacts';
import { chatDisplayName } from '@/utils/guid';
import { formatShortTime } from '@/utils/time';
import ChatRow from './ChatRow';
import type { StoredChat, StoredMessage } from '@/db/schema';

interface MessageHit {
  message: StoredMessage;
  chat: StoredChat;
  /** Index of the first match in the message text (lowercased). */
  startIdx: number;
}

const MAX_MESSAGE_HITS = 50;

export default function SearchResults({ query }: { query: string }) {
  const q = query.trim().toLowerCase();
  const selectedChatGuid = useUIStore((s) => s.selectedChatGuid);
  const selectChat = useUIStore((s) => s.selectChat);
  const setScrollToMessage = useUIStore((s) => s.setScrollToMessage);
  const contactMap = useContactMap();

  const chats = useLiveQuery<StoredChat[]>(() => db.chats.toArray(), [], []);
  const messages = useLiveQuery<StoredMessage[]>(
    () => db.messages.toArray(),
    [],
    [],
  );

  // Index of chats by guid for O(1) lookups while scanning messages.
  const chatByGuid = useMemo(() => {
    const m = new Map<string, StoredChat>();
    for (const c of chats ?? []) m.set(c.guid, c);
    return m;
  }, [chats]);

  // Matching CHATS — name / participant / contact match.
  const chatHits = useMemo<StoredChat[]>(() => {
    if (!q) return [];
    return (chats ?? []).filter((chat) => {
      const name = chatDisplayName(chat, contactMap).toLowerCase();
      if (name.includes(q)) return true;
      for (const p of chat.participants ?? []) {
        if (p.address.toLowerCase().includes(q)) return true;
        const contactName = resolveContactName(p.address, contactMap).toLowerCase();
        if (contactName.includes(q)) return true;
      }
      return false;
    });
  }, [chats, q, contactMap]);

  // Matching MESSAGES — text contains q. Newest first. Capped.
  const messageHits = useMemo<MessageHit[]>(() => {
    if (!q || !messages) return [];
    const hits: MessageHit[] = [];
    for (const m of messages) {
      const text = (m.text ?? '').toLowerCase();
      if (!text) continue;
      const idx = text.indexOf(q);
      if (idx < 0) continue;
      const chat = chatByGuid.get(m.chatGuid);
      if (!chat) continue;
      hits.push({ message: m, chat, startIdx: idx });
    }
    hits.sort((a, b) => (b.message.dateCreatedMs || 0) - (a.message.dateCreatedMs || 0));
    return hits.slice(0, MAX_MESSAGE_HITS);
  }, [messages, q, chatByGuid]);

  function openMessage(hit: MessageHit) {
    selectChat(hit.chat.guid);
    setScrollToMessage(hit.message.guid);
  }

  if (!q) return null;

  const nothing = chatHits.length === 0 && messageHits.length === 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {nothing && (
        <div className="p-4 text-sm text-slate-500">
          No matches for &ldquo;{query}&rdquo;.
        </div>
      )}

      {chatHits.length > 0 && (
        <>
          <SectionHeader>Chats</SectionHeader>
          {chatHits.map((chat) => (
            <ChatRow
              key={chat.guid}
              chat={chat}
              selected={chat.guid === selectedChatGuid}
              onClick={() => selectChat(chat.guid)}
            />
          ))}
        </>
      )}

      {messageHits.length > 0 && (
        <>
          <SectionHeader>Messages</SectionHeader>
          {messageHits.map((hit) => (
            <MessageHitRow
              key={hit.message.guid}
              hit={hit}
              query={q}
              onClick={() => openMessage(hit)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-white/5">
      {children}
    </div>
  );
}

function MessageHitRow({
  hit,
  query,
  onClick,
}: {
  hit: MessageHit;
  query: string;
  onClick: () => void;
}) {
  const contactMap = useContactMap();
  const title = chatDisplayName(hit.chat, contactMap);
  const time = hit.message.dateCreatedMs ? formatShortTime(hit.message.dateCreatedMs) : '';
  const snippet = buildSnippet(hit.message.text ?? '', hit.startIdx, query.length);

  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-0.5 border-b border-white/5 px-4 py-3 text-left hover:bg-white/5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-slate-100">{title}</span>
        <span className="flex-shrink-0 text-xs text-slate-500">{time}</span>
      </div>
      <div className="truncate text-xs text-slate-400">
        <HighlightedSnippet text={snippet.text} matchStart={snippet.matchStart} matchLen={query.length} />
      </div>
    </button>
  );
}

interface Snippet {
  text: string;
  matchStart: number;
}

/**
 * Build an ~80-char preview window centered on the match.
 * Prepends/appends ellipses when we've chopped the message.
 */
function buildSnippet(full: string, matchIdx: number, matchLen: number): Snippet {
  const WINDOW = 80;
  const half = Math.floor((WINDOW - matchLen) / 2);
  const start = Math.max(0, matchIdx - half);
  const end = Math.min(full.length, start + WINDOW);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < full.length ? '…' : '';
  return {
    text: prefix + full.slice(start, end) + suffix,
    matchStart: prefix.length + (matchIdx - start),
  };
}

function HighlightedSnippet({
  text,
  matchStart,
  matchLen,
}: {
  text: string;
  matchStart: number;
  matchLen: number;
}) {
  const before = text.slice(0, matchStart);
  const match = text.slice(matchStart, matchStart + matchLen);
  const after = text.slice(matchStart + matchLen);
  return (
    <>
      {before}
      <mark className="bg-imessage-blue/40 text-slate-100 rounded-sm px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}
