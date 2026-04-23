# Changelog

## v0.8.2 — 2026-04-23

### UI

- Settings dialog now shows a "Web app" section with the current BB Web version. The value is read from `package.json` at build time, so future version bumps automatically update what users see — no manual string edit required.

## v0.8.1 — 2026-04-23

Security hardening and previously-unreleased feature work from the post-0.8.0 commits.

### Security

- Dev server now binds to `localhost` only by default. Opt-in to LAN exposure with `VITE_HOST_ALL=true npm run dev`. Addresses risk associated with Vite/esbuild dev-server CVEs on untrusted networks.
- Production builds no longer emit sourcemaps — the shipped bundle previously leaked original TypeScript source, auth flows, and API internals to anyone who inspected the deployed site.
- `normalizeServerUrl` now enforces HTTPS for non-loopback URLs. Plaintext `http://` server URLs are silently upgraded to `https://`, preventing the password and message contents from being sent in the clear if a user mistyped the scheme.
- Bumped `vite` declaration from `^5.3.1` to `^5.4.21` to pull the esbuild patch for GHSA-67mh-4wv8-2f99 on fresh installs (installed version was already 5.4.21).

### Features (previously on `main` but not in 0.8.0 release notes)

- Message-content search — dedicated search view on top of the existing sidebar chat-list filter.
- Light / dark theme toggle in Settings.
- FindMy last-seen timestamp rendered alongside device location.
- Send method auto-selection — composer now picks `private-api` vs `apple-script` based on `ServerInfo.private_api` capability.

## v0.8.0 — 2026-04-17

Initial public milestone. A fully functional BlueBubbles web client with local-first persistence, contact name/avatar resolution, attachments, and FindMy device tracking.

### Messaging

- URL + password auth (no Google / Firebase required)
- Live chat list with real-time updates via Socket.IO
- IndexedDB-backed persistence — chat list and message history survive reload
- Message view with iMessage-style bubbles, sender labels in group chats, read/delivered receipts
- Send text messages with optimistic UI (dispatches via `apple-script` or `private-api` based on server capability)
- Local read-state preserved across server re-sync
- Reliable auto-scroll to bottom (ResizeObserver + user-gesture tracking)

### Compose new

- Floating compose button (bottom-right of sidebar)
- Recipient field with contact autocomplete
- Creates chats via `POST /chat/new` and drops user into the new conversation

### Attachments

- File picker (paperclip icon, multi-select)
- Clipboard paste (screenshots, copied images)
- Drag-and-drop onto the composer
- Preview chips with thumbnails and per-item remove
- Sequential multi-file send with optional caption

### Contacts + avatars

- Pulls full macOS Contacts via `GET /contact?extraProperties=avatar`
- Denormalized address → contact map with multi-key lookup (handles `+15551234567` vs `+1 (210) 838-2045` etc.)
- Prefers avatar-bearing (db-source, numeric-id) entries when server returns duplicates
- JPEG/PNG auto-detection for avatar blobs
- Single + group-chat avatar bubbles in the chat list

### Sidebar

- Search: magnifying-glass toggle, filters chat list by display name, contact name, or phone
- Menu: Mark All As Read, Archived (toggle view), FindMy, Settings, Logout
- Connection status + sync progress indicators

### FindMy

- Dedicated page under sidebar menu
- Sections: DEVICES (phones/Macs), ITEMS (AirTag-style), UNKNOWN LOCATION
- LIST / MAP toggle at the bottom
- Map view: grid of static OpenStreetMap embeds with markers
- Click any device name → opens a new tab with a live tracker that auto-polls every 30 s and re-centers the map on location change
- Battery rendering: percentage for phones/Macs, friendly label ("Full" / "Low" / "Very Low" / "Needs Replacement") for AirTag enums

### Deferred for future versions

- Settings page (beyond the info modal) — manual sync actions, cache eviction, etc.
- Reactions and tapbacks
- Message edit / unsend / stickers
- Typing-indicator UI + send
- Read-receipt send
- Group chat management (rename, add/remove participants)
- FCM / Web Push notifications
- Leaflet-based interactive map (currently static OSM embeds per device)
