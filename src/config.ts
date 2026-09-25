import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  UPDATE_TIMEOUT_SECONDS: z.coerce.number().int().positive(),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1),
  DB_PATH: z.string().min(1).default('data/bot.sqlite'),
  RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  CONTEXT_MESSAGES: z.coerce.number().int().nonnegative().default(20),
  TIME_ZONE: z.string().default('UTC').refine(isValidTimeZone, 'Unknown IANA time zone'),
});

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export interface Config {
  botToken: string;
  updateTimeoutSeconds: number;
  openRouterApiKey: string;
  openRouterModel: string;
  dbPath: string;
  retentionDays: number;
  contextMessages: number;
  timeZone: string;
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration, check .env:\n${problems}`);
  }

  const parsed = result.data;

  return {
    botToken: parsed.BOT_TOKEN,
    updateTimeoutSeconds: parsed.UPDATE_TIMEOUT_SECONDS,
    openRouterApiKey: parsed.OPENROUTER_API_KEY,
    openRouterModel: parsed.OPENROUTER_MODEL,
    dbPath: parsed.DB_PATH,
    retentionDays: parsed.RETENTION_DAYS,
    contextMessages: parsed.CONTEXT_MESSAGES,
    timeZone: parsed.TIME_ZONE,
  };
}
