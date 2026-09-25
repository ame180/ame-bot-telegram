import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_SYSTEM_PROMPT =
  'You are Ame Bot. A helpful and friendly Telegram Bot created by Ame.';

const DEFAULT_RESPONSES: Responses = {
  greeting: 'Hey! How can I help you?',
  error: 'Sorry, I encountered an error. Please check the logs for details.',
};

export interface Responses {
  greeting: string;
  error: string;
}

export interface BotTexts {
  systemPrompt: string;
  responses: Responses;
}

export function loadBotTexts(rootDirectory: string): BotTexts {
  return {
    systemPrompt: loadSystemPrompt(join(rootDirectory, 'system_prompt.md')),
    responses: loadResponses(join(rootDirectory, 'responses.json')),
  };
}

function loadSystemPrompt(path: string): string {
  if (!isRegularFile(path)) {
    return DEFAULT_SYSTEM_PROMPT;
  }

  console.log('Loaded system prompt from file.');

  return readFileSync(path, 'utf8');
}

function loadResponses(path: string): Responses {
  if (!isRegularFile(path)) {
    return DEFAULT_RESPONSES;
  }

  const decoded: unknown = JSON.parse(readFileSync(path, 'utf8'));

  if (typeof decoded !== 'object' || decoded === null) {
    return DEFAULT_RESPONSES;
  }

  console.log('Loaded responses from file.');

  const fileResponses = decoded as Partial<Record<keyof Responses, unknown>>;

  return {
    greeting: stringOr(fileResponses.greeting, DEFAULT_RESPONSES.greeting),
    error: stringOr(fileResponses.error, DEFAULT_RESPONSES.error),
  };
}

// A missing bind-mount source makes Docker create a directory in its place.
function isRegularFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
