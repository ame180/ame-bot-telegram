import type { Context, MiddlewareFn } from 'grammy';
import type { Message } from 'grammy/types';
import { toStoredMessage } from './fromTelegram.js';
import type { MessageStore } from './messages.js';

export function recordMessage(store: MessageStore, message: Message): void {
  const storedMessage = toStoredMessage(message);

  if (storedMessage === null) {
    return;
  }

  try {
    store.save(storedMessage);
  } catch (error) {
    console.error(`Failed to store message ${message.chat.id}:${message.message_id}:`, error);
  }
}

export function recordIncomingMessages(store: MessageStore): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const message = ctx.message ?? ctx.editedMessage;

    if (message !== undefined) {
      recordMessage(store, message);
    }

    await next();
  };
}
