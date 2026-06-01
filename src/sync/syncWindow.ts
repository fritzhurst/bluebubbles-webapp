// Single source of truth for resolving the persisted "sync window" preference
// into concrete from/to timestamps. Used by both the initial sync (to bound
// the per-chat message pull) and the ConnectionStatus pulldown (to filter the
// chat list and drive on-demand pulls).

import { getSetting, setSetting, SETTING_KEYS } from '@/db/db';
import { DEFAULT_SYNC_WINDOW, type SyncWindowPref } from '@/db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ResolvedWindow {
  /** Lower bound (epoch ms): pull messages created at/after this. */
  afterMs: number;
  /** Upper bound (epoch ms): pull messages created at/before this. */
  beforeMs: number;
}

/**
 * Resolve a window preference into concrete from/to timestamps, or `null` when
 * no window is selected. Presets ('1m'/'2m'/'6m') are relative to `now` and
 * recomputed on every call, so "last 1 month" always means the month leading
 * up to the current sync.
 */
export function resolveSyncWindow(
  pref: SyncWindowPref,
  now: number = Date.now(),
): ResolvedWindow | null {
  switch (pref.range) {
    case 'none':
      return null;
    case 'custom': {
      if (!pref.fromDate || !pref.toDate) return null;
      const from = new Date(pref.fromDate).getTime();
      const to = new Date(pref.toDate).getTime();
      if (Number.isNaN(from) || Number.isNaN(to) || from > to) return null;
      // Include the whole `toDate` day.
      return { afterMs: from, beforeMs: to + DAY_MS - 1 };
    }
    default: {
      const days = pref.range === '1m' ? 30 : pref.range === '2m' ? 60 : 180;
      return { afterMs: now - days * DAY_MS, beforeMs: now };
    }
  }
}

export async function getSyncWindow(): Promise<SyncWindowPref> {
  return (await getSetting<SyncWindowPref>(SETTING_KEYS.SYNC_WINDOW)) ?? DEFAULT_SYNC_WINDOW;
}

export async function setSyncWindow(pref: SyncWindowPref): Promise<void> {
  await setSetting(SETTING_KEYS.SYNC_WINDOW, pref);
}
