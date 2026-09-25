import type { Message } from 'grammy/types';
import type { StoredMessage } from './messages.js';

export function toStoredMessage(message: Message): StoredMessage | null {
  const text = describeContent(message);

  if (text === null) {
    return null;
  }

  return {
    chatId: message.chat.id,
    messageId: message.message_id,
    threadId: message.is_topic_message ? (message.message_thread_id ?? null) : null,
    userId: message.from?.id ?? null,
    author: describeAuthor(message),
    isBot: message.from?.is_bot ?? false,
    text: message.forward_origin ? `[forwarded] ${text}` : text,
    replyToMessageId: message.reply_to_message?.message_id ?? null,
    date: message.date,
    editedDate: message.edit_date ?? null,
  };
}

export function describeAuthor(message: Message): string {
  if (message.sender_chat) {
    return message.sender_chat.title ?? 'Anonymous';
  }

  const user = message.from;

  if (user === undefined) {
    return 'Unknown';
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');

  return user.username ? `${fullName} (@${user.username})` : fullName;
}

function describeContent(message: Message): string | null {
  const caption = message.text ?? message.caption ?? '';
  const mediaLabel = describeMedia(message);

  if (mediaLabel === null) {
    return caption === '' ? null : caption;
  }

  return caption === '' ? mediaLabel : `${mediaLabel} ${caption}`;
}

function describeMedia(message: Message): string | null {
  if (message.photo) return '[photo]';
  if (message.video) return '[video]';
  if (message.animation) return '[GIF]';
  if (message.video_note) return '[video message]';
  if (message.voice) return '[voice message]';
  if (message.audio) return `[audio: ${message.audio.title ?? message.audio.file_name ?? 'file'}]`;
  if (message.document) return `[file: ${message.document.file_name ?? 'document'}]`;
  if (message.sticker) return `[sticker ${message.sticker.emoji ?? ''}]`.replace(' ]', ']');
  if (message.poll) return `[poll: ${message.poll.question}]`;
  if (message.location) return '[location]';
  if (message.contact) return `[contact: ${message.contact.first_name}]`;

  return null;
}
