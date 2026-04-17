// Expandable chat-list search. Clicking the magnifying-glass button
// toggles an inline input that filters the ChatList through the Zustand
// `searchQuery` state. Press Escape to close.

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/state/store';

export default function SearchBar() {
  const searchOpen = useUIStore((s) => s.searchOpen);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const toggleSearch = useUIStore((s) => s.toggleSearch);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);

  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  if (!searchOpen) return null;

  return (
    <div className="border-b border-white/10 px-3 py-2">
      <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-imessage-blue">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-slate-400"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') toggleSearch();
          }}
          placeholder="Search chats, contacts, phones"
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-slate-400 hover:text-slate-200 text-sm"
            aria-label="Clear search"
            title="Clear"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
