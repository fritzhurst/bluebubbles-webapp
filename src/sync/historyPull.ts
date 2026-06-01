import { getChatMessages } from '@/api/chats';
import { db, upsertMessages } from '@/db/db';
import { toStoredMessage } from '@/sync/socketHandlers';
import { toJsEpochMs } from '@/utils/time';

const PAGE_SIZE = 200;

export interface HistoryPullProgress {
  /** Chats finished so far (only meaningful for the all-chats pull). */
  chatsDone: number;
  /** Total chats to process (only meaningful for the all-chats pull). */
  chatsTotal: number;
  /** Messages stored so far across the whole pull. */
  messagesPulled: number;
  done: boolean;
}

export type HistoryProgressCallback = (p: HistoryPullProgress) => void;

export async function pullChatHistoryRange(
  chatGuid: string,
  fromMs: number,
  toMs: number,
  onMessages?: (count: number) => void,
): Promise<number> {
  if (fromMs > toMs) {
    throw new Error('Invalid range: "from" must be earlier than "to".');
  }

  let before = toMs;
  let total = 0;

  while (true) {
    const page = await getChatMessages(chatGuid, {
      limit: PAGE_SIZE,
      before,
      after: fromMs,
    });

    if (page.length === 0) {
      break;
    }

    await upsertMessages(page.map((message) => toStoredMessage(message, chatGuid)));
    total += page.length;
    onMessages?.(page.length);

    if (page.length < PAGE_SIZE) {
      break;
    }

    const oldestTs = Math.min(...page.map((message) => toJsEpochMs(message.dateCreated)));
    const nextBefore = oldestTs - 1;
    if (nextBefore <= fromMs) {
      break;
    }
    before = nextBefore;
  }

  return total;
}

export async function pullAllChatHistoryRange(
  fromMs: number,
  toMs: number,
  onProgress?: HistoryProgressCallback,
): Promise<number> {
  const chats = await db.chats.toArray();
  let total = 0;
  let chatsDone = 0;

  const report = (done = false) =>
    onProgress?.({
      chatsDone,
      chatsTotal: chats.length,
      messagesPulled: total,
      done,
    });

  report();
  for (const chat of chats) {
    await pullChatHistoryRange(chat.guid, fromMs, toMs, (count) => {
      total += count;
      report();
    });
    chatsDone += 1;
    report();
  }
  report(true);
  return total;
}
