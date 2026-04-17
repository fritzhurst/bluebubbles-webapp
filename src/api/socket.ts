// Socket.IO client with password auth and automatic reconnection.
//
// BlueBubbles server exposes Socket.IO at the root path ('/socket.io'). It
// expects the password in the query string as `?guid=<password>` (legacy)
// or in `auth: { password }` (modern). We send both for safety.
//
// Reconnection: we rely on socket.io-client's built-in backoff, but on every
// successful reconnect we emit a custom event the sync engine listens for,
// so it can run an incremental sync to catch up.

import { io, type Socket } from 'socket.io-client';
import { SocketEvents } from './endpoints';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface SocketManagerEvents {
  onStatus: (status: ConnectionStatus, detail?: string) => void;
  onEvent: (eventName: string, payload: unknown) => void;
}

export class SocketManager {
  private socket: Socket | null = null;
  private status: ConnectionStatus = 'idle';
  private reconnectAttempts = 0;

  constructor(
    private readonly serverUrl: string,
    private readonly password: string,
    private readonly listeners: SocketManagerEvents,
  ) {}

  connect(): void {
    if (this.socket) return;

    this.setStatus('connecting');

    this.socket = io(this.serverUrl, {
      // Send the password in BOTH places; modern BB accepts `auth`, older
      // versions read `query.guid`.
      auth: { password: this.password, guid: this.password },
      query: { guid: this.password, password: this.password },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      forceNew: true,
      autoConnect: true,
      withCredentials: false, // we use the password param, not cookies
    });

    this.socket.on(SocketEvents.connect, () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
    });

    this.socket.on(SocketEvents.disconnect, (reason: string) => {
      this.setStatus('disconnected', reason);
    });

    this.socket.on(SocketEvents.connectError, (err: Error) => {
      this.reconnectAttempts += 1;
      this.setStatus('error', err.message);
    });

    // Fan out all BB events we care about to the central handler.
    const bbEvents = [
      SocketEvents.newMessage,
      SocketEvents.updatedMessage,
      SocketEvents.messageSendError,
      SocketEvents.chatReadStatusChanged,
      SocketEvents.typingIndicator,
      SocketEvents.participantAdded,
      SocketEvents.participantRemoved,
      SocketEvents.groupNameChange,
    ] as const;

    for (const eventName of bbEvents) {
      this.socket.on(eventName, (payload: unknown) => {
        this.listeners.onEvent(eventName, payload);
      });
    }
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus('idle');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(s: ConnectionStatus, detail?: string) {
    this.status = s;
    this.listeners.onStatus(s, detail);
  }
}
