// Find My devices + items view.
//
// Layout mirrors the official BlueBubbles web client:
//   - Back arrow (returns to chats), centered title, refresh icon
//   - Sections: DEVICES (phones/Macs), ITEMS (AirTag-style), UNKNOWN LOCATION
//   - Bottom toggle: List | Map
//
// The Map view uses OpenStreetMap tiles via Leaflet. Leaflet isn't in our
// dependency tree yet — the Map tab falls back to an "install leaflet"
// notice so the List view works regardless.

import { useEffect, useState } from 'react';
import {
  deviceTitle,
  formatAddressFull,
  formatAddressShort,
  listFindMyDevices,
  refreshFindMyDevices,
} from '@/api/findmy';
import type { FindMyDevice } from '@/api/findmy';
import { buildLiveDeviceUrl } from '@/utils/route';
import { useUIStore } from '@/state/store';

type Tab = 'list' | 'map';

export default function FindMyPage() {
  const setPage = useUIStore((s) => s.setPage);

  const [devices, setDevices] = useState<FindMyDevice[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('list');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  async function load(fresh = false) {
    setError(null);
    if (fresh) setRefreshing(true);
    else setLoading(true);
    try {
      const list = fresh ? await refreshFindMyDevices() : await listFindMyDevices();
      setDevices(list);
    } catch (err) {
      console.warn('[FindMy] fetch failed', err);
      setError(err instanceof Error ? err.message : String(err));
      setDevices(devices ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split into three groups to match the official layout.
  const groups = groupDevices(devices ?? []);

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          onClick={() => setPage('chats')}
          className="text-imessage-blue hover:text-blue-400"
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
            className="h-6 w-6"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">FindMy</h1>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-imessage-blue hover:text-blue-400 disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`}
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && !devices ? (
          <div className="p-6 text-center text-slate-400 text-sm">Loading…</div>
        ) : error && (!devices || devices.length === 0) ? (
          <div className="p-6 text-center text-red-300 text-sm">{error}</div>
        ) : tab === 'list' ? (
          <ListView groups={groups} />
        ) : (
          <MapView devices={devices ?? []} />
        )}
      </div>

      <footer className="flex items-center justify-around border-t border-white/10 bg-slate-900/60 py-2">
        <TabButton active={tab === 'list'} onClick={() => setTab('list')} label="LIST">
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
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="3.5" cy="6" r="1" />
            <circle cx="3.5" cy="12" r="1" />
            <circle cx="3.5" cy="18" r="1" />
          </svg>
        </TabButton>
        <TabButton active={tab === 'map'} onClick={() => setTab('map')} label="MAP">
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
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        </TabButton>
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-6 py-1 rounded-md ${
        active ? 'text-imessage-blue' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
      <span className="text-[10px] tracking-wider">{label}</span>
    </button>
  );
}

interface Groups {
  devices: FindMyDevice[];
  items: FindMyDevice[];
  unknown: FindMyDevice[];
}

function groupDevices(all: FindMyDevice[]): Groups {
  const groups: Groups = { devices: [], items: [], unknown: [] };
  for (const d of all) {
    const hasLocation = !!(d.location?.latitude && d.location?.longitude);
    if (!hasLocation) {
      groups.unknown.push(d);
      continue;
    }
    if (d.isConsideredAccessory) groups.items.push(d);
    else groups.devices.push(d);
  }
  return groups;
}

function ListView({ groups }: { groups: Groups }) {
  const anyContent =
    groups.devices.length > 0 || groups.items.length > 0 || groups.unknown.length > 0;
  if (!anyContent) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
        No Find My data. The BB Server needs the Contacts Helper / iCloud login
        for this to work.
      </div>
    );
  }
  return (
    <div className="px-4 py-4 space-y-4">
      {groups.devices.length > 0 && (
        <Section title="DEVICES">
          {groups.devices.map((d, i) => (
            <DeviceRow key={d.id ?? i} device={d} />
          ))}
        </Section>
      )}
      {groups.items.length > 0 && (
        <Section title="ITEMS">
          {groups.items.map((d, i) => (
            <DeviceRow key={d.id ?? i} device={d} />
          ))}
        </Section>
      )}
      {groups.unknown.length > 0 && (
        <Section title="UNKNOWN LOCATION">
          {groups.unknown.map((d, i) => (
            <DeviceRow key={d.id ?? i} device={d} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <div className="rounded-xl bg-slate-900 ring-1 ring-white/10 divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function DeviceRow({ device }: { device: FindMyDevice }) {
  const name = deviceTitle(device);
  const addrShort = formatAddressShort(device.address);
  const battery = formatBattery(device);
  const lastSeen = formatLastSeen(device.location?.timeStamp);
  const hasLocation = !!(
    device.location?.latitude != null && device.location?.longitude != null
  );
  const liveHref = hasLocation && device.id ? buildLiveDeviceUrl(device.id) : null;
  return (
    <div className="px-4 py-3">
      {liveHref ? (
        <a
          href={liveHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-slate-100 hover:text-imessage-blue hover:underline"
          title="Open live tracker in new tab"
        >
          {name}
        </a>
      ) : (
        <div className="text-sm font-medium text-slate-100">{name}</div>
      )}
      <div className="text-xs text-slate-400 truncate">
        {addrShort || 'No location reported'}
        {lastSeen && ` - Last Seen: ${lastSeen}`}
        {battery && ` - Battery: ${battery}`}
      </div>
    </div>
  );
}

/**
 * Format an Apple FindMy timestamp (ms since epoch) as "Monday 04/20/2026 at 11:58AM".
 * Returns empty string for missing / invalid timestamps.
 */
function formatLastSeen(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const date = d.toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  // 12-hour clock with AM/PM stuck directly to the minutes (no space).
  const time = d
    .toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/\s*(AM|PM)$/i, (_, p) => p.toUpperCase());
  return `${weekday} ${date} at ${time}`;
}

/**
 * Render battery info safely:
 *  - iPhones / Macs / iPads: `batteryLevel` is a decimal 0.0–1.0 →
 *    render as a percentage, annotate with ⚡ while charging.
 *  - AirTags and other accessory items: `batteryLevel` is a small
 *    integer enum (1–5) and `batteryStatus` is usually "Unknown" →
 *    translate the enum to a friendly label.
 */
function formatBattery(device: FindMyDevice): string {
  const lvl = device.batteryLevel;
  const status = device.batteryStatus;

  // AirTag-style accessories: integer enum, not a fraction.
  if (device.isConsideredAccessory && typeof lvl === 'number' && Number.isInteger(lvl)) {
    return AIRTAG_BATTERY_LABELS[lvl] ?? '';
  }

  // Real devices: decimal fraction → percentage.
  if (lvl != null && lvl >= 0 && lvl <= 1) {
    const pct = `${Math.round(lvl * 100)}%`;
    return status === 'Charging' ? `${pct} ⚡` : pct;
  }

  // Fallback: surface the status string if it carries signal.
  if (
    typeof status === 'string' &&
    status &&
    status !== 'NotCharging' &&
    status !== 'Unknown'
  ) {
    return status.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return '';
}

// Apple's CRBatteryIndicationType-ish enum for AirTag-class items.
// Values are what BB Server passes through from the FindMy database.
const AIRTAG_BATTERY_LABELS: Record<number, string> = {
  0: '', // Unknown / no data — no label
  1: 'Full',
  2: 'Medium',
  3: 'Low',
  4: 'Very Low',
  5: 'Needs Replacement',
};

function MapView({ devices }: { devices: FindMyDevice[] }) {
  const located = devices.filter(
    (d) => d.location?.latitude != null && d.location?.longitude != null,
  );
  if (located.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
        Nothing to show on the map.
      </div>
    );
  }
  // Lightweight static embed: OpenStreetMap export with one marker per
  // device. Not a pannable map — that would require Leaflet — but good
  // enough to see locations at a glance without a new dependency.
  return (
    <div className="p-4 space-y-3">
      <div className="text-xs text-slate-400">
        Showing {located.length} device{located.length === 1 ? '' : 's'}.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {located.map((d, i) => (
          <MiniMap key={d.id ?? i} device={d} />
        ))}
      </div>
    </div>
  );
}

function MiniMap({ device }: { device: FindMyDevice }) {
  const lat = device.location?.latitude ?? 0;
  const lng = device.location?.longitude ?? 0;
  const name = deviceTitle(device);
  const liveHref = device.id ? buildLiveDeviceUrl(device.id) : null;
  // OSM embed with a small bbox around the point and a visible marker.
  const delta = 0.005;
  const bbox = `${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  return (
    <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-slate-900">
      <iframe
        title={`Map for ${name}`}
        src={src}
        className="w-full h-48 border-0"
        loading="lazy"
      />
      <div className="px-3 py-2 text-xs">
        {liveHref ? (
          <a
            href={liveHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-100 hover:text-imessage-blue hover:underline"
            title="Open live tracker in new tab"
          >
            {name}
          </a>
        ) : (
          <div className="font-medium text-slate-100">{name}</div>
        )}
        <div className="text-slate-400 truncate">{formatAddressFull(device.address)}</div>
      </div>
    </div>
  );
}
