// Live device tracker — opens in its own browser tab and polls the BB
// server every ~30s for a fresh location. Refreshes the embedded
// OpenStreetMap iframe whenever the coordinates change so you can watch
// a moving AirTag update over time.

import { useEffect, useRef, useState } from 'react';
import {
  deviceTitle,
  formatAddressFull,
  listFindMyDevices,
  refreshFindMyDevices,
} from '@/api/findmy';
import type { FindMyDevice } from '@/api/findmy';

const POLL_INTERVAL_MS = 30_000;

interface Props {
  deviceId: string;
}

export default function LiveDeviceMap({ deviceId }: Props) {
  const [device, setDevice] = useState<FindMyDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [manuallyRefreshing, setManuallyRefreshing] = useState<boolean>(false);

  async function fetchOnce(fresh: boolean) {
    try {
      // Manual refresh may ask the server to re-pull from FindMy (expensive,
      // sometimes returns a different envelope shape). Auto-refresh always
      // uses the cheap GET — current data is returned either way.
      let list: FindMyDevice[] | undefined;
      if (fresh) {
        try {
          list = await refreshFindMyDevices();
        } catch (err) {
          console.warn('[LiveDeviceMap] /refresh failed, falling back to /devices', err);
        }
      }
      if (!Array.isArray(list)) {
        list = await listFindMyDevices();
      }
      if (!Array.isArray(list)) {
        setError('Unexpected response from the FindMy endpoint.');
        return;
      }
      const match = list.find((d) => d.id === deviceId);
      if (!match) {
        setError('Device not found in the current FindMy list.');
        return;
      }
      setDevice(match);
      setLastUpdatedAt(Date.now());
      setError(null);
    } catch (err) {
      console.warn('[LiveDeviceMap] fetch failed', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Initial load.
  useEffect(() => {
    fetchOnce(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  // Auto-refresh loop. Uses the plain GET, not the refresh POST — that one
  // is reserved for the manual button.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => fetchOnce(false), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, deviceId]);

  async function onManualRefresh() {
    setManuallyRefreshing(true);
    await fetchOnce(true);
    setManuallyRefreshing(false);
  }

  const lat = device?.location?.latitude ?? null;
  const lng = device?.location?.longitude ?? null;
  const hasLocation = lat != null && lng != null;

  // iframe key forces a reload whenever coordinates change — that's how
  // we visually "move" the marker without any JS map library. The key is
  // the rounded coords, so tiny GPS jitter within a ~1m radius doesn't
  // cause a flash of reload every 30s.
  const iframeKey =
    hasLocation
      ? `${(lat as number).toFixed(5)}_${(lng as number).toFixed(5)}`
      : 'empty';

  const delta = 0.003;
  const src = hasLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${
        (lng as number) - delta
      }%2C${(lat as number) - delta}%2C${(lng as number) + delta}%2C${(lat as number) + delta}&layer=mapnik&marker=${lat}%2C${lng}`
    : '';

  // Set the tab title to the device name so tab switchers are useful.
  useEffect(() => {
    if (device) {
      document.title = `${deviceTitle(device)} · Find My`;
    }
  }, [device]);

  const stale = device?.location?.isOld;
  const lastSeen = device?.location?.timeStamp
    ? new Date(device.location.timeStamp).toLocaleString()
    : null;
  const pollSecondsAgo = lastUpdatedAt
    ? Math.round((Date.now() - lastUpdatedAt) / 1000)
    : null;

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">
            {device ? deviceTitle(device) : 'Live device'}
          </h1>
          <div className="truncate text-xs text-slate-400">
            {device?.address ? formatAddressFull(device.address) : '—'}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Auto-refresh
          </label>
          <button
            onClick={onManualRefresh}
            disabled={manuallyRefreshing}
            className="text-imessage-blue hover:text-blue-400 disabled:opacity-50"
            title="Refresh now"
            aria-label="Refresh now"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-5 w-5 ${manuallyRefreshing ? 'animate-spin' : ''}`}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 bg-slate-900">
        {error && (
          <div className="m-4 rounded-md bg-red-500/10 p-3 text-xs text-red-300 ring-1 ring-red-500/20">
            {error}
          </div>
        )}
        {hasLocation ? (
          <iframe
            key={iframeKey}
            title={device ? deviceTitle(device) : 'device'}
            src={src}
            className="h-full w-full border-0"
          />
        ) : !error ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Waiting for location…
          </div>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-2 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          {device?.batteryLevel != null && (
            <span>
              Battery {Math.round(device.batteryLevel * 100)}%
              {device.batteryStatus === 'Charging' ? ' ⚡' : ''}
            </span>
          )}
          {device?.location?.positionType && (
            <span>Source: {device.location.positionType}</span>
          )}
          {stale && <span className="text-amber-300">(stale location)</span>}
        </div>
        <div className="flex items-center gap-3">
          {lastSeen && <span>Device last seen: {lastSeen}</span>}
          {pollSecondsAgo != null && <span>Polled: {pollSecondsAgo}s ago</span>}
        </div>
      </footer>
    </div>
  );
}
