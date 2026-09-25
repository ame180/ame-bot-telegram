import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadBotTexts } from '../src/prompts.js';

describe('loadBotTexts', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = mkdtempSync(join(tmpdir(), 'ame-bot-'));
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it('falls back to defaults when files are missing', () => {
    const texts = loadBotTexts(rootDirectory);

    expect(texts.systemPrompt).toContain('Ame Bot');
    expect(texts.responses.greeting).toBe('Hey! How can I help you?');
  });

  it('reads the prompt file and merges responses with defaults', () => {
    writeFileSync(join(rootDirectory, 'system_prompt.md'), 'Custom prompt');
    writeFileSync(join(rootDirectory, 'responses.json'), JSON.stringify({ greeting: 'Hi :3' }));

    const texts = loadBotTexts(rootDirectory);

    expect(texts.systemPrompt).toBe('Custom prompt');
    expect(texts.responses.greeting).toBe('Hi :3');
    expect(texts.responses.error).toContain('error');
  });
});
