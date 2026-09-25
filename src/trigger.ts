import type { Message, MessageEntity } from 'grammy/types';

export interface BotIdentity {
  id: number;
  username: string;
}

export function isAddressedToBot(message: Message, bot: BotIdentity): boolean {
  if (message.chat.type === 'private') {
    return true;
  }

  if (message.reply_to_message?.from?.id === bot.id) {
    return true;
  }

  return mentionsBot(message, bot.username);
}

export function stripMention(text: string, botUsername: string): string {
  const mentionPattern = new RegExp(`@${escapeRegExp(botUsername)}\\b`, 'gi');

  return text
    .replace(mentionPattern, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[,.:;!\-–—\s]+/u, '');
}

function mentionsBot(message: Message, botUsername: string): boolean {
  const text = message.text ?? message.caption ?? '';
  const entities: MessageEntity[] = message.entities ?? message.caption_entities ?? [];
  const expectedMention = `@${botUsername}`.toLowerCase();

  return entities.some(
    (entity) =>
      entity.type === 'mention' &&
      text.substring(entity.offset, entity.offset + entity.length).toLowerCase() ===
        expectedMention,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
