import type { Message } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import { isAddressedToBot, stripMention } from '../src/trigger.js';

const bot = { id: 999, username: 'ame_bot' };

function groupMessage(overrides: Partial<Message> = {}): Message {
  return {
    message_id: 1,
    date: 0,
    chat: { id: -100, type: 'supergroup', title: 'Group' },
    from: { id: 1, is_bot: false, first_name: 'Alice' },
    ...overrides,
  } as Message;
}

describe('isAddressedToBot', () => {
  it('treats every private message as addressed', () => {
    const message = groupMessage({
      chat: { id: 1, type: 'private', first_name: 'Alice' },
      text: 'hello',
    });

    expect(isAddressedToBot(message, bot)).toBe(true);
  });

  it('detects a mention entity regardless of case', () => {
    const message = groupMessage({
      text: 'hey @Ame_Bot what is up',
      entities: [{ type: 'mention', offset: 4, length: 8 }],
    });

    expect(isAddressedToBot(message, bot)).toBe(true);
  });

  it('detects a mention in a media caption', () => {
    const message = groupMessage({
      caption: '@ame_bot what is this',
      caption_entities: [{ type: 'mention', offset: 0, length: 8 }],
    });

    expect(isAddressedToBot(message, bot)).toBe(true);
  });

  it('ignores mentions of other users', () => {
    const message = groupMessage({
      text: '@someone_else hi',
      entities: [{ type: 'mention', offset: 0, length: 13 }],
    });

    expect(isAddressedToBot(message, bot)).toBe(false);
  });

  it('ignores the username as plain text without a mention entity', () => {
    expect(isAddressedToBot(groupMessage({ text: 'ame_bot is cool' }), bot)).toBe(false);
  });

  it('detects replies to the bot', () => {
    const message = groupMessage({
      text: 'and why?',
      reply_to_message: groupMessage({
        from: { id: 999, is_bot: true, first_name: 'Ame' },
        text: 'because',
      }) as Message['reply_to_message'],
    });

    expect(isAddressedToBot(message, bot)).toBe(true);
  });

  it('ignores replies to other users', () => {
    const message = groupMessage({
      text: 'and why?',
      reply_to_message: groupMessage({ text: 'because' }) as Message['reply_to_message'],
    });

    expect(isAddressedToBot(message, bot)).toBe(false);
  });
});

describe('stripMention', () => {
  it('removes a leading mention and punctuation', () => {
    expect(stripMention('@ame_bot, what is up?', 'ame_bot')).toBe('what is up?');
  });

  it('removes a mention in the middle of the text', () => {
    expect(stripMention('so @AME_BOT what do you think', 'ame_bot')).toBe('so what do you think');
  });

  it('keeps longer usernames that only share a prefix', () => {
    expect(stripMention('@ame_bot2 hi', 'ame_bot')).toBe('@ame_bot2 hi');
  });

  it('returns an empty string for a bare mention', () => {
    expect(stripMention('@ame_bot', 'ame_bot')).toBe('');
  });
});
