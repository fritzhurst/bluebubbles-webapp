// Main application shell. Wires together:
//   - the socket connection
//   - the initial sync on first entry
//   - the incremental sync on every socket reconnect
//   - the two-pane layout (chat list | message view)
//
// Everything below is "dumb" — it reads from Dexie via `useLiveQuery` and
// writes to Dexie via upserts. There's no cache invalidation to think about.

import { useEffect, useRef, useState } from 'react';
import { getSetting, SETTING_KEYS } from '@/db/db';
import { SocketManager, type ConnectionStatus } from '@/api/socket';
import { applySocketEvent } from '@/sync/socketHandlers';
import { runInitialSync, type InitialSyncProgress } from '@/sync/initialSync';
import { runIncrementalSync } from '@/sync/incrementalSync';
import { useUIStore } from '@/state/store';
import ChatList from '@/ui/components/ChatList';
import MessageView from '@/ui/components/MessageView';
import ConnectionStatusBadge from '@/ui/components/ConnectionStatus';
import EmptyState from '@/ui/components/EmptyState';
import NewMessageDialog from '@/ui/components/NewMessageDialog';
import SearchBar from '@/ui/components/SearchBar';
import SettingsDialog from '@/ui/components/SettingsDialog';
import SidebarMenu from '@/ui/components/SidebarMenu';
import FindMyPage from '@/ui/pages/FindMy';
import { ContactMapProvider } from '@/ui/hooks/useContacts';

export default function Main() {
  const setConnection = useUIStore((s) => s.setConnection);
  const setSync = useUIStore((s) => s.setSync);
  const selectedChatGuid = useUIStore((s) => s.selectedChatGuid);
  const setComposeOpen = useUIStore((s) => s.setComposeOpen);

  const [progress, setProgress] = useState<InitialSyncProgress | null>(null);
  const socketRef = useRef<SocketManager | null>(null);
  const hasRunInitialSyncRef = useRef(false);
  const toggleSearch = useUIStore((s) => s.toggleSearch);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const currentPage = useUIStore((s) => s.currentPage);

  // On mount: open the socket and kick off initial sync.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [url, password] = await Promise.all([
        getSetting<string>(SETTING_KEYS.SERVER_URL),
        getSetting<string>(SETTING_KEYS.SERVER_PASSWORD),
      ]);
      if (!url || !password || cancelled) return;

      // --- socket ---
      const manager = new SocketManager(url, password, {
        onStatus: (status: ConnectionStatus, detail) => {
          setConnection(status, detail ?? null);
          if (status === 'connected') {
            // On every reconnect, pull anything we missed.
            runIncrementalSync().catch((err) =>
              console.warn('[Main] incremental sync failed', err),
            );
          }
        },
        onEvent: (name, payload) => {
          applySocketEvent(name, payload);
        },
      });
      socketRef.current = manager;
      manager.connect();

      // --- initial sync (once per session) ---
      if (!hasRunInitialSyncRef.current) {
        hasRunInitialSyncRef.current = true;
        setSync('syncing');
        try {
          await runInitialSync((p) => setProgress(p));
          setSync('idle');
        } catch (err) {
          console.error('[Main] initial sync failed', err);
          setSync('error', String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the user navigates to a sub-page (FindMy), replace the whole
  // chats layout. The page itself owns its own back button.
  if (currentPage === 'findmy') {
    return (
      <ContactMapProvider>
        <FindMyPage />
        {/* Keep dialogs mounted so they can still be opened if somehow
         *  triggered — cheap and prevents cross-page state surprises. */}
        <NewMessageDialog />
        <SettingsDialog />
      </ContactMapProvider>
    );
  }

  return (
    <ContactMapProvider>
      <div className="flex h-full bg-slate-950 text-slate-100">
        {/* Left pane: chat list */}
        <aside className="relative flex h-full w-80 flex-col border-r border-white/10 bg-slate-900/60">
          {viewMode === 'archived' ? (
            <header className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <button
                onClick={() => setViewMode('active')}
                className="text-imessage-blue hover:text-blue-400 flex items-center"
                title="Back to Messages"
                aria-label="Back to Messages"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <h1 className="flex-1 text-center text-lg font-semibold">Archive</h1>
              {/* Invisible spacer so the title is true-centered despite the back button */}
              <span className="h-5 w-5" aria-hidden="true" />
            </header>
          ) : (
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h1 className="text-2xl font-semibold">Messages</h1>
              <div className="flex items-center gap-2">
                {/* Search toggle */}
                <button
                  onClick={toggleSearch}
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    searchOpen
                      ? 'bg-imessage-blue text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                  title="Search"
                  aria-label="Search chats"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
                <SidebarMenu />
              </div>
            </header>
          )}

          <SearchBar />
          <ConnectionStatusBadge />

          {progress && progress.phase !== 'done' && (
            <div className="border-b border-white/10 px-4 py-2 text-xs text-slate-400">
              Syncing: {progress.phase} · {progress.chatsPulled} chats ·{' '}
              {progress.messagesPulled} messages ·{' '}
              {progress.contactsPulled} contacts
            </div>
          )}

          <ChatList />

          {/*
           * Floating Compose button, pinned to the bottom-right of the chat
           * list. Hidden in the Archive view where composing doesn't apply.
           */}
          {viewMode !== 'archived' && (
            <button
              onClick={() => setComposeOpen(true)}
              className="absolute bottom-4 right-4 h-12 w-12 rounded-full bg-imessage-blue text-white shadow-lg ring-1 ring-black/20 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white/50 flex items-center justify-center"
              title="New message"
              aria-label="Compose new message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M4 20h4l10.5-10.5a2.121 2.121 0 0 0-3-3L5 17v3z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
            </button>
          )}
        </aside>

        {/* Right pane: selected chat */}
        <main className="flex flex-1 flex-col">
          {selectedChatGuid ? (
            <MessageView chatGuid={selectedChatGuid} />
          ) : (
            <EmptyState />
          )}
        </main>

        {/* Modal overlays; each renders only when its open flag is true. */}
        <NewMessageDialog />
        <SettingsDialog />
      </div>
    </ContactMapProvider>
  );
}
