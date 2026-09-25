import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Agent } from './ai/agent.js';
import { BackgroundTasks } from './backgroundTasks.js';
import { createBot } from './bot.js';
import { type Config, parseConfig } from './config.js';
import { loadBotTexts } from './prompts.js';
import { openDatabase } from './storage/db.js';
import { MessageStore } from './storage/messages.js';
import { scheduleRetention } from './storage/retention.js';

function loadConfigOrExit(): Config {
  try {
    return parseConfig(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const config = loadConfigOrExit();
const texts = loadBotTexts(process.cwd());

const openRouter = createOpenRouter({
  apiKey: config.openRouterApiKey,
  compatibility: 'strict',
  appName: 'Ame Bot',
});

const db = openDatabase(config.dbPath);
const store = new MessageStore(db);
const stopRetention = scheduleRetention(store, config.retentionDays);

const backgroundTasks = new BackgroundTasks();
const agent = new Agent({
  model: openRouter.chat(config.openRouterModel),
  systemPrompt: texts.systemPrompt,
  store,
  contextMessages: config.contextMessages,
  retentionDays: config.retentionDays,
  timeZone: config.timeZone,
});

const bot = createBot({
  botToken: config.botToken,
  updateTimeoutSeconds: config.updateTimeoutSeconds,
  texts,
  agent,
  backgroundTasks,
  store,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    console.log(`Received ${signal}, stopping bot...`);
    void bot.stop();
  });
}

await bot.start({
  allowed_updates: ['message', 'edited_message'],
  onStart: (botInfo) => console.log(`Bot @${botInfo.username} is running via getUpdates...`),
});

await backgroundTasks.drain();
stopRetention();
db.close();
console.log('Bot stopped.');
