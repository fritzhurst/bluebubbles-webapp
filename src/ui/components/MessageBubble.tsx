import type { StoredMessage } from '@/db/schema';
import AttachmentView from './AttachmentView';
import { formatShortTime } from '@/utils/time';
import { resolveContactName, useContactMap } from '@/ui/hooks/useContacts';

interface Props {
  message: StoredMessage;
  /** If true, show the sender's name above incoming bubbles (iMessage-style). */
  isGroup?: boolean;
}

export default function MessageBubble({ message, isGroup = false }: Props) {
  const contactMap = useContactMap();
  const mine = message.isFromMe;
  const text = message.text?.trim() ?? '';
  const attachments = message.attachments ?? [];

  // Suppress the "invisible" U+FFFC character BlueBubbles uses as a placeholder
  // for attachments when there's no accompanying text.
  const displayText = text.replace(/\uFFFC/g, '').trim();

  // Only label incoming messages in group chats — direct chats are unambiguous.
  const senderAddress = message.handle?.address;
  const showSender = isGroup && !mine && !!senderAddress;
  const senderName = showSender ? resolveContactName(senderAddress, contactMap) : '';

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="flex flex-col max-w-[75%]">
        {showSender && (
          <div className="text-[11px] text-slate-400 pl-3 mb-0.5">{senderName}</div>
        )}
        <div
          className={`rounded-2xl px-4 py-2 shadow-sm ${
            mine
              ? 'bg-imessage-blue text-white rounded-br-md'
              : 'bg-imessage-bubbleDark text-slate-100 rounded-bl-md'
          }`}
        >
          {attachments.length > 0 && (
            <div className="mb-1 flex flex-col gap-1">
              {attachments.map((a) => (
                <AttachmentView key={a.guid} attachment={a} />
              ))}
            </div>
          )}
          {displayText && (
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {displayText}
            </div>
          )}
        </div>
        <div
          className={`text-[10px] mt-1 text-slate-500 ${mine ? 'text-right pr-1' : 'pl-1'}`}
        >
          {formatShortTime(message.dateCreatedMs)}
          {mine && message.dateRead ? ' · Read' : mine && message.dateDelivered ? ' · Delivered' : ''}
        </div>
      </div>
    </div>
  );
}
