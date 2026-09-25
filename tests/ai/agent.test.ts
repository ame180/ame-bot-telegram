import type { DatabaseSync } from 'node:sqlite';
import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Agent, type AgentOptions } from '../../src/ai/agent.js';
import { openDatabase } from '../../src/storage/db.js';
import { MessageStore, type StoredMessage } from '../../src/storage/messages.js';

const CHAT = -100;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function textModel(text: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

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
    date: 1_758_800_000 + messageId * 60,
    editedDate: null,
    ...overrides,
  };
}

describe('Agent', () => {
  let db: DatabaseSync;
  let store: MessageStore;

  beforeEach(() => {
    db = openDatabase(':memory:');
    store = new MessageStore(db);
  });

  afterEach(() => {
    db.close();
  });

  function createAgent(model: MockLanguageModelV4, overrides: Partial<AgentOptions> = {}): Agent {
    return new Agent({
      model,
      systemPrompt: 'You are Ame Bot.',
      store,
      contextMessages: 2,
      retentionDays: 30,
      timeZone: 'Europe/Warsaw',
      now: () => new Date('2026-09-25T12:00:00Z'),
      ...overrides,
    });
  }

  function promptOf(model: MockLanguageModelV4): string {
    return JSON.stringify(model.doGenerateCalls[0]?.prompt);
  }

  it('returns trimmed text and sends the system prompt with the current time', async () => {
    const model = textModel('  Hello!  ');

    const reply = await createAgent(model).reply({
      chatId: CHAT,
      messageId: 1,
      author: 'Alice',
      question: 'hi there',
    });

    expect(reply).toBe('Hello!');
    expect(promptOf(model)).toContain('You are Ame Bot.');
    expect(promptOf(model)).toContain('Current time: 2026-09-25 14:00 (Europe/Warsaw, UTC+02:00)');
    expect(promptOf(model)).toContain('hi there');
  });

  it('includes recent messages but not the triggering message twice', async () => {
    for (const messageId of [1, 2, 3, 4]) {
      store.save(message(messageId));
    }
    const model = textModel('ok');

    await createAgent(model).reply({ chatId: CHAT, messageId: 4, author: 'Alice', question: 'q' });

    const prompt = promptOf(model);
    expect(prompt).not.toContain('message 1');
    expect(prompt).toContain('message 2');
    expect(prompt).toContain('message 3');
    expect(prompt).not.toContain('message 4');
    expect(prompt).toContain('Message #4 from Alice');
  });

  it('includes older reply-chain messages outside the recent window', async () => {
    store.save(message(1, { text: 'the original question' }));
    for (const messageId of [2, 3, 4]) {
      store.save(message(messageId));
    }
    store.save(message(5, { replyToMessageId: 1 }));
    const model = textModel('ok');

    await createAgent(model).reply({ chatId: CHAT, messageId: 5, author: 'Alice', question: 'q' });

    const prompt = promptOf(model);
    expect(prompt).toContain('Earlier messages in the reply thread');
    expect(prompt).toContain('the original question');
  });

  it('never includes messages from other chats', async () => {
    store.save(message(1, { chatId: -999, text: 'secret from another chat' }));
    const model = textModel('ok');

    await createAgent(model).reply({ chatId: CHAT, messageId: 2, author: 'Alice', question: 'q' });

    expect(promptOf(model)).not.toContain('secret from another chat');
  });
});
