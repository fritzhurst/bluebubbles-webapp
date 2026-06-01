// Ephemeral UI state. Anything DURABLE lives in Dexie.
//
// Keeping this small is deliberate: Dexie's liveQuery drives the UI, and
// Zustand only tracks the bits that don't belong in persistent storage
// (which chat is currently selected, what the composer currently holds,
// and the live connection status).

import { create } from 'zustand';
import type { ConnectionStatus } from '@/api/socket';

interface UIState {
  selectedChatGuid: string | null;
  selectChat: (guid: string | null) => void;

  composerDrafts: Record<string, string>;
  setDraft: (chatGuid: string, text: string) => void;

  connectionStatus: ConnectionStatus;
  connectionDetail: string | null;
  setConnection: (status: ConnectionStatus, detail?: string | null) => void;

  authed: boolean;
  setAuthed: (v: boolean) => void;

  syncState: 'idle' | 'syncing' | 'error';
  syncError: string | null;
  setSync: (s: UIState['syncState'], err?: string | null) => void;

  composeOpen: boolean;
  setComposeOpen: (v: boolean) => void;

  searchOpen: boolean;
  searchQuery: string;
  toggleSearch: () => void;
  setSearchQuery: (q: string) => void;

  viewMode: 'active' | 'archived';
  setViewMode: (m: 'active' | 'archived') => void;

  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;

  currentPage: 'chats' | 'findmy';
  setPage: (p: 'chats' | 'findmy') => void;

  /** Request MessageView to scroll to (and briefly highlight) a message. */
  scrollToMessageGuid: string | null;
  setScrollToMessage: (guid: string | null) => void;

  /**
   * Which chats currently show a "typing" indicator. Ephemeral, server-driven
   * via the `typing-indicator` socket event; auto-cleared by the sync layer
   * after ~15s of silence or when a new message arrives.
   */
  typingByChat: Record<string, true>;
  setTyping: (chatGuid: string, active: boolean) => void;

  /** Time range (in milliseconds from now) to filter chat list. null = show all. */
  historyTimeRangeMs: number | null;
  setHistoryTimeRange: (rangeMs: number | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedChatGuid: null,
  selectChat: (guid) => set({ selectedChatGuid: guid }),

  composerDrafts: {},
  setDraft: (chatGuid, text) =>
    set((prev) => ({ composerDrafts: { ...prev.composerDrafts, [chatGuid]: text } })),

  connectionStatus: 'idle',
  connectionDetail: null,
  setConnection: (status, detail = null) =>
    set({ connectionStatus: status, connectionDetail: detail }),

  authed: false,
  setAuthed: (v) => set({ authed: v }),

  syncState: 'idle',
  syncError: null,
  setSync: (s, err = null) => set({ syncState: s, syncError: err }),

  composeOpen: false,
  setComposeOpen: (v) => set({ composeOpen: v }),

  searchOpen: false,
  searchQuery: '',
  toggleSearch: () =>
    set((prev) => ({
      searchOpen: !prev.searchOpen,
      // Clear the query when closing so reopening is a fresh search.
      searchQuery: prev.searchOpen ? '' : prev.searchQuery,
    })),
  setSearchQuery: (q) => set({ searchQuery: q }),

  viewMode: 'active',
  setViewMode: (m) => set({ viewMode: m }),

  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  currentPage: 'chats',
  setPage: (p) => set({ currentPage: p }),

  scrollToMessageGuid: null,
  setScrollToMessage: (guid) => set({ scrollToMessageGuid: guid }),

  typingByChat: {},
  setTyping: (chatGuid, active) =>
    set((prev) => {
      const existing = !!prev.typingByChat[chatGuid];
      // Short-circuit no-op updates so unrelated subscribers don't re-render.
      if (existing === active) return prev;
      const next = { ...prev.typingByChat };
      if (active) next[chatGuid] = true;
      else delete next[chatGuid];
      return { typingByChat: next };
    }),
  historyTimeRangeMs: null,
  setHistoryTimeRange: (rangeMs) => set({ historyTimeRangeMs: rangeMs }),}));
