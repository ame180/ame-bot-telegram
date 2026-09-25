import { type Api, GrammyError } from 'grammy';
import type { Message } from 'grammy/types';

export const TELEGRAM_MESSAGE_LIMIT = 4096;

const TYPING_REFRESH_MS = 4_000;

export interface ReplyTarget {
  chatId: number;
  replyToMessageId?: number | undefined;
  threadId?: number | undefined;
}

type MessageSender = Pick<Api, 'sendMessage'>;
type SendMessageOptions = NonNullable<Parameters<Api['sendMessage']>[2]>;

export async function sendReply(
  api: MessageSender,
  target: ReplyTarget,
  text: string,
): Promise<Message.TextMessage[]> {
  const sentMessages: Message.TextMessage[] = [];

  for (const [index, chunk] of splitMessage(text).entries()) {
    const options: SendMessageOptions = {};

    if (target.threadId !== undefined) {
      options.message_thread_id = target.threadId;
    }

    if (index === 0 && target.replyToMessageId !== undefined) {
      options.reply_parameters = {
        message_id: target.replyToMessageId,
        allow_sending_without_reply: true,
      };
    }

    sentMessages.push(await sendHtmlWithPlainFallback(api, target.chatId, chunk, options));
  }

  return sentMessages;
}

export function keepTyping(api: Pick<Api, 'sendChatAction'>, target: ReplyTarget): () => void {
  const sendTyping = () => {
    const options = target.threadId === undefined ? {} : { message_thread_id: target.threadId };
    api.sendChatAction(target.chatId, 'typing', options).catch(() => {});
  };

  sendTyping();
  const interval = setInterval(sendTyping, TYPING_REFRESH_MS);

  return () => clearInterval(interval);
}

export function splitMessage(text: string, limit = TELEGRAM_MESSAGE_LIMIT): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const newlineIndex = window.lastIndexOf('\n');
    const spaceIndex = window.lastIndexOf(' ');
    const minimumBreak = limit / 2;

    let breakIndex = limit;
    if (newlineIndex > minimumBreak) {
      breakIndex = newlineIndex;
    } else if (spaceIndex > minimumBreak) {
      breakIndex = spaceIndex;
    }

    chunks.push(remaining.slice(0, breakIndex).trimEnd());
    remaining = remaining.slice(breakIndex).trimStart();
  }

  if (remaining !== '') {
    chunks.push(remaining);
  }

  return chunks;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

async function sendHtmlWithPlainFallback(
  api: MessageSender,
  chatId: number,
  text: string,
  options: SendMessageOptions,
): Promise<Message.TextMessage> {
  try {
    return await api.sendMessage(chatId, text, { ...options, parse_mode: 'HTML' });
  } catch (error) {
    if (!isEntityParseError(error)) {
      throw error;
    }

    console.warn(`Telegram rejected HTML, sending as plain text: ${error.description}`);

    return api.sendMessage(chatId, htmlToPlainText(text), options);
  }
}

function isEntityParseError(error: unknown): error is GrammyError {
  return (
    error instanceof GrammyError &&
    error.error_code === 400 &&
    /can't parse entities/i.test(error.description)
  );
}
