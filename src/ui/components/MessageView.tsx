import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getChat, listMessages } from '@/db/queries';
import { markChatRead } from '@/api/chats';
import MessageBubble from './MessageBubble';
import Composer from './Composer';
import { chatDisplayName, isGroupChat } from '@/utils/guid';
import { upsertChat } from '@/db/db';
import { useContactMap } from '@/ui/hooks/useContacts';
import { useHasPrivateApi } from '@/ui/hooks/useServerInfo';
import { useUIStore } from '@/state/store';

interface Props {
  chatGuid: string;
}

const DEBUG_SCROLL = false; // flip to true to trace scroll decisions in console

// Distance from the bottom (in px) below which we consider the user to
// still be "following" new messages. Beyond this, we stop auto-scrolling
// so we don't interrupt reading of history.
const NEAR_BOTTOM_PX = 120;

export default function MessageView({ chatGuid }: Props) {
  const chat = useLiveQuery(() => getChat(chatGuid), [chatGuid]);
  const messages = useLiveQuery(() => listMessages(chatGuid, 200), [chatGuid], []);
  const contactMap = useContactMap();
  const hasPrivateApi = useHasPrivateApi();
  const scrollToMessageGuid = useUIStore((s) => s.scrollToMessageGuid);
  const setScrollToMessage = useUIStore((s) => s.setScrollToMessage);
  const [highlightedGuid, setHighlightedGuid] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Whether to keep the viewport pinned to the bottom. Kept in a ref so
  // the value survives across effect re-runs (including StrictMode's
  // dev-mode double-invoke) — if this were a `let` inside an effect, the
  // cleanup would clobber it and the second mount would start fresh.
  const autoFollowRef = useRef<boolean>(true);

  // Reset auto-follow state when switching chats.
  useEffect(() => {
    autoFollowRef.current = true;
  }, [chatGuid]);

  // Wire up user-gesture listeners and a ResizeObserver. We read
  // autoFollow from the ref, not a local variable, so Strict Mode's
  // mount→cleanup→mount cycle doesn't lose state mid-initialization.
  useEffect(() => {
    const container = scrollRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const pin = () => {
      if (!autoFollowRef.current) return;
      container.scrollTop = container.scrollHeight;
      if (DEBUG_SCROLL) {
        console.log('[scroll] pin', {
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
        });
      }
    };

    // Only explicit user gestures flip autoFollow. We deliberately do NOT
    // listen to the `scroll` event — programmatic scrolls fire it too,
    // and the race between that event and concurrent image-load growth
    // was misclassifying users as "scrolled away".
    const onUserGesture = () => {
      requestAnimationFrame(() => {
        const dist =
          container.scrollHeight - (container.scrollTop + container.clientHeight);
        autoFollowRef.current = dist < NEAR_BOTTOM_PX;
        if (DEBUG_SCROLL) {
          console.log('[scroll] user gesture → autoFollow=', autoFollowRef.current, 'dist=', dist);
        }
      });
    };

    container.addEventListener('wheel', onUserGesture, { passive: true });
    container.addEventListener('touchmove', onUserGesture, { passive: true });
    container.addEventListener('keydown', onUserGesture);

    pin();

    const observer = new ResizeObserver(pin);
    observer.observe(content);

    return () => {
      observer.disconnect();
      container.removeEventListener('wheel', onUserGesture);
      container.removeEventListener('touchmove', onUserGesture);
      container.removeEventListener('keydown', onUserGesture);
    };
  }, [chatGuid]);

  // Extra safety net: when the messages array changes size, pin to
  // bottom synchronously during layout (before paint). This catches
  // the case where the initial message load lands in the gap between
  // StrictMode's effect cleanup and re-mount, so the ResizeObserver
  // never gets to fire for the initial growth.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || !autoFollowRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages?.length, chatGuid]);

  // Scroll to and briefly highlight a message when the sidebar search
  // asks us to. Triggered after the selected chat matches the request.
  useEffect(() => {
    if (!scrollToMessageGuid || !messages) return;
    // Only act if the target message is actually in THIS chat.
    const target = messages.find((m) => m.guid === scrollToMessageGuid);
    if (!target) return;

    // Stop auto-pinning to the bottom while we jump to history.
    autoFollowRef.current = false;
    const container = scrollRef.current;
    if (!container) return;

    const el = container.querySelector<HTMLElement>(
      `[data-msg-guid="${cssEscape(scrollToMessageGuid)}"]`,
    );
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHighlightedGuid(scrollToMessageGuid);
      // Clear the highlight after a short pulse.
      const t = window.setTimeout(() => setHighlightedGuid(null), 2500);
      // Consume the request so the same guid doesn't fire again on re-render.
      setScrollToMessage(null);
      return () => window.clearTimeout(t);
    }
  }, [scrollToMessageGuid, messages, setScrollToMessage]);

  // Mark the chat as read when opened.
  useEffect(() => {
    if (!chat || !chat.hasUnread) return;

    upsertChat({ ...chat, hasUnread: false }).catch((err) =>
      console.warn('[MessageView] local unread flip failed', err),
    );

    if (!hasPrivateApi) return;
    markChatRead(chatGuid).catch((err: unknown) => {
      console.warn('[MessageView] markChatRead server call failed', err);
    });
  }, [chatGuid, chat, hasPrivateApi]);

  if (!chat) {
    return <div className="flex-1 p-6 text-slate-500">Loading chat…</div>;
  }

  const group = isGroupChat(chat);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center border-b border-white/10 px-6 py-3">
        <h2 className="text-lg font-semibold">{chatDisplayName(chat, contactMap)}</h2>
      </header>

      <div
        ref={scrollRef}
        /*
         * `min-h-0` is the flex-column fix — without it, a flex child with
         * `flex-1` uses `min-height: auto` and expands to fit its content,
         * defeating `overflow-y-auto`. Only with a bounded height does the
         * container actually scroll instead of pushing the page down.
         */
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
      >
        <div ref={contentRef} className="space-y-1">
          {messages && messages.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-12">
              No messages yet in this chat.
            </div>
          )}
          {messages?.map((m) => (
            <div
              key={m.guid}
              data-msg-guid={m.guid}
              className={
                m.guid === highlightedGuid
                  ? 'transition-colors duration-700 bg-imessage-blue/15 rounded-lg -mx-2 px-2'
                  : ''
              }
            >
              <MessageBubble message={m} isGroup={group} />
            </div>
          ))}
        </div>
      </div>

      <Composer chatGuid={chatGuid} />
    </div>
  );
}

/**
 * Minimal CSS.escape shim so we can use a message guid inside an
 * attribute selector even if it contains characters CSS considers
 * special (BlueBubbles guids include dashes and sometimes semicolons).
 */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
}
