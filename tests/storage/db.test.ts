import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../../src/storage/db.js';

describe('openDatabase', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = mkdtempSync(join(tmpdir(), 'ame-bot-db-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it('creates missing directories and can reopen an existing database', () => {
    const path = join(rootDirectory, 'nested', 'bot.sqlite');

    openDatabase(path).close();
    const reopened = openDatabase(path);

    expect(reopened.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
    expect(reopened.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    reopened.close();
  });
});
