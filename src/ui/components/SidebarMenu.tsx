// Three-dot menu in the sidebar header.
//
// Items (matching the official BlueBubbles web app):
//   - Mark All As Read: local-only (BB Server's read endpoint is Private-API-only)
//   - Archived: toggle the chat list between active and archived views
//   - FindMy: placeholder — BB Server doesn't surface Find My
//   - Settings: opens a small info modal
//   - Logout: wipes local DB and returns to login

import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/state/store';
import { useAuth } from '@/ui/hooks/useAuth';
import { db } from '@/db/db';

export default function SidebarMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setPage = useUIStore((s) => s.setPage);
  const { logout } = useAuth();

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function markAllAsRead() {
    setOpen(false);
    // Flip hasUnread=false on all chats locally. Can't easily push to the
    // server without Private API, but the UI consistency is what matters.
    const unread = await db.chats.where('hasUnread').equals(1).toArray();
    // Dexie boolean index may store true as 1 or true depending on path;
    // fall back to a scan if the above returned nothing but rows exist.
    const rows = unread.length > 0 ? unread : await db.chats.toArray();
    const updates = rows
      .filter((c) => c.hasUnread)
      .map((c) => ({ ...c, hasUnread: false }));
    if (updates.length > 0) await db.chats.bulkPut(updates);
  }

  function toggleArchived() {
    setOpen(false);
    setViewMode(viewMode === 'archived' ? 'active' : 'archived');
  }

  function findMy() {
    setOpen(false);
    setPage('findmy');
  }

  function openSettings() {
    setOpen(false);
    setSettingsOpen(true);
  }

  async function onLogout() {
    setOpen(false);
    await logout();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center"
        aria-label="Menu"
        title="More"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4"
        >
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-slate-800 shadow-2xl ring-1 ring-white/10 z-20 py-1 text-sm">
          <MenuItem onClick={markAllAsRead}>Mark All As Read</MenuItem>
          <MenuItem onClick={toggleArchived}>
            {viewMode === 'archived' ? 'Active Chats' : 'Archived'}
          </MenuItem>
          <MenuItem onClick={findMy}>FindMy</MenuItem>
          <MenuItem onClick={openSettings}>Settings</MenuItem>
          <div className="my-1 h-px bg-white/10" />
          <MenuItem onClick={onLogout}>Logout</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2 text-left text-slate-200 hover:bg-white/5 focus:bg-white/5 focus:outline-none"
    >
      {children}
    </button>
  );
}
