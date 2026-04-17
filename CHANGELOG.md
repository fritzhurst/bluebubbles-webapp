# Changelog

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

- Settings page (beyond the info modal) — manual sync actions, cache eviction, theme, etc.
- Reactions and tapbacks
- Message edit / unsend
- Search within messages (currently only chat list)
- Typing-indicator UI
- FCM push notifications
- Leaflet-based interactive map (currently static OSM embeds per device)
