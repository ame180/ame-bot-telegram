import type { Message } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import { toStoredMessage } from '../../src/storage/fromTelegram.js';

function telegramMessage(overrides: Partial<Message>): Message {
  return {
    message_id: 10,
    date: 1_000,
    chat: { id: -100, type: 'supergroup', title: 'Group' },
    from: { id: 1, is_bot: false, first_name: 'Alice', last_name: 'Smith', username: 'alice' },
    ...overrides,
  } as Message;
}

describe('toStoredMessage', () => {
  it('maps a text message', () => {
    const stored = toStoredMessage(
      telegramMessage({
        text: 'hello',
        reply_to_message: telegramMessage({ message_id: 9 }) as Message['reply_to_message'],
      }),
    );

    expect(stored).toEqual({
      chatId: -100,
      messageId: 10,
      threadId: null,
      userId: 1,
      author: 'Alice Smith (@alice)',
      isBot: false,
      text: 'hello',
      replyToMessageId: 9,
      date: 1_000,
      editedDate: null,
    });
  });

  it('labels media and keeps the caption', () => {
    const stored = toStoredMessage(
      telegramMessage({ photo: [], caption: 'look at this' } as Partial<Message>),
    );

    expect(stored?.text).toBe('[photo] look at this');
  });

  it('labels stickers with their emoji', () => {
    const stored = toStoredMessage(
      telegramMessage({ sticker: { emoji: '😀' } } as unknown as Partial<Message>),
    );

    expect(stored?.text).toBe('[sticker 😀]');
  });

  it('skips service messages without content', () => {
    expect(
      toStoredMessage(telegramMessage({ new_chat_members: [] } as Partial<Message>)),
    ).toBeNull();
  });

  it('uses the sender chat for anonymous admins and keeps topic ids', () => {
    const stored = toStoredMessage(
      telegramMessage({
        text: 'announcement',
        sender_chat: { id: -100, type: 'supergroup', title: 'Group' },
        is_topic_message: true,
        message_thread_id: 42,
      }),
    );

    expect(stored).toMatchObject({ author: 'Group', threadId: 42 });
  });

  it('marks forwarded messages', () => {
    const stored = toStoredMessage(
      telegramMessage({
        text: 'news',
        forward_origin: { type: 'hidden_user', sender_user_name: 'Bob', date: 900 },
      }),
    );

    expect(stored?.text).toBe('[forwarded] news');
  });
});
