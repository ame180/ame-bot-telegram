import { tool } from 'ai';
import { z } from 'zod';
import type { MessageStore, StoredMessage } from '../storage/messages.js';
import { formatMessage, formatTranscript } from './transcript.js';

export const MAX_TOOL_MESSAGES = 200;
export const MAX_TOOL_RESULT_CHARS = 30_000;

export interface HistoryToolsOptions {
  store: MessageStore;
  chatId: number;
  timeZone: string;
}

/**
 * Tools are bound to a single chat: the chat id comes from the closure, never from model input,
 * so the model cannot read other chats' history.
 */
export function createHistoryTools({ store, chatId, timeZone }: HistoryToolsOptions) {
  const limitSchema = (defaultLimit: number) =>
    z
      .number()
      .int()
      .min(1)
      .max(MAX_TOOL_MESSAGES)
      .default(defaultLimit)
      .describe(`Maximum number of messages to return (1-${MAX_TOOL_MESSAGES}).`);

  return {
    get_messages_before: tool({
      description:
        'Read older chat messages, sent before the given message id. Use it to page backwards through the conversation.',
      inputSchema: z.object({
        before_message_id: z.number().int().describe('Return messages older than this message id.'),
        limit: limitSchema(50),
      }),
      execute: async ({ before_message_id, limit }) => {
        const messages = store.getBefore(chatId, before_message_id, limit);
        const keptMessages = fitToBudget(messages, timeZone, 'keep-newest');
        const oldestId = keptMessages[0]?.messageId;
        const pagingHint =
          messages.length === limit && oldestId !== undefined
            ? `Older messages may exist; call again with before_message_id=${oldestId}.`
            : 'This is the beginning of the stored history.';

        return renderMessages(keptMessages, timeZone, pagingHint);
      },
    }),

    get_messages_in_range: tool({
      description:
        'Read chat messages sent within a time range, oldest first. Use it for questions like "summarise today" or "what happened yesterday".',
      inputSchema: z.object({
        from: z
          .string()
          .describe('Start of the range (inclusive), ISO 8601 date-time with UTC offset.'),
        to: z
          .string()
          .describe('End of the range (exclusive), ISO 8601 date-time with UTC offset.'),
        limit: limitSchema(MAX_TOOL_MESSAGES),
      }),
      execute: async ({ from, to, limit }) => {
        const fromMilliseconds = Date.parse(from);
        const toMilliseconds = Date.parse(to);

        if (Number.isNaN(fromMilliseconds) || Number.isNaN(toMilliseconds)) {
          return 'Error: "from" and "to" must be ISO 8601 date-times, e.g. 2026-09-25T00:00:00+02:00.';
        }

        const messages = store.getInRange(
          chatId,
          Math.floor(fromMilliseconds / 1000),
          Math.floor(toMilliseconds / 1000),
          limit + 1,
        );
        const keptMessages = fitToBudget(messages.slice(0, limit), timeZone, 'keep-oldest');
        const hasMore = messages.length > keptMessages.length;
        const lastMessage = keptMessages.at(-1);
        const pagingHint =
          hasMore && lastMessage !== undefined
            ? `More messages exist in this range; call again with from=${new Date(lastMessage.date * 1000).toISOString()} (messages from that second may repeat).`
            : 'No more messages in this range.';

        return renderMessages(keptMessages, timeZone, pagingHint);
      },
    }),

    search_messages: tool({
      description:
        'Search chat messages containing the given text (case-insensitive for Latin letters), newest first. Use short keywords; try word variants for inflected languages like Polish.',
      inputSchema: z.object({
        query: z.string().min(2).describe('Text to look for in messages.'),
        limit: limitSchema(30),
      }),
      execute: async ({ query, limit }) => {
        const messages = store.search(chatId, query, limit).reverse();
        const keptMessages = fitToBudget(messages, timeZone, 'keep-newest');
        const footer =
          keptMessages.length < messages.length
            ? `Search results for "${query}"; only the newest ${keptMessages.length} of ${messages.length} matches fit.`
            : `Search results for "${query}".`;

        return renderMessages(keptMessages, timeZone, footer);
      },
    }),
  };
}

function fitToBudget(
  messages: StoredMessage[],
  timeZone: string,
  keep: 'keep-newest' | 'keep-oldest',
): StoredMessage[] {
  const candidates = keep === 'keep-newest' ? [...messages].reverse() : messages;
  const keptMessages: StoredMessage[] = [];
  let usedCharacters = 0;

  for (const message of candidates) {
    const lineLength = formatMessage(message, timeZone).length + 1;

    if (usedCharacters + lineLength > MAX_TOOL_RESULT_CHARS) {
      break;
    }

    keptMessages.push(message);
    usedCharacters += lineLength;
  }

  return keep === 'keep-newest' ? keptMessages.reverse() : keptMessages;
}

function renderMessages(messages: StoredMessage[], timeZone: string, footer: string): string {
  if (messages.length === 0) {
    return 'No messages found.';
  }

  return `${formatTranscript(messages, timeZone)}\n\n${footer}`;
}
