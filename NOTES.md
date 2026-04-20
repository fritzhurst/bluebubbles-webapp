# BlueBubbles Web — Project Notes

Session summary, deployment workflow, and known issues.

---

## What we built

A local-first web client for BlueBubbles Server, deployed at
`https://bluebubbles-web.fritzhurst.com` (v0.8.0).

### Features shipped

| Area | Feature |
|---|---|
| Auth | URL + password (no Google / Firebase) |
| Messaging | Real-time via Socket.IO, send text with optimistic UI |
| Persistence | IndexedDB — chats, messages, contacts, avatars, attachments all cached |
| Contacts | Pulled from macOS Contacts via `/contact?extraProperties=avatar`, multi-key address matching |
| Avatars | JPEG/PNG auto-detection, single + group-chat bubbles |
| Compose | Floating "+" button, contact autocomplete, new chat creation |
| Attachments | File picker, clipboard paste (screenshots), drag-and-drop, preview chips, multi-send |
| Sidebar | Search chats, three-dot menu (Mark All Read, Archived, FindMy, Settings, Logout) |
| Archive | Dedicated view with back-arrow navigation |
| FindMy | Full list + map view; click device → new tab with live-polling tracker |
| UX | Auto-scroll-to-bottom with user-gesture tracking, sync progress indicator |

### Architecture highlights

- **React + Vite + TypeScript** — single-file static bundle deployed as `dist/`
- **Dexie** (IndexedDB wrapper) with `useLiveQuery` — every DB write automatically re-renders relevant UI
- **Zustand** — ephemeral UI state only (selection, composer drafts)
- **Socket.IO** — live message updates
- **Tailwind CSS** — styling
- All server contracts live in `src/api/endpoints.ts` + `src/api/*` wrappers

---

## Deployment

### Local development (Windows)

```
cd C:\Users\fritz\Documents\bluebubbles-webapp
npm run dev
# → http://localhost:5173
```

Hot-reload is on — edit a file, browser refreshes automatically.

### Production (Ubuntu via HAProxy)

- Domain: `bluebubbles-web.fritzhurst.com`
- Web root: `/var/www/bluebubbles-web/`
- Nginx config: `/etc/nginx/sites-enabled/bluebubbles-web` (uses SPA fallback)
- HAProxy on pfSense terminates SSL and forwards to the Ubuntu box on port 80

### Updating production from GitHub

After committing changes to the `fritzhurst/bluebubbles-webapp` repo:

```bash
# On the Ubuntu box
cd ~/bluebubbles-webapp
git pull

# Only if package.json changed:
npm install

# Build (use npx — the npm-script version still has the tsc issue)
npx vite build

# Deploy
sudo cp -r dist/. /var/www/bluebubbles-web/
sudo chown -R www-data:www-data /var/www/bluebubbles-web
```

Hard-refresh the browser (Ctrl+Shift+R) to clear any cached old assets.

No nginx reload needed — it's just a file swap.

### Rollback

Every time you deploy, make a tagged backup first:

```bash
sudo cp -r /var/www/bluebubbles-web /var/www/bluebubbles-web.bak.$(date +%Y%m%d)
```

To roll back:

```bash
sudo rm -rf /var/www/bluebubbles-web
sudo mv /var/www/bluebubbles-web.bak.YYYYMMDD /var/www/bluebubbles-web
```

---

## Git workflow

Everything's under `fritzhurst/bluebubbles-webapp` on GitHub. Standard flow:

```
# Windows dev machine
cd C:\Users\fritz\Documents\bluebubbles-webapp
git add -A
git commit -m "description of change"
git push
```

Local checkpoints (zip snapshots) also sit in `C:\Users\fritz\Documents\` — they're belt-and-suspenders but git history is the primary rollback mechanism.

---

## Known issues (watch list)

### 1. `npm run build` errors with TypeScript help text

Root cause: Ubuntu installed TypeScript 5.9.3 where `tsc --noEmit` behavior differs slightly; it prints help and returns non-zero, so the `&&` in the build script short-circuits before `vite build`.

**Workaround:** use `npx vite build` directly.

**Proper fix (deferred):** investigate the 5.9.3 behavior, possibly pin TypeScript to 5.4.x in `package.json`, or adjust the build script.

### 2. Flaky "first thread stranded up the list" on initial load

Very intermittent. The ResizeObserver + user-gesture-only tracking in `MessageView.tsx` should handle it, but if you see it again:

1. Edit `src/ui/components/MessageView.tsx` and set `const DEBUG_SCROLL = true`
2. Rebuild, deploy, reproduce
3. Paste the `[scroll]` console lines for diagnosis

### 3. `/api/v1/icloud/findmy/devices/refresh` endpoint quirk

The POST /refresh endpoint returns a different envelope than GET /devices, which was causing `.find()` errors on auto-refresh. Already fixed in code (waiting in local repo to be pushed) — auto-refresh now uses GET only; manual refresh button tries POST first and falls back to GET gracefully.

### 4. AirTag battery enum mapping is a best guess

Current mapping (from Apple's `CRBatteryIndicationType`):
- 1 = Full, 2 = Medium, 3 = Low, 4 = Very Low, 5 = Needs Replacement

If a freshly-replaced AirTag battery shows up as something other than "Full", the enum is offset from what we assume. Easy to adjust in `src/ui/pages/FindMy.tsx` → `AIRTAG_BATTERY_LABELS`.

### 5. CORS

Currently the client talks directly to `bluebubbles.fritzhurst.com` for its API calls. If you ever see CORS errors in the console after a BB Server update:

- Option A: Enable CORS on the BB Server for the web app origin
- Option B: Add an nginx proxy block on the Ubuntu box so `/api/` and `/socket.io/` get proxied through the web app's same origin (example config in `README.md`)

---

## Deferred features (for next sessions)

From the original wishlist + items discovered during build:

- **Settings page** — full version with cache eviction, manual sync, theme, server URL swap, etc.
- **Reactions / tapbacks** — requires Private API on the BB Server
- **Message edit / unsend** — ditto
- **Typing indicator UI** — socket event is already wired, just no render
- **Message content search** — currently only the chat list is searchable
- **Interactive Leaflet map** for FindMy (currently static OSM embeds per device)
- **FCM push notifications** — requires real Firebase, out of scope initially
- **`npm run build`** fix (see Known Issues)
- **Attachment upload progress** — currently fires-and-forgets; large files feel laggy

---

## Key file locations

| What | Where |
|---|---|
| API endpoints (paths + socket event names) | `src/api/endpoints.ts` |
| REST wrapper with auth injection | `src/api/rest.ts` |
| Dexie schema + migrations | `src/db/schema.ts` |
| Sync engine (initial + incremental + socket) | `src/sync/` |
| Main UI shell | `src/ui/pages/Main.tsx` |
| Chat list + rows | `src/ui/components/ChatList.tsx`, `ChatRow.tsx`, `ChatAvatar.tsx` |
| Message view + composer | `src/ui/components/MessageView.tsx`, `Composer.tsx` |
| New-message dialog | `src/ui/components/NewMessageDialog.tsx` |
| Settings modal | `src/ui/components/SettingsDialog.tsx` |
| Sidebar three-dot menu | `src/ui/components/SidebarMenu.tsx` |
| FindMy page | `src/ui/pages/FindMy.tsx` |
| Live device tracker | `src/ui/pages/LiveDeviceMap.tsx` |
| Contact lookup (multi-key) | `src/utils/contacts.ts` |
| Hash routing for new-tab pages | `src/utils/route.ts` |

---

## Contact

When you pick this up in a new session, a quick primer on where we left off:

- Version: **v0.8.0**
- Deployed: `https://bluebubbles-web.fritzhurst.com`
- Source: `github.com/fritzhurst/bluebubbles-webapp` (main branch, v0.8.0 tag)
- Most recent unpushed change: LiveDeviceMap refresh fallback (see Known Issues #3)
- Next planned session: **Settings page build-out**
