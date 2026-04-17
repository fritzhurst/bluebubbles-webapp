import type { StoredChat } from '@/db/schema';
import { chatDisplayName } from '@/utils/guid';
import { formatShortTime } from '@/utils/time';
import { useContactMap } from '@/ui/hooks/useContacts';
import ChatAvatar from './ChatAvatar';

interface Props {
  chat: StoredChat;
  selected: boolean;
  onClick: () => void;
}

export default function ChatRow({ chat, selected, onClick }: Props) {
  const contactMap = useContactMap();
  const title = chatDisplayName(chat, contactMap);
  const preview = chat.lastMessage?.text ?? '';
  const timestamp = chat.sortTimestamp ? formatShortTime(chat.sortTimestamp) : '';

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition
        ${selected ? 'bg-imessage-blue/20' : 'hover:bg-white/5'}
        border-b border-white/5`}
    >
      <ChatAvatar chat={chat} contactMap={contactMap} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-slate-100">{title}</span>
          <span className="text-xs text-slate-500 flex-shrink-0">{timestamp}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-slate-400">{preview || '—'}</span>
          {chat.hasUnread && (
            <span className="ml-auto h-2 w-2 rounded-full bg-imessage-blue flex-shrink-0" />
          )}
        </div>
      </div>
    </button>
  );
}
