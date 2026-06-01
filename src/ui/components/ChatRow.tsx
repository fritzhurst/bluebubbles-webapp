import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { StoredChat } from '@/db/schema';
import { chatDisplayName } from '@/utils/guid';
import { formatShortTime } from '@/utils/time';
import { useContactMap } from '@/ui/hooks/useContacts';
import ChatAvatar from './ChatAvatar';
import { upsertChat } from '@/db/db';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (event: globalThis.MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const togglePinned = async (event?: ReactMouseEvent<HTMLButtonElement>): Promise<void> => {
    event?.stopPropagation();
    setMenuOpen(false);
    await upsertChat({ ...chat, pinned: !chat.pinned });
  };

  const handleMenuToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setMenuOpen((open) => !open);
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setMenuOpen((open) => !open);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition cursor-pointer
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
          {chat.pinned && (
            <span className="text-emerald-400 text-sm">📌</span>
          )}
          <span className="truncate text-sm text-slate-400">{preview || '—'}</span>
          {chat.hasUnread && (
            <span className="ml-auto h-2 w-2 rounded-full bg-imessage-blue flex-shrink-0" />
          )}
        </div>
      </div>
      <div ref={menuRef} className="relative flex shrink-0 items-center">
        <button
          onClick={handleMenuToggle}
          onKeyDown={handleMenuKeyDown}
          className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center"
          aria-label="Chat options"
          title="Chat options"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4"
          >
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-slate-800 shadow-2xl ring-1 ring-white/10 z-20 py-1 text-sm">
            <button
              onClick={togglePinned}
              className="w-full px-3 py-2 text-left text-slate-200 hover:bg-white/5 focus:bg-white/5 focus:outline-none"
            >
              {chat.pinned ? 'Unpin conversation' : 'Pin conversation'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
