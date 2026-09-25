import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/storage/db.js';
import { MessageStore, type StoredMessage } from '../../src/storage/messages.js';
import { pruneExpiredMessages } from '../../src/storage/retention.js';

const CHAT = -100;
const OTHER_CHAT = -200;

function message(overrides: Partial<StoredMessage> & { messageId: number }): StoredMessage {
  return {
    chatId: CHAT,
    threadId: null,
    userId: 1,
    author: 'Alice',
    isBot: false,
    text: `message ${overrides.messageId}`,
    replyToMessageId: null,
    date: 1_000 + overrides.messageId,
    editedDate: null,
    ...overrides,
  };
}

describe('MessageStore', () => {
  let db: DatabaseSync;
  let store: MessageStore;

  beforeEach(() => {
    db = openDatabase(':memory:');
    store = new MessageStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it('round-trips a message', () => {
    const original = message({ messageId: 1, isBot: true, threadId: 5, replyToMessageId: 0 });

    store.save(original);

    expect(store.get(CHAT, 1)).toEqual(original);
  });

  it('updates text and edit date when a message is edited', () => {
    store.save(message({ messageId: 1, text: 'before' }));
    store.save(message({ messageId: 1, text: 'after', editedDate: 2_000 }));

    expect(store.get(CHAT, 1)).toMatchObject({ text: 'after', editedDate: 2_000, date: 1_001 });
  });

  it('returns the latest messages in chronological order', () => {
    for (const messageId of [1, 2, 3, 4]) {
      store.save(message({ messageId }));
    }
    store.save(message({ messageId: 5, chatId: OTHER_CHAT }));

    expect(store.getRecent(CHAT, 2).map((stored) => stored.messageId)).toEqual([3, 4]);
  });

  it('pages backwards before a message id', () => {
    for (const messageId of [1, 2, 3, 4, 5]) {
      store.save(message({ messageId }));
    }

    expect(store.getBefore(CHAT, 4, 2).map((stored) => stored.messageId)).toEqual([2, 3]);
  });

  it('returns messages within a date range, oldest first', () => {
    for (const messageId of [1, 2, 3, 4]) {
      store.save(message({ messageId }));
    }

    const inRange = store.getInRange(CHAT, 1_002, 1_004, 10);

    expect(inRange.map((stored) => stored.messageId)).toEqual([2, 3]);
  });

  it('searches case-insensitively and treats wildcards literally', () => {
    store.save(message({ messageId: 1, text: 'Pizza tonight?' }));
    store.save(message({ messageId: 2, text: 'no pizza for me' }));
    store.save(message({ messageId: 3, text: '100% sure' }));
    store.save(message({ messageId: 4, text: '100 percent' }));
    store.save(message({ messageId: 5, chatId: OTHER_CHAT, text: 'pizza elsewhere' }));

    expect(store.search(CHAT, 'PIZZA', 10).map((stored) => stored.messageId)).toEqual([2, 1]);
    expect(store.search(CHAT, '100%', 10).map((stored) => stored.messageId)).toEqual([3]);
  });

  it('walks the reply chain up to the max depth', () => {
    store.save(message({ messageId: 1 }));
    store.save(message({ messageId: 2, replyToMessageId: 1 }));
    store.save(message({ messageId: 3, replyToMessageId: 2 }));
    store.save(message({ messageId: 4, replyToMessageId: 3 }));

    expect(store.getReplyChain(CHAT, 4, 10).map((stored) => stored.messageId)).toEqual([1, 2, 3]);
    expect(store.getReplyChain(CHAT, 4, 2).map((stored) => stored.messageId)).toEqual([2, 3]);
  });

  it('stops the reply chain at messages that were never stored', () => {
    store.save(message({ messageId: 2, replyToMessageId: 1 }));
    store.save(message({ messageId: 3, replyToMessageId: 2 }));

    expect(store.getReplyChain(CHAT, 3, 10).map((stored) => stored.messageId)).toEqual([2]);
  });

  it('prunes messages older than the retention period', () => {
    const day = 24 * 60 * 60;
    const now = 100 * day;
    store.save(message({ messageId: 1, date: now - 31 * day }));
    store.save(message({ messageId: 2, date: now - 29 * day }));

    expect(pruneExpiredMessages(store, 30, now)).toBe(1);
    expect(store.get(CHAT, 1)).toBeUndefined();
    expect(store.get(CHAT, 2)).toBeDefined();
  });
});
