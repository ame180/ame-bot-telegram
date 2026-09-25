import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';

const validEnv = {
  BOT_TOKEN: 'token',
  UPDATE_TIMEOUT_SECONDS: '10',
  OPENROUTER_API_KEY: 'key',
  OPENROUTER_MODEL: 'some/model',
};

describe('parseConfig', () => {
  it('parses a valid environment with defaults', () => {
    const config = parseConfig(validEnv);

    expect(config.updateTimeoutSeconds).toBe(10);
    expect(config.dbPath).toBe('data/bot.sqlite');
    expect(config.retentionDays).toBe(30);
    expect(config.contextMessages).toBe(20);
    expect(config.timeZone).toBe('UTC');
  });

  it('lists every missing required variable', () => {
    expect(() => parseConfig({})).toThrow(/BOT_TOKEN[\s\S]*OPENROUTER_API_KEY/);
  });

  it('rejects unknown time zones', () => {
    expect(() => parseConfig({ ...validEnv, TIME_ZONE: 'Mars/Olympus' })).toThrow(/TIME_ZONE/);
  });
});
