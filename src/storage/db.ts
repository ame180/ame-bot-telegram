import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS: string[] = [
  `CREATE TABLE messages (
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    thread_id INTEGER,
    user_id INTEGER,
    author TEXT NOT NULL,
    is_bot INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    reply_to_message_id INTEGER,
    date INTEGER NOT NULL,
    edited_date INTEGER,
    PRIMARY KEY (chat_id, message_id)
  );
  CREATE INDEX messages_chat_date ON messages (chat_id, date);`,
];

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(db);

  return db;
}

function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get();
  const currentVersion = Number(row?.user_version ?? 0);

  for (const [index, migration] of MIGRATIONS.entries()) {
    const version = index + 1;

    if (version <= currentVersion) {
      continue;
    }

    db.exec('BEGIN');
    try {
      db.exec(migration);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    console.log(`Applied database migration ${version}.`);
  }
}
