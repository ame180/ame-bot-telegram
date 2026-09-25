import type { StoredMessage } from '../storage/messages.js';

export function formatTimestamp(unixSeconds: number, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(unixSeconds * 1000));
}

export function formatUtcOffset(date: Date, timeZone: string): string {
  const offsetPart = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName');

  return offsetPart?.value.replace('GMT', 'UTC') || 'UTC';
}

export function formatMessage(message: StoredMessage, timeZone: string): string {
  const notes = [
    message.replyToMessageId === null ? null : `reply to #${message.replyToMessageId}`,
    message.editedDate === null ? null : 'edited',
  ].filter((note) => note !== null);
  const suffix = notes.length === 0 ? '' : ` (${notes.join(', ')})`;
  const author = message.isBot ? `${message.author} [bot]` : message.author;

  return `[#${message.messageId} ${formatTimestamp(message.date, timeZone)}] ${author}${suffix}: ${message.text}`;
}

export function formatTranscript(messages: StoredMessage[], timeZone: string): string {
  return messages.map((message) => formatMessage(message, timeZone)).join('\n');
}
