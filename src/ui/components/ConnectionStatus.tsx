import { useUIStore } from '@/state/store';
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

export default function ConnectionStatusBadge() {
  const status = useUIStore((s) => s.connectionStatus);
  const detail = useUIStore((s) => s.connectionDetail);
  const [theme, , toggleTheme] = useTheme();

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400 border-b border-white/10">
      <span className={`h-2 w-2 rounded-full ${COLORS[status] ?? 'bg-slate-500'}`} />
      <span>{LABELS[status] ?? status}</span>

      {detail && status === 'error' && (
        <span className="truncate text-slate-500" title={detail}>
          {detail}
        </span>
      )}

      {/* Theme toggle pinned to the right edge. */}
      <button
        onClick={() => toggleTheme()}
        className="ml-auto h-5 w-5 rounded-full text-slate-400 hover:text-slate-200 flex items-center justify-center flex-shrink-0"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label="Toggle light / dark mode"
      >
        {theme === 'dark' ? (
          /* Sun icon — clicking switches to light */
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
          /* Moon icon — clicking switches to dark */
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
  );
}
