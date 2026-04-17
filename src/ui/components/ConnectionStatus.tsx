import { useUIStore } from '@/state/store';

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

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400 border-b border-white/10">
      <span className={`h-2 w-2 rounded-full ${COLORS[status] ?? 'bg-slate-500'}`} />
      <span>{LABELS[status] ?? status}</span>
      {detail && status === 'error' && (
        <span className="ml-auto truncate text-slate-500" title={detail}>
          {detail}
        </span>
      )}
    </div>
  );
}
