import { useEffect, useState, type ChangeEvent } from 'react';
import { useUIStore } from '@/state/store';
import { pullAllChatHistoryRange, type HistoryPullProgress } from '@/sync/historyPull';
import { getSyncWindow, resolveSyncWindow, setSyncWindow } from '@/sync/syncWindow';
import type { SyncWindowPref } from '@/db/schema';
import { useTheme } from '@/ui/hooks/useTheme';

const COLORS: Record<string, string> = {
  idle: 'bg-slate-500',
  connecting: 'bg-amber-500',
  connected: 'bg-emerald-500',
  disconnected: 'bg-slate-500',
  error: 'bg-red-500',
};

const LABELS: Record<string, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  connected: 'Live',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

// Human-readable description of the selected pull window, used in the status
// line so it reflects the chosen range rather than always saying "all".
const RANGE_LABELS: Record<'1m' | '2m' | '6m' | 'custom', string> = {
  '1m': 'the last 1 month',
  '2m': 'the last 2 months',
  '6m': 'the last 6 months',
  custom: 'the selected date range',
};

export default function ConnectionStatusBadge() {
  const status = useUIStore((s) => s.connectionStatus);
  const detail = useUIStore((s) => s.connectionDetail);
  const setHistoryTimeRange = useUIStore((s) => s.setHistoryTimeRange);
  const [theme, , toggleTheme] = useTheme();
  const [historyRange, setHistoryRange] = useState<'none' | '1m' | '2m' | '6m' | 'custom'>('none');
  const [fromDate, setFromDate] = useState(() =>
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [historyStatus, setHistoryStatus] = useState<string | null>(null);
  const [pullingHistory, setPullingHistory] = useState(false);
  const [progress, setProgress] = useState<HistoryPullProgress | null>(null);

  // Restore the persisted sync window on mount so the dropdown, the chat-list
  // filter, and (via initialSync) the data actually pulled all stay in sync
  // across reloads.
  useEffect(() => {
    void (async () => {
      const pref = await getSyncWindow();
      setHistoryRange(pref.range);
      if (pref.range === 'custom') {
        if (pref.fromDate) setFromDate(pref.fromDate);
        if (pref.toDate) setToDate(pref.toDate);
      }
      const resolved = resolveSyncWindow(pref);
      setHistoryTimeRange(resolved ? resolved.afterMs : null);
    })();
  }, [setHistoryTimeRange]);

  const loadHistory = async (range: '1m' | '2m' | '6m' | 'custom') => {
    if (range === 'custom') {
      const start = new Date(fromDate).getTime();
      const end = new Date(toDate).getTime();
      if (!fromDate || !toDate || Number.isNaN(start) || Number.isNaN(end)) {
        setHistoryStatus('Choose valid dates.');
        return;
      }
      if (start > end) {
        setHistoryStatus('Start date must be before end date.');
        return;
      }
    }

    const pref: SyncWindowPref =
      range === 'custom' ? { range, fromDate, toDate } : { range };
    const resolved = resolveSyncWindow(pref);
    if (!resolved) return; // guarded above; satisfies the type narrowing

    setPullingHistory(true);
    setHistoryStatus(`Pulling ${RANGE_LABELS[range]} of history across all chats…`);
    setProgress(null);
    setHistoryTimeRange(resolved.afterMs);
    // Persist so the next connect's initial sync honors the same window.
    await setSyncWindow(pref);
    try {
      const count = await pullAllChatHistoryRange(resolved.afterMs, resolved.beforeMs, setProgress);
      setHistoryStatus(`Pulled ${count} messages from ${RANGE_LABELS[range]}.`);
      setHistoryRange(range);
    } catch (error) {
      console.error('[ConnectionStatus] history pull failed', error);
      setHistoryStatus(
        error instanceof Error ? error.message : 'Failed to pull history. Check the console.',
      );
    } finally {
      setPullingHistory(false);
      setProgress(null);
    }
  };

  const handleRangeChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as typeof historyRange;
    setHistoryRange(value);
    if (value === 'custom') {
      setHistoryStatus('Choose dates and click Pull to start the history reload.');
      return;
    }
    if (value !== 'none') {
      await loadHistory(value);
    }
  };

  return (
    <div className="border-b border-white/10">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs text-slate-400">
        <span className={`h-2 w-2 rounded-full ${COLORS[status] ?? 'bg-slate-500'}`} />
        <span>{LABELS[status] ?? status}</span>

        {detail && status === 'error' && (
          <span className="min-w-0 truncate text-slate-500" title={detail}>
            {detail}
          </span>
        )}

        {pullingHistory && (
          <svg
            className="h-4 w-4 animate-spin text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        <button
          onClick={() => toggleTheme()}
          className="ml-auto h-5 w-5 rounded-full text-slate-400 hover:text-slate-200 flex items-center justify-center flex-shrink-0"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle light / dark mode"
        >
          {theme === 'dark' ? (
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
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
              <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" />
              <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" />
            </svg>
          ) : (
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
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-2 text-xs text-slate-400">
        <select
          value={historyRange}
          onChange={handleRangeChange}
          disabled={pullingHistory}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-imessage-blue"
        >
          <option value="none">Pull history</option>
          <option value="1m">Last 1 month</option>
          <option value="2m">Last 2 months</option>
          <option value="6m">Last 6 months</option>
          <option value="custom">Custom range</option>
        </select>
        <button
          type="button"
          onClick={() => {
            if (historyRange === 'custom') {
              void loadHistory('custom');
            } else if (historyRange !== 'none') {
              void loadHistory(historyRange);
            }
          }}
          disabled={pullingHistory || historyRange === 'none'}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          title={historyRange === 'none' ? 'Choose a range first' : 'Refresh history pull'}
        >
          Refresh
        </button>
        {historyRange !== 'none' && (
          <button
            type="button"
            onClick={() => {
              setHistoryTimeRange(null);
              setHistoryRange('none');
              setHistoryStatus(null);
              void setSyncWindow({ range: 'none' });
            }}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
            title="Clear filter and show all chats"
          >
            Clear filter
          </button>
        )}
      </div>
      {historyRange === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-t border-white/5">
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-imessage-blue"
            disabled={pullingHistory}
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-imessage-blue"
            disabled={pullingHistory}
          />
          <button
            type="button"
            onClick={() => void loadHistory('custom')}
            disabled={pullingHistory}
            className="rounded-lg bg-imessage-blue px-3 py-1 text-xs font-medium text-slate-100 hover:bg-imessage-blue/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Pull
          </button>
        </div>
      )}
      {pullingHistory && progress ? (
        <div className="px-4 py-2 text-xs text-slate-500 border-t border-white/5">
          {historyStatus} {progress.chatsDone}/{progress.chatsTotal} chats ·{' '}
          {progress.messagesPulled} messages
        </div>
      ) : (
        historyStatus && (
          <div className="px-4 py-2 text-xs text-slate-500 border-t border-white/5">
            {historyStatus}
          </div>
        )
      )}
    </div>
  );
}
