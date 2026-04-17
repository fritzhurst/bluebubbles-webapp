// ALL BlueBubbles Server endpoint paths live here. Any time we see a 404
// against the server, the fix belongs in this file.
//
// The BB Server serves its REST API under /api/v1 and its Socket.IO endpoint
// at the server root with default path /socket.io/.

export const API_BASE = '/api/v1';

export const Endpoints = {
  ping: `${API_BASE}/ping`,
  serverInfo: `${API_BASE}/server/info`,

  // Chats
  chatQuery: `${API_BASE}/chat/query`,
  chatNew: `${API_BASE}/chat/new`,
  chatMessages: (guid: string) => `${API_BASE}/chat/${encodeURIComponent(guid)}/message`,
  chatRead: (guid: string) => `${API_BASE}/chat/${encodeURIComponent(guid)}/read`,

  // Messages
  messageText: `${API_BASE}/message/text`,
  messageAttachment: `${API_BASE}/message/attachment`,
  messageQuery: `${API_BASE}/message/query`,

  // Handles
  handleQuery: `${API_BASE}/handle/query`,

  // Contacts (pulled from macOS Contacts.app)
  contacts: `${API_BASE}/contact`,
  contactQuery: `${API_BASE}/contact/query`,

  // Attachments
  attachmentMeta: (guid: string) => `${API_BASE}/attachment/${encodeURIComponent(guid)}`,
  attachmentDownload: (guid: string) =>
    `${API_BASE}/attachment/${encodeURIComponent(guid)}/download`,

  // iCloud / Find My
  findMyDevices: `${API_BASE}/icloud/findmy/devices`,
  findMyDevicesRefresh: `${API_BASE}/icloud/findmy/devices/refresh`,
  findMyFriends: `${API_BASE}/icloud/findmy/friends`,
  findMyFriendsRefresh: `${API_BASE}/icloud/findmy/friends/refresh`,
} as const;

/** Socket.IO event names we listen for. */
export const SocketEvents = {
  // incoming
  newMessage: 'new-message',
  updatedMessage: 'updated-message',
  messageSendError: 'message-send-error',
  chatReadStatusChanged: 'chat-read-status-changed',
  typingIndicator: 'typing-indicator',
  participantAdded: 'participant-added',
  participantRemoved: 'participant-removed',
  groupNameChange: 'group-name-change',

  // connection state (built-in)
  connect: 'connect',
  disconnect: 'disconnect',
  connectError: 'connect_error',
} as const;
