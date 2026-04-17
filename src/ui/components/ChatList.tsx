import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { listChats } from '@/db/queries';
import ChatRow from './ChatRow';
import { useUIStore } from '@/state/store';
import { useContactMap } from '@/ui/hooks/useContacts';
import { resolveContactName } from '@/utils/contacts';
import { chatDisplayName } from '@/utils/guid';

export default function ChatList() {
  const chats = useLiveQuery(() => listChats(500), [], []);
  const selectedChatGuid = useUIStore((s) => s.selectedChatGuid);
  const selectChat = useUIStore((s) => s.selectChat);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const viewMode = useUIStore((s) => s.viewMode);
  const contactMap = useContactMap();

  // Filter chats first by view mode (active/archived), then by search.
  const visible = useMemo(() => {
    if (!chats) return undefined;
    const archived = viewMode === 'archived';
    const byMode = chats.filter((c) => !!c.isArchived === archived);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return byMode;
    return byMode.filter((chat) => {
      const name = chatDisplayName(chat, contactMap).toLowerCase();
      if (name.includes(q)) return true;
      for (const p of chat.participants ?? []) {
        if (p.address.toLowerCase().includes(q)) return true;
        const contactName = resolveContactName(p.address, contactMap).toLowerCase();
        if (contactName.includes(q)) return true;
      }
      return false;
    });
  }, [chats, viewMode, searchQuery, contactMap]);

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
