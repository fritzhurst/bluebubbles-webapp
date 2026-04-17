// Simple settings modal. Shows server URL + server info + local DB stats.
// Future additions: theme toggle, attachment cache eviction, manual
// refresh of contacts/chats, etc.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, SETTING_KEYS } from '@/db/db';
import { useUIStore } from '@/state/store';
import type { ServerInfo } from '@/types/bluebubbles';

export default function SettingsDialog() {
  const open = useUIStore((s) => s.settingsOpen);
  const setOpen = useUIStore((s) => s.setSettingsOpen);

  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [url, info] = await Promise.all([
        getSetting<string>(SETTING_KEYS.SERVER_URL),
        getSetting<ServerInfo>(SETTING_KEYS.SERVER_INFO),
      ]);
      setServerUrl(url ?? null);
      setServerInfo(info ?? null);
    })();
  }, [open]);

  // Live counts for the local tables — reassuring to see persistence working.
  const counts = useLiveQuery(
    async () => ({
      chats: await db.chats.count(),
      messages: await db.messages.count(),
      contacts: await db.contacts.count(),
      avatars: await db.contactAvatars.count(),
      attachments: await db.attachmentBlobs.count(),
    }),
    [],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-20"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="text-base font-semibold text-slate-100">Settings</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-100 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <Section title="Server">
            <Row label="URL" value={serverUrl ?? '—'} />
            <Row label="BB Server version" value={serverInfo?.server_version ?? '—'} />
            <Row label="macOS" value={serverInfo?.os_version ?? '—'} />
            <Row
              label="Private API"
              value={serverInfo?.private_api ? 'Enabled' : 'Disabled'}
            />
            <Row
              label="Helper connected"
              value={serverInfo?.helper_connected ? 'Yes' : 'No'}
            />
          </Section>

          <Section title="Local cache">
            <Row label="Chats" value={counts ? String(counts.chats) : '…'} />
            <Row label="Messages" value={counts ? String(counts.messages) : '…'} />
            <Row label="Contacts" value={counts ? String(counts.contacts) : '…'} />
            <Row label="Avatars" value={counts ? String(counts.avatars) : '…'} />
            <Row
              label="Cached attachments"
              value={counts ? String(counts.attachments) : '…'}
            />
          </Section>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg bg-imessage-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <div className="rounded-lg bg-slate-800/50 ring-1 ring-white/5 divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100 truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}
