# BlueBubbles Web App — Overnight Plan

**Author:** Claude (overnight session, 2026-04-16)
**For:** Fritz (fhurst@gmail.com)
**Working directory:** `bluebubbles-webapp/`

> **📜 Historical document.** This is the pre-build planning doc from the 2026-04-16 overnight session. It reflects what was *intended*, not what exists now. For the current state of the project see [README.md](README.md) (features + how to run), [NOTES.md](NOTES.md) (deployment + known issues), and [CHANGELOG.md](CHANGELOG.md) (what shipped per version). Many items listed as "non-goals" here (attachment sending, search, FindMy, theme toggle) have since shipped.

---

## Read this first: an architectural pivot I had to make

You asked me to **start from the Windows source of `bluebubbles-app`** and modify it to run as a web app. I need to be upfront that I could not do that literally, for two reasons:

1. **Network egress is blocked.** The sandbox I'm running in blocks access to `github.com`, `raw.githubusercontent.com`, and `bluebubbles.app`. I could not clone your fork (`fritzhurst/bluebubbles-app`), the upstream `BlueBubblesApp/bluebubbles-app`, or `BlueBubblesApp/bluebubbles-web`. `git clone`, `curl`, and `WebFetch` all return 403 from the proxy allowlist.
2. **Even with the source, the Windows build is Flutter-targeted-at-Windows.** Converting it to Flutter Web is not a "flip a flag" operation. The Windows build uses platform code that has no web equivalent (sqflite/ObjectBox, `dart:io` filesystem access, Windows platform channels for notifications/secure storage, FFI, etc.). The real work is exactly the kind of thing that blew up `bluebubbles-web` in the first place — replacing every storage and I/O path with web-safe equivalents. Doing that without the source in front of me would have been guesswork.

**What I built instead:** A clean, standalone web client — `bluebubbles-webapp` — written in **TypeScript + React + Vite**, that:
- Talks directly to your BlueBubbles Server over its existing Socket.IO + REST API (the same API the desktop app uses).
- Persists **everything** (chats, messages, handles, attachment blobs) in **IndexedDB** via Dexie, so a reload or restart doesn't re-fetch.
- Uses **URL + password** authentication only — no Google/Firebase, no OAuth, no server-URL auto-discovery.
- Can be served from `localhost` during development and from an Ubuntu server (nginx) in production.

This gives you a working, debuggable app tonight rather than a half-converted Flutter project that may or may not compile. In the morning we can:
- Treat this as the foundation and keep building on it, **or**
- Use the functionality map and API contracts here as a reference while we take another run at Flutter Web with full source access.

I've wired the code to mirror `bluebubbles-web`'s feature set; the API calls and socket-event names are drawn from the public BlueBubbles Server API (v1). If any endpoint name drifts from what your server actually exposes, the fix is localized to `src/api/` — I kept all endpoint strings and event names in one place so they're easy to adjust.

---

## Goals (from your brief)

1. Web app that can be served from `localhost` for development, then from an Ubuntu server for production.
2. Mirror `bluebubbles-web` functionality (list chats, view messages, send messages, handle attachments, real-time updates).
3. Store pulled data in IndexedDB so data persists across tab reloads and browser restarts.
4. Authentication: **server URL (https) + server password only.** No Google/Firebase.
5. Plan, scaffold, and build as much as possible overnight; we'll finish and deploy together in the morning.

## Non-goals for tonight

- Push notifications via FCM (requires real Firebase, out of scope per your auth note).
- Sending attachments from the composer (receiving/displaying works; upload UI is a stub with a clear TODO).
- End-to-end encryption toggles, private API advanced features.
- Mobile PWA install flow polish (manifest is included but not icon-optimized).

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Browser (Chrome/Firefox/Safari on Fritz's machines)       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ React UI (src/ui)                                    │  │
│  │   Login → Chat list → Message view → Composer        │  │
│  └───────────────▲──────────────────────────▲───────────┘  │
│                  │                          │              │
│                  │ React hooks              │              │
│                  │                          │              │
│  ┌───────────────┴──────────┐   ┌──────────┴───────────┐   │
│  │ State (src/state)        │   │ Sync engine          │   │
│  │ Zustand store for UI     │◀──│ (src/sync)           │   │
│  │ selection + status       │   │ Pulls + reconciles   │   │
│  └──────────────────────────┘   └──────────┬───────────┘   │
│                                            │               │
│  ┌──────────────────────────┐   ┌──────────▼───────────┐   │
│  │ IndexedDB (src/db)       │◀──│ API client (src/api) │   │
│  │ Dexie: chats, messages,  │   │ REST (fetch) +       │   │
│  │ handles, attachments,    │   │ Socket.IO client     │   │
│  │ settings, blob cache     │   │                      │   │
│  └──────────────────────────┘   └──────────┬───────────┘   │
│                                            │               │
└────────────────────────────────────────────┼───────────────┘
                                             │ HTTPS + WSS
                                             ▼
                              ┌───────────────────────────────┐
                              │  BlueBubbles Server (macOS)   │
                              │  Your existing server URL     │
                              └───────────────────────────────┘
```

### Data flow

1. **Login.** User enters `https://your-server.example.com` and the server password.
   - We hit `GET {url}/api/v1/ping?password={pw}` and then `GET /api/v1/server/info?password={pw}` to validate.
   - On success we persist `{url, password}` in IndexedDB (under `settings` table) and hand off to the main app.
2. **Initial sync.** The sync engine walks:
   - `POST /api/v1/chat/query` with pagination to pull all chats (limit 100, offset N).
   - For each chat, `GET /api/v1/chat/:guid/message` with `limit=50&offset=0&sort=DESC` to pull the most recent 50 messages.
   - `GET /api/v1/handle/query` to cache handles.
   - Results are upserted into Dexie by `guid` (primary key).
3. **Incremental updates.** A Socket.IO connection stays open (`new-message`, `updated-message`, `typing-indicator`, `chat-read-status-changed`, participant events). Each event upserts into Dexie and triggers a React re-render through Dexie's live-query hook.
4. **On reopen.** The app reads from Dexie first (instant UI), then opens the socket and back-fills anything newer than the most recent cached message. Nothing is fetched unless there's a gap.
5. **Attachments.** When a message has an attachment, the UI shows a placeholder. If/when the user scrolls it into view (or clicks it), we `GET /api/v1/attachment/:guid/download`, store the Blob in the `attachmentBlobs` table, and render it. Once cached, it never re-downloads.

### Why this architecture

- **Dexie over raw IndexedDB.** Dexie has `liveQuery` which integrates beautifully with React via `useLiveQuery`, so the UI re-renders automatically on any DB write — from a user action or from a socket event. No manual invalidation. This is what lets the real-time updates feel native.
- **TypeScript + React + Vite.** Fast HMR, tiny production bundle, easy to deploy as static assets behind nginx. No SSR complexity, no Next.js overhead — this is a pure client app.
- **Tailwind.** A text-heavy, list-heavy UI like this is tedious to style manually. Tailwind keeps the component files readable.
- **Zustand for ephemeral UI state.** Which chat is selected, composer draft text, connection status. Everything *durable* lives in Dexie.
- **Sync engine as a separate module.** Keeps API + DB responsibilities out of the UI. Easier to test and easier to swap if the BlueBubbles API changes.

---

## BlueBubbles Server API surface (as used here)

All requests include `?password=<server-password>` (or `password` in the POST body). All responses are JSON with shape `{ status, message, data }`.

| Purpose | Method + path |
|---|---|
| Ping (health) | `GET /api/v1/ping` |
| Server info | `GET /api/v1/server/info` |
| List chats | `POST /api/v1/chat/query` (body: `{ limit, offset, with: ["lastMessage","participants"], sort: "lastmessage" }`) |
| Messages in chat | `GET /api/v1/chat/:guid/message?limit=50&offset=0&with=attachment,handle&sort=DESC` |
| Send text | `POST /api/v1/message/text` (body: `{ chatGuid, message, method: "apple-script" \| "private-api" }`) |
| Handles | `POST /api/v1/handle/query` |
| Attachment download | `GET /api/v1/attachment/:guid/download` (binary) |
| Attachment metadata | `GET /api/v1/attachment/:guid` |
| Mark chat read | `POST /api/v1/chat/:guid/read` |

Socket.IO events consumed: `new-message`, `updated-message`, `chat-read-status-changed`, `typing-indicator`, `participant-added`, `participant-removed`, `group-name-change`.

**⚠️ Verification step for the morning:** Point the app at your server and check the Network tab for any 404s. Any mismatch will be in `src/api/endpoints.ts` and is a one-line fix per endpoint. I kept the strings in one file for exactly this reason.

---

## File tree

```
bluebubbles-webapp/
├── PLAN.md                   ← this file
├── README.md                 ← how to run locally + deploy to Ubuntu
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── manifest.webmanifest
└── src/
    ├── main.tsx              ← entry point
    ├── App.tsx               ← router: login vs. app shell
    ├── index.css             ← Tailwind directives
    ├── types/
    │   └── bluebubbles.ts    ← TS types mirroring server models
    ├── api/
    │   ├── endpoints.ts      ← ALL endpoint paths + socket event names
    │   ├── rest.ts           ← fetch wrapper with auth injection
    │   ├── chats.ts          ← chat-related REST calls
    │   ├── messages.ts       ← message-related REST calls
    │   ├── attachments.ts    ← attachment download + cache
    │   ├── handles.ts
    │   ├── server.ts         ← ping, info
    │   └── socket.ts         ← Socket.IO client + reconnect
    ├── db/
    │   ├── schema.ts         ← Dexie tables + indexes
    │   ├── db.ts             ← Dexie instance
    │   └── queries.ts        ← common reads used by UI
    ├── sync/
    │   ├── initialSync.ts    ← first-run pull
    │   ├── incrementalSync.ts ← back-fill on reconnect
    │   └── socketHandlers.ts ← event → DB upsert
    ├── state/
    │   └── store.ts          ← Zustand: selection, connection status
    ├── utils/
    │   ├── time.ts           ← BlueBubbles epoch handling
    │   └── guid.ts
    └── ui/
        ├── pages/
        │   ├── Login.tsx
        │   └── Main.tsx
        ├── components/
        │   ├── ChatList.tsx
        │   ├── ChatRow.tsx
        │   ├── MessageView.tsx
        │   ├── MessageBubble.tsx
        │   ├── Composer.tsx
        │   ├── AttachmentView.tsx
        │   ├── ConnectionStatus.tsx
        │   └── EmptyState.tsx
        └── hooks/
            ├── useAuth.ts
            ├── useChats.ts
            └── useMessages.ts
```

---

## Running it

### Localhost

```bash
cd bluebubbles-webapp
npm install
npm run dev
# Visit http://localhost:5173
```

### Ubuntu server (production)

```bash
npm run build
# Serve dist/ from nginx — see README.md for a full nginx config.
```

---

## Morning checklist

1. `npm install` and `npm run dev`. If any types are wrong in `src/types/bluebubbles.ts`, point it at your server and the console will tell us.
2. Hit login with your server URL and password. Watch the Network tab; fix any 404s in `src/api/endpoints.ts`.
3. Inspect `IndexedDB → bluebubbles → chats` in DevTools to confirm the initial sync worked.
4. Test real-time: send a message to yourself from another device and verify it appears without reload.
5. Test persistence: close the tab, reopen it — chat list should appear instantly.
6. Decide: keep extending this, or try the Flutter-Web path with full source access.
