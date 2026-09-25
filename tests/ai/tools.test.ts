import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHistoryTools, MAX_TOOL_RESULT_CHARS } from '../../src/ai/tools.js';
import { openDatabase } from '../../src/storage/db.js';
import { MessageStore, type StoredMessage } from '../../src/storage/messages.js';

const CHAT = -100;
const OTHER_CHAT = -200;
const BASE_DATE = Date.parse('2026-09-25T10:00:00Z') / 1000;

function message(messageId: number, overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    chatId: CHAT,
    messageId,
    threadId: null,
    userId: 1,
    author: 'Alice',
    isBot: false,
    text: `message ${messageId}`,
    replyToMessageId: null,
    date: BASE_DATE + messageId * 60,
    editedDate: null,
    ...overrides,
  };
}

interface ExecutableTool<Input> {
  execute?: (input: Input, options: never) => unknown;
}

async function run<Input>(tool: ExecutableTool<Input>, input: Input): Promise<string> {
  const execute = tool.execute;
  if (execute === undefined) {
    throw new Error('Tool has no execute function');
  }

  return String(await execute(input, { toolCallId: 'call', messages: [], context: {} } as never));
}

describe('history tools', () => {
  let db: DatabaseSync;
  let store: MessageStore;
  let tools: ReturnType<typeof createHistoryTools>;

  beforeEach(() => {
    db = openDatabase(':memory:');
    store = new MessageStore(db);
    tools = createHistoryTools({ store, chatId: CHAT, timeZone: 'UTC' });
  });

  afterEach(() => {
    db.close();
  });

  describe('get_messages_before', () => {
    it('returns older messages with a paging hint', async () => {
      for (const messageId of [1, 2, 3, 4, 5]) {
        store.save(message(messageId));
      }

      const result = await run(tools.get_messages_before, { before_message_id: 5, limit: 2 });

      expect(result).toContain('[#3 2026-09-25 10:03] Alice: message 3');
      expect(result).toContain('#4');
      expect(result).not.toContain('#2 ');
      expect(result).toContain('call again with before_message_id=3');
    });

    it('says when the beginning of history is reached', async () => {
      store.save(message(1));

      const result = await run(tools.get_messages_before, { before_message_id: 5, limit: 10 });

      expect(result).toContain('beginning of the stored history');
    });
  });

  describe('get_messages_in_range', () => {
    it('returns messages in the range, oldest first', async () => {
      for (const messageId of [1, 2, 3, 4]) {
        store.save(message(messageId));
      }

      const result = await run(tools.get_messages_in_range, {
        from: '2026-09-25T12:02:00+02:00',
        to: '2026-09-25T10:04:00Z',
        limit: 200,
      });

      expect(result.indexOf('#2')).toBeLessThan(result.indexOf('#3'));
      expect(result).not.toContain('#1 ');
      expect(result).not.toContain('#4 ');
      expect(result).toContain('No more messages in this range.');
    });

    it('hints how to continue when the limit is hit', async () => {
      for (const messageId of [1, 2, 3]) {
        store.save(message(messageId));
      }

      const result = await run(tools.get_messages_in_range, {
        from: '2026-09-25T00:00:00Z',
        to: '2026-09-26T00:00:00Z',
        limit: 2,
      });

      expect(result).toContain('call again with from=2026-09-25T10:02:00.000Z');
    });

    it('rejects invalid dates', async () => {
      const result = await run(tools.get_messages_in_range, {
        from: 'yesterday',
        to: 'today',
        limit: 10,
      });

      expect(result).toMatch(/^Error:/);
    });
  });

  describe('search_messages', () => {
    it('finds matching messages in chronological order', async () => {
      store.save(message(1, { text: 'Pizza tonight?' }));
      store.save(message(2, { text: 'sure' }));
      store.save(message(3, { text: 'pineapple pizza is fine' }));

      const result = await run(tools.search_messages, { query: 'pizza', limit: 30 });

      expect(result.indexOf('#1')).toBeLessThan(result.indexOf('#3'));
      expect(result).not.toContain('#2 ');
    });

    it('reports when nothing matches', async () => {
      expect(await run(tools.search_messages, { query: 'nothing', limit: 30 })).toBe(
        'No messages found.',
      );
    });
  });

  it('never returns messages from other chats', async () => {
    store.save(message(1, { chatId: OTHER_CHAT, text: 'secret pizza' }));

    const results = await Promise.all([
      run(tools.get_messages_before, { before_message_id: 100, limit: 200 }),
      run(tools.get_messages_in_range, {
        from: '2000-01-01T00:00:00Z',
        to: '2100-01-01T00:00:00Z',
        limit: 200,
      }),
      run(tools.search_messages, { query: 'secret', limit: 30 }),
    ]);

    for (const result of results) {
      expect(result).toBe('No messages found.');
    }
  });

  it('trims results to the character budget, keeping the newest messages', async () => {
    const longText = 'x'.repeat(4000);
    for (let messageId = 1; messageId <= 10; messageId++) {
      store.save(message(messageId, { text: longText }));
    }

    const result = await run(tools.get_messages_before, { before_message_id: 11, limit: 10 });

    expect(result.length).toBeLessThan(MAX_TOOL_RESULT_CHARS + 500);
    expect(result).toContain('[#10 ');
    expect(result).not.toContain('[#1 ');
    const oldestKeptId = result.match(/before_message_id=(\d+)/)?.[1];
    expect(result).toContain(`[#${oldestKeptId} `);
  });
});
