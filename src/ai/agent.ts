import { generateText, type LanguageModel } from 'ai';
import type { MessageStore, StoredMessage } from '../storage/messages.js';
import { formatTimestamp, formatTranscript, formatUtcOffset } from './transcript.js';

const MAX_REPLY_CHAIN_DEPTH = 10;

const FORMATTING_INSTRUCTIONS = `Your reply is sent to Telegram with parse_mode HTML.
Only use these tags: <b>, <i>, <u>, <s>, <code>, <pre>, <a href="...">, <blockquote>, <tg-spoiler>.
Never use <p>, <br>, <ul>, <li>, headings or Markdown. Use plain line breaks and "•" for lists.
Escape literal <, > and & as &lt;, &gt; and &amp;.`;

export interface AgentOptions {
  model: LanguageModel;
  systemPrompt: string;
  store: MessageStore;
  contextMessages: number;
  retentionDays: number;
  timeZone: string;
  now?: () => Date;
}

export interface AgentRequest {
  chatId: number;
  messageId: number;
  author: string;
  question: string;
}

export class Agent {
  constructor(private readonly options: AgentOptions) {}

  async reply(request: AgentRequest): Promise<string> {
    const result = await generateText({
      model: this.options.model,
      instructions: this.buildInstructions(),
      prompt: this.buildPrompt(request),
    });

    return result.text.trim();
  }

  private buildInstructions(): string {
    const { timeZone, retentionDays } = this.options;
    const now = this.options.now?.() ?? new Date();
    const currentTime = formatTimestamp(Math.floor(now.getTime() / 1000), timeZone);

    const historyInstructions = `You are chatting in a Telegram chat. Chat messages are shown as "[#<message id> <time>] <author>: <text>".
You only know messages the bot has seen in this chat during the last ${retentionDays} days.
Current time: ${currentTime} (${timeZone}, ${formatUtcOffset(now, timeZone)}).`;

    return [this.options.systemPrompt, historyInstructions, FORMATTING_INSTRUCTIONS].join('\n\n');
  }

  private buildPrompt(request: AgentRequest): string {
    const { store, contextMessages, timeZone } = this.options;
    const recentMessages = store
      .getRecent(request.chatId, contextMessages + 1)
      .filter((message) => message.messageId !== request.messageId)
      .slice(-contextMessages);
    const recentIds = new Set(recentMessages.map((message) => message.messageId));
    const replyChain = store
      .getReplyChain(request.chatId, request.messageId, MAX_REPLY_CHAIN_DEPTH)
      .filter((message) => !recentIds.has(message.messageId));

    const sections: string[] = [];
    appendSection(sections, 'Earlier messages in the reply thread:', replyChain, timeZone);
    appendSection(sections, 'Most recent chat messages:', recentMessages, timeZone);
    sections.push(
      `Message #${request.messageId} from ${request.author}, which you are replying to:\n${request.question}`,
    );

    return sections.join('\n\n');
  }
}

function appendSection(
  sections: string[],
  heading: string,
  messages: StoredMessage[],
  timeZone: string,
): void {
  if (messages.length === 0) {
    return;
  }

  sections.push(`${heading}\n${formatTranscript(messages, timeZone)}`);
}
