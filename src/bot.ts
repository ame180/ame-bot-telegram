import { Bot } from 'grammy';
import type { Message } from 'grammy/types';
import type { Agent } from './ai/agent.js';
import type { BackgroundTasks } from './backgroundTasks.js';
import type { BotTexts } from './prompts.js';
import { dropStaleUpdates } from './staleUpdates.js';
import { keepTyping, type ReplyTarget, sendReply } from './telegram/send.js';
import { isAddressedToBot, stripMention } from './trigger.js';

export interface BotDependencies {
  botToken: string;
  updateTimeoutSeconds: number;
  texts: BotTexts;
  agent: Agent;
  backgroundTasks: BackgroundTasks;
}

export function createBot(dependencies: BotDependencies): Bot {
  const { texts, agent, backgroundTasks } = dependencies;
  const bot = new Bot(dependencies.botToken);

  bot.use(dropStaleUpdates(dependencies.updateTimeoutSeconds));

  bot.command('ping', (ctx) => ctx.reply('Pong!'));

  bot.on(['message:text', 'message:caption'], async (ctx) => {
    const message = ctx.message;

    if (!isAddressedToBot(message, ctx.me)) {
      return;
    }

    const target = replyTargetFor(message);
    const question = stripMention(message.text ?? message.caption ?? '', ctx.me.username);

    if (question === '') {
      await sendReply(ctx.api, target, texts.responses.greeting);
      return;
    }

    backgroundTasks.run(`reply to ${message.chat.id}:${message.message_id}`, async () => {
      const stopTyping = keepTyping(ctx.api, target);

      try {
        const reply = await agent.reply({ question });
        await sendReply(ctx.api, target, reply || texts.responses.error);
      } catch (error) {
        console.error('Agent error:', error);
        await sendReply(ctx.api, target, texts.responses.error);
      } finally {
        stopTyping();
      }
    });
  });

  bot.catch((error) => {
    console.error(`Error processing update ${error.ctx.update.update_id}:`, error.error);
  });

  return bot;
}

function replyTargetFor(message: Message): ReplyTarget {
  return {
    chatId: message.chat.id,
    replyToMessageId: message.chat.type === 'private' ? undefined : message.message_id,
    threadId: message.is_topic_message ? message.message_thread_id : undefined,
  };
}
