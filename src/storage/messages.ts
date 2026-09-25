import type { DatabaseSync, SQLOutputValue, StatementSync } from 'node:sqlite';

export interface StoredMessage {
  chatId: number;
  messageId: number;
  threadId: number | null;
  userId: number | null;
  author: string;
  isBot: boolean;
  text: string;
  replyToMessageId: number | null;
  date: number;
  editedDate: number | null;
}

type Row = Record<string, SQLOutputValue>;

export class MessageStore {
  private readonly upsertStatement: StatementSync;
  private readonly getStatement: StatementSync;
  private readonly recentStatement: StatementSync;
  private readonly beforeStatement: StatementSync;
  private readonly rangeStatement: StatementSync;
  private readonly searchStatement: StatementSync;
  private readonly pruneStatement: StatementSync;

  constructor(db: DatabaseSync) {
    this.upsertStatement = db.prepare(`
      INSERT INTO messages (
        chat_id, message_id, thread_id, user_id, author, is_bot, text, reply_to_message_id, date, edited_date
      ) VALUES (
        :chatId, :messageId, :threadId, :userId, :author, :isBot, :text, :replyToMessageId, :date, :editedDate
      )
      ON CONFLICT (chat_id, message_id) DO UPDATE SET
        text = excluded.text,
        author = excluded.author,
        edited_date = excluded.edited_date
    `);
    this.getStatement = db.prepare(
      'SELECT * FROM messages WHERE chat_id = :chatId AND message_id = :messageId',
    );
    this.recentStatement = db.prepare(`
      SELECT * FROM messages WHERE chat_id = :chatId
      ORDER BY date DESC, message_id DESC LIMIT :limit
    `);
    this.beforeStatement = db.prepare(`
      SELECT * FROM messages WHERE chat_id = :chatId AND message_id < :beforeMessageId
      ORDER BY message_id DESC LIMIT :limit
    `);
    this.rangeStatement = db.prepare(`
      SELECT * FROM messages WHERE chat_id = :chatId AND date >= :fromDate AND date < :toDate
      ORDER BY date ASC, message_id ASC LIMIT :limit
    `);
    this.searchStatement = db.prepare(`
      SELECT * FROM messages WHERE chat_id = :chatId AND text LIKE :pattern ESCAPE '\\'
      ORDER BY date DESC, message_id DESC LIMIT :limit
    `);
    this.pruneStatement = db.prepare('DELETE FROM messages WHERE date < :cutoffDate');
  }

  save(message: StoredMessage): void {
    this.upsertStatement.run({ ...message, isBot: message.isBot ? 1 : 0 });
  }

  get(chatId: number, messageId: number): StoredMessage | undefined {
    const row = this.getStatement.get({ chatId, messageId });

    return row === undefined ? undefined : toStoredMessage(row);
  }

  /** Latest messages of the chat, oldest first. */
  getRecent(chatId: number, limit: number): StoredMessage[] {
    return this.recentStatement.all({ chatId, limit }).map(toStoredMessage).reverse();
  }

  /** Messages sent before the given message, oldest first. */
  getBefore(chatId: number, beforeMessageId: number, limit: number): StoredMessage[] {
    return this.beforeStatement
      .all({ chatId, beforeMessageId, limit })
      .map(toStoredMessage)
      .reverse();
  }

  /** Messages with fromDate <= date < toDate (unix seconds), oldest first. */
  getInRange(chatId: number, fromDate: number, toDate: number, limit: number): StoredMessage[] {
    return this.rangeStatement.all({ chatId, fromDate, toDate, limit }).map(toStoredMessage);
  }

  /** Case-insensitive (ASCII only) substring search, newest first. */
  search(chatId: number, query: string, limit: number): StoredMessage[] {
    const pattern = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;

    return this.searchStatement.all({ chatId, pattern, limit }).map(toStoredMessage);
  }

  /** Messages the given message replies to, walking up the chain, oldest first. */
  getReplyChain(chatId: number, messageId: number, maxDepth: number): StoredMessage[] {
    const chain: StoredMessage[] = [];
    let replyToMessageId = this.get(chatId, messageId)?.replyToMessageId ?? null;

    while (replyToMessageId !== null && chain.length < maxDepth) {
      const parent = this.get(chatId, replyToMessageId);

      if (parent === undefined) {
        break;
      }

      chain.unshift(parent);
      replyToMessageId = parent.replyToMessageId;
    }

    return chain;
  }

  pruneOlderThan(cutoffDate: number): number {
    return Number(this.pruneStatement.run({ cutoffDate }).changes);
  }
}

function toStoredMessage(row: Row): StoredMessage {
  return {
    chatId: Number(row.chat_id),
    messageId: Number(row.message_id),
    threadId: nullableNumber(row.thread_id),
    userId: nullableNumber(row.user_id),
    author: String(row.author),
    isBot: Number(row.is_bot) === 1,
    text: String(row.text),
    replyToMessageId: nullableNumber(row.reply_to_message_id),
    date: Number(row.date),
    editedDate: nullableNumber(row.edited_date),
  };
}

function nullableNumber(value: SQLOutputValue | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}
