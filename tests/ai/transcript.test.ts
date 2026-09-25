import { describe, expect, it } from 'vitest';
import { formatMessage, formatUtcOffset } from '../../src/ai/transcript.js';
import type { StoredMessage } from '../../src/storage/messages.js';

const baseMessage: StoredMessage = {
  chatId: -100,
  messageId: 42,
  threadId: null,
  userId: 1,
  author: 'Alice (@alice)',
  isBot: false,
  text: 'hello',
  replyToMessageId: null,
  date: Date.parse('2026-09-25T12:03:00Z') / 1000,
  editedDate: null,
};

describe('formatMessage', () => {
  it('formats id, local time, author and text', () => {
    expect(formatMessage(baseMessage, 'Europe/Warsaw')).toBe(
      '[#42 2026-09-25 14:03] Alice (@alice): hello',
    );
  });

  it('marks bots, replies and edits', () => {
    const formatted = formatMessage(
      { ...baseMessage, isBot: true, author: 'Ame', replyToMessageId: 40, editedDate: 1 },
      'UTC',
    );

    expect(formatted).toBe('[#42 2026-09-25 12:03] Ame [bot] (reply to #40, edited): hello');
  });
});

describe('formatUtcOffset', () => {
  it('formats the offset for the given zone', () => {
    const date = new Date('2026-01-15T12:00:00Z');

    expect(formatUtcOffset(date, 'Europe/Warsaw')).toBe('UTC+01:00');
    expect(formatUtcOffset(date, 'UTC')).toBe('UTC+00:00');
  });
});
