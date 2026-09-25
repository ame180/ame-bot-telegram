import { GrammyError } from 'grammy';
import type { Message } from 'grammy/types';
import { describe, expect, it, vi } from 'vitest';
import { htmlToPlainText, sendReply, splitMessage } from '../../src/telegram/send.js';

function sentMessage(text: string): Message.TextMessage {
  return {
    message_id: 1,
    date: 0,
    chat: { id: 1, type: 'private', first_name: 'Ame' },
    text,
  } as Message.TextMessage;
}

function parseError(): GrammyError {
  return new GrammyError(
    'Call to sendMessage failed',
    {
      ok: false,
      error_code: 400,
      description: 'Bad Request: can\'t parse entities: Unsupported start tag "p"',
    },
    'sendMessage',
    {},
  );
}

describe('sendReply', () => {
  it('sends HTML and replies to the target message', async () => {
    const sendMessage = vi.fn(async (_chatId: number, text: string) => sentMessage(text));

    await sendReply({ sendMessage }, { chatId: 5, replyToMessageId: 7, threadId: 3 }, '<b>hi</b>');

    expect(sendMessage).toHaveBeenCalledWith(5, '<b>hi</b>', {
      parse_mode: 'HTML',
      message_thread_id: 3,
      reply_parameters: { message_id: 7, allow_sending_without_reply: true },
    });
  });

  it('falls back to plain text when Telegram rejects the HTML', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(parseError())
      .mockImplementation(async (_chatId: number, text: string) => sentMessage(text));

    const sent = await sendReply({ sendMessage }, { chatId: 5 }, '<p>a &amp; b</p>');

    expect(sendMessage).toHaveBeenLastCalledWith(5, 'a & b', {});
    expect(sent[0]?.text).toBe('a & b');
  });

  it('rethrows errors that are not HTML parse errors', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(sendReply({ sendMessage }, { chatId: 5 }, 'hi')).rejects.toThrow('network down');
  });

  it('only quotes the original message on the first chunk', async () => {
    const sendMessage = vi.fn(async (_chatId: number, text: string, _options?: object) =>
      sentMessage(text),
    );
    const longText = `${'a'.repeat(4000)}\n${'b'.repeat(200)}`;

    const sent = await sendReply({ sendMessage }, { chatId: 5, replyToMessageId: 7 }, longText);

    expect(sent).toHaveLength(2);
    expect(sendMessage.mock.calls[0]?.[2]).toHaveProperty('reply_parameters');
    expect(sendMessage.mock.calls[1]?.[2]).not.toHaveProperty('reply_parameters');
  });
});

describe('splitMessage', () => {
  it('keeps short text as a single chunk', () => {
    expect(splitMessage('hello')).toEqual(['hello']);
  });

  it('prefers splitting on newlines', () => {
    expect(splitMessage('aaaaaa\nbb cc', 10)).toEqual(['aaaaaa', 'bb cc']);
  });

  it('falls back to spaces, then hard cuts', () => {
    expect(splitMessage('aaaaaa bbbbbb', 10)).toEqual(['aaaaaa', 'bbbbbb']);
    expect(splitMessage('a'.repeat(25), 10)).toEqual([
      'a'.repeat(10),
      'a'.repeat(10),
      'a'.repeat(5),
    ]);
  });

  it('returns nothing for blank text', () => {
    expect(splitMessage('   ')).toEqual([]);
  });
});

describe('htmlToPlainText', () => {
  it('strips tags and decodes entities', () => {
    expect(htmlToPlainText('<b>x</b> &lt;tag&gt; &amp;amp;<br/>y')).toBe('x <tag> &amp;\ny');
  });
});
