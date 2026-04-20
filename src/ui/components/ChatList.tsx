import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { listChats } from '@/db/queries';
import ChatRow from './ChatRow';
import SearchResults from './SearchResults';
import { useUIStore } from '@/state/store';

export default function ChatList() {
  const chats = useLiveQuery(() => listChats(500), [], []);
  const selectedChatGuid = useUIStore((s) => s.selectedChatGuid);
  const selectChat = useUIStore((s) => s.selectChat);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const viewMode = useUIStore((s) => s.viewMode);

  // Filter by view mode (active vs archived). Done unconditionally so the
  // hook call count is stable across renders.
  const visible = useMemo(() => {
    if (!chats) return undefined;
    const archived = viewMode === 'archived';
    return chats.filter((c) => !!c.isArchived === archived);
  }, [chats, viewMode]);

  // When searching, hand off to SearchResults which also scans messages.
  if (searchQuery.trim()) {
    return <SearchResults query={searchQuery} />;
  }

  if (!visible) {
    return <div className="p-4 text-sm text-slate-500">Loading chats…</div>;
  }

  if (visible.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        {searchQuery
          ? `No chats match "${searchQuery}".`
          : viewMode === 'archived'
            ? 'No archived chats.'
            : 'No chats yet. If you just logged in, the initial sync is still in progress.'}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {visible.map((chat) => (
        <ChatRow
          key={chat.guid}
          chat={chat}
          selected={chat.guid === selectedChatGuid}
          onClick={() => selectChat(chat.guid)}
        />
      ))}
    </div>
  );
}
