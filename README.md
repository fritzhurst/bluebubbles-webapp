# BlueBubbles Web App

A local-first, IndexedDB-backed web client for a BlueBubbles Server. Connects directly with server URL + password — no Google/Firebase required.

> **Read `PLAN.md` first.** It explains the architecture, the server API surface we depend on, and the reasons I pivoted away from a Flutter-Web port of the Windows source.

## Features

- URL + password authentication (no OAuth)
- Chat list with unread indicators, real-time updates over Socket.IO
- Message view with iMessage-style bubbles, sender labels in group chats
- Send text messages (optimistic UI); send method auto-selected based on server private-API capability
- Send attachments: file picker, clipboard paste, drag-and-drop, multi-file with caption
- Receive/display attachments (images, video, audio, files) with IndexedDB blob cache
- New-message composer with contact autocomplete
- Contact name + avatar resolution via macOS Contacts (`/contact` endpoint)
- Search: filter chat list (sidebar) and search message content (dedicated view)
- Sidebar menu: Mark-All-Read, Archived view, FindMy, Settings, Logout
- FindMy page: device + item list, map view, live-polling tracker in a new tab (with last-seen)
- Light/dark theme toggle
- Persistent local store — reloads and restarts reuse cached data
- Incremental sync on every reconnect

## Not yet implemented (TODO)

- Reactions / tapbacks (requires Private API)
- Typing indicator UI (socket event is already wired, just not rendered)
- Message edit / unsend / stickers (Private API features)
- Group chat management (rename, add/remove participants)
- FCM / Web Push notifications
- Read-receipt + typing-indicator send (we listen but don't emit)

---

## Running locally

Requires Node 20+ LTS.

```bash
cd bluebubbles-webapp
npm install
npm run dev
```

Open http://localhost:5173 and enter your BlueBubbles server URL and password.

The dev server binds to `localhost` only by default. To reach it from another device on your LAN (e.g. a phone for PWA testing), start it with:

```bash
VITE_HOST_ALL=true npm run dev
```

Only opt-in on trusted networks.

### CORS

Your BlueBubbles Server must allow cross-origin requests from the browser. By default BB Server allows `*` for most endpoints. If you see CORS errors in DevTools, check the server's `serveronly.json` or `config.json` for `cors` settings. As a workaround, Vite supports a dev proxy; uncomment and customize the block below in `vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': { target: 'https://your-server.example.com', changeOrigin: true, secure: false },
    '/socket.io': {
      target: 'https://your-server.example.com',
      ws: true,
      changeOrigin: true,
      secure: false,
    },
  },
}
```

If you use the proxy, enter `http://localhost:5173` as the server URL (the proxy rewrites to the real server).

### Mixed content / HTTPS

If the page is loaded over `http://localhost`, modern browsers will still allow an `https://` fetch to your server. If you host the app itself over `https://`, the server URL **must** also be `https://` — browsers block HTTPS → HTTP mixed content unconditionally.

---

## Production deploy — Ubuntu + nginx

### Build

```bash
npm run build
# Output: ./dist/
```

### Copy to the Ubuntu server

```bash
rsync -av --delete dist/ user@your-ubuntu-box:/var/www/bluebubbles-web/
```

### nginx config

Save as `/etc/nginx/sites-available/bluebubbles-web`:

```nginx
server {
  listen 443 ssl http2;
  server_name bluebubbles-web.example.com;

  ssl_certificate     /etc/letsencrypt/live/bluebubbles-web.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/bluebubbles-web.example.com/privkey.pem;

  root /var/www/bluebubbles-web;
  index index.html;

  # SPA fallback — all unknown routes serve index.html so the React router
  # (if added later) can take over.
  location / {
    try_files $uri /index.html;
  }

  # Long cache for hashed assets
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Never cache the shell
  location = /index.html {
    add_header Cache-Control "no-store";
  }
}

server {
  listen 80;
  server_name bluebubbles-web.example.com;
  return 301 https://$host$request_uri;
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/bluebubbles-web /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Optional: proxy the BB Server through nginx (simplifies CORS)

If you want to avoid CORS entirely and serve both the app and the BB API from one origin, add these blocks inside the `server { listen 443 ssl ... }` block above:

```nginx
location /api/ {
  proxy_pass https://your-bluebubbles-server:port/api/;
  proxy_set_header Host $host;
  proxy_ssl_verify off;
}

location /socket.io/ {
  proxy_pass https://your-bluebubbles-server:port/socket.io/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_ssl_verify off;
}
```

Then use `https://bluebubbles-web.example.com` as the server URL in the login form.

---

## File layout

```
bluebubbles-webapp/
├── PLAN.md                   overnight plan + architecture decisions
├── README.md                 this file
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── tailwind.config.js
├── postcss.config.cjs
├── public/
│   └── manifest.webmanifest
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── api/                  REST + Socket.IO clients (endpoints.ts is the control panel)
    │                         chats, messages, attachments, contacts, findmy, handles, server, socket, rest
    ├── db/                   Dexie schema, upserts, queries
    ├── sync/                 initial + incremental + socket-driven sync
    ├── state/                Zustand store for ephemeral UI state
    ├── types/                server model types
    ├── utils/                time conversion, guid, base64, contacts, route (hash routing)
    └── ui/
        ├── pages/
        │   ├── Login.tsx          URL + password login
        │   ├── Main.tsx           chat list + message view shell
        │   ├── FindMy.tsx         device + item tracker (list / map)
        │   └── LiveDeviceMap.tsx  single-device live tracker (new-tab target)
        ├── components/       ChatList, ChatRow, ChatAvatar, ContactAvatar,
        │                     MessageView, MessageBubble, AttachmentView,
        │                     Composer, NewMessageDialog, SearchBar, SearchResults,
        │                     SettingsDialog, SidebarMenu,
        │                     ConnectionStatus, EmptyState
        └── hooks/            useAuth, useContacts, useSendMethod, useServerInfo, useTheme
```

---

## Quick debugging checklist

1. **Login fails** → Check the Network tab. A 401 means wrong password; 0/CORS means server not allowing this origin.
2. **Login succeeds, chat list empty** → Check IndexedDB under `bluebubbles → chats`. If empty, initial sync probably errored; see the console for `[initialSync]` warnings.
3. **Real-time not working** → Check `ConnectionStatus` badge. If red, see console for `connect_error`. Socket.IO client logs the reason.
4. **Attachments don't load** → Individual attachment fetches are in the Network tab; look for `/api/v1/attachment/.../download`. A 404 here is likely an endpoint-string mismatch; fix in `src/api/endpoints.ts`.
5. **"Wrong" timestamps** → The server may be returning JS epoch ms instead of Apple epoch. `src/utils/time.ts` already auto-detects, but if the clock is off by ~30 years we got it wrong; adjust the threshold there.

---

## Tested against BlueBubbles Server versions

This was written from API knowledge rather than live testing (the build sandbox couldn't reach the BB server). Expect small drift against whatever your server is running. All external server contracts are centralized in:

- `src/api/endpoints.ts` — REST paths and socket event names
- `src/sync/socketHandlers.ts` — payload shape assumptions
- `src/types/bluebubbles.ts` — response shapes

Fixing any real-world mismatch should always touch one of those three files.
